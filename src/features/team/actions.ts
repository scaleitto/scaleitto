"use server";

import { and, eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { newId, requireSection, type ShopContext } from "@/server/auth/context";
import { hashPassword } from "@/server/auth/password";
import { safeAction } from "@/server/errors";
import { canAdd } from "@/server/limits";
import { asLocale } from "@/i18n";
import { fieldErrorsFrom } from "@/lib/validation";
import type { ActionState } from "@/lib/action";
import type { MemberRole } from "@/server/db/schema";
import { newMemberSchema, parseMemberUpdate } from "./validators";
import { PENDING_STATUSES } from "@/features/orders/statuses";

// Owners manage everyone but themselves; managers manage agents only.
async function managerOf(lang: string): Promise<ShopContext | null> {
  const ctx = await requireSection(asLocale(lang), "callCenters");
  return ctx.role === "agent" ? null : ctx;
}

const canManage = (ctx: ShopContext, target: { userId: string; role: MemberRole }) =>
  target.userId !== ctx.user.id && target.role !== "owner" && (ctx.role === "owner" || target.role === "agent");

async function memberOf(shopId: string, userId: string) {
  const [m] = await db.select().from(schema.shopMembers).where(and(eq(schema.shopMembers.shopId, shopId), eq(schema.shopMembers.userId, userId)));
  return m ?? null;
}

export async function addMember(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("team/add", async () => {
    const ctx = await managerOf(lang);
    if (!ctx) return { ok: false, error: "forbidden" };
    const parsed = newMemberSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const d = parsed.data;
    if (d.role === "manager" && ctx.role !== "owner") return { ok: false, error: "forbidden" };
    if (!(await canAdd(ctx.shop.id, "maxStaff"))) return { ok: false, error: "limitStaff" };
    // One account belongs to one shop: an existing email cannot be reused
    const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, d.email));
    if (existing) return { ok: false, error: "checkFields", fieldErrors: { email: "emailTaken" } };
    const userId = newId();
    await db.transaction(async (tx) => {
      // Created by the shop owner, who knows them: no email confirmation
      await tx.insert(schema.users).values({ id: userId, email: d.email, name: d.name, passwordHash: await hashPassword(d.password), locale: asLocale(lang), emailVerifiedAt: new Date() });
      await tx.insert(schema.shopMembers).values({ shopId: ctx.shop.id, userId, role: d.role });
    });
    refresh();
    return { ok: true };
  });
}

export async function updateMember(lang: string, userId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("team/update", async () => {
    const ctx = await managerOf(lang);
    if (!ctx) return { ok: false, error: "forbidden" };
    const member = await memberOf(ctx.shop.id, userId);
    if (!member) return { ok: false, error: "notFound" };
    const parsed = parseMemberUpdate(formData);
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    // Anyone may set their own schedule only if they can manage it; roles change only for manageable members
    if (!canManage(ctx, member) && !(ctx.role === "owner" && member.userId === ctx.user.id)) return { ok: false, error: "forbidden" };
    const role = member.role === "owner" ? "owner" : parsed.data.role;
    if (role === "manager" && member.role !== "manager" && ctx.role !== "owner") return { ok: false, error: "forbidden" };
    await db
      .update(schema.shopMembers)
      .set({ role, schedule: parsed.data.schedule })
      .where(and(eq(schema.shopMembers.shopId, ctx.shop.id), eq(schema.shopMembers.userId, userId)));
    refresh();
    return { ok: true };
  });
}

// Deactivating signs the member out at once and stops new orders reaching them;
// their open orders go back to "unassigned" so nothing is left waiting.
export async function setMemberActive(lang: string, userId: string, active: boolean): Promise<ActionState> {
  return safeAction("team/active", async () => {
    const ctx = await managerOf(lang);
    if (!ctx) return { ok: false, error: "forbidden" };
    const member = await memberOf(ctx.shop.id, userId);
    if (!member) return { ok: false, error: "notFound" };
    if (!canManage(ctx, member)) return { ok: false, error: "forbidden" };
    if (active && !member.active && !(await canAdd(ctx.shop.id, "maxStaff"))) return { ok: false, error: "limitStaff" };
    await db.transaction(async (tx) => {
      await tx.update(schema.shopMembers).set({ active }).where(and(eq(schema.shopMembers.shopId, ctx.shop.id), eq(schema.shopMembers.userId, userId)));
      if (!active) {
        await tx.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
        await tx
          .update(schema.orders)
          .set({ assignedTo: null, assignedAt: null })
          .where(and(eq(schema.orders.shopId, ctx.shop.id), eq(schema.orders.assignedTo, userId), inArray(schema.orders.status, [...PENDING_STATUSES])));
      }
    });
    refresh();
    return { ok: true };
  });
}

const passwordSchema = z.object({ password: z.string().min(8, "e:password").max(200, "e:password") });

export async function resetMemberPassword(lang: string, userId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("team/password", async () => {
    const ctx = await managerOf(lang);
    if (!ctx) return { ok: false, error: "forbidden" };
    const member = await memberOf(ctx.shop.id, userId);
    if (!member || !canManage(ctx, member)) return { ok: false, error: "forbidden" };
    const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    await db.transaction(async (tx) => {
      await tx.update(schema.users).set({ passwordHash: await hashPassword(parsed.data.password) }).where(eq(schema.users.id, userId));
      await tx.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
    });
    return { ok: true };
  });
}

export async function setAssignMode(lang: string, mode: string): Promise<ActionState> {
  return safeAction("team/assign-mode", async () => {
    const ctx = await managerOf(lang);
    if (!ctx) return { ok: false, error: "forbidden" };
    if (mode !== "manual" && mode !== "balanced" && mode !== "on_shift") return { ok: false, error: "invalid" };
    await db.update(schema.shops).set({ assignMode: mode }).where(eq(schema.shops.id, ctx.shop.id));
    refresh();
    return { ok: true };
  });
}
