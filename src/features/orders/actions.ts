"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { newId, requireSection } from "@/server/auth/context";
import { safeAction } from "@/server/errors";
import { asLocale } from "@/i18n";
import { fieldErrorsFrom } from "@/lib/validation";
import { isValidDzPhone, normalizePhone } from "@/lib/phone";
import { wilayas } from "@/lib/wilayas";
import type { ActionState } from "@/lib/action";
import { deliveryTypes } from "@/server/db/schema";
import { isOrderStatus } from "./statuses";
import { applyOrderStatus } from "./transition";
import { canTouchOrder, viewerOf } from "./access";
import { scheduleOrderSync } from "@/features/apps/sync";

const guard = (lang: string) => requireSection(asLocale(lang), "orders");

export async function changeOrderStatus(lang: string, orderId: string, status: string): Promise<ActionState> {
  return safeAction("orders/status", async () => {
    const ctx = await guard(lang);
    const { shop, user } = ctx;
    if (!isOrderStatus(status)) return { ok: false, error: "invalid" };
    if (!(await canTouchOrder(viewerOf(ctx), orderId))) return { ok: false, error: "notFound" };
    await db.transaction((tx) => applyOrderStatus(tx, shop.id, orderId, status, user.id));
    refresh();
    return { ok: true };
  });
}

const noteSchema = z.object({ note: z.string().trim().min(1, "e:required").max(1000, "e:invalid") });

export async function addOrderNote(lang: string, orderId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("orders/note", async () => {
    const ctx = await guard(lang);
    const { shop, user } = ctx;
    const parsed = noteSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
    if (!(await canTouchOrder(viewerOf(ctx), orderId))) return { ok: false, error: "notFound" };
    await db.insert(schema.orderEvents).values({ id: newId(), orderId, shopId: shop.id, userId: user.id, type: "note", note: parsed.data.note });
    refresh();
    return { ok: true };
  });
}

const customerSchema = z.object({
  customerName: z.string().trim().min(2, "e:tooShort").max(120, "e:invalid"),
  phone: z.string().transform(normalizePhone).refine(isValidDzPhone, "e:phone"),
  wilayaCode: z.coerce.number().int().refine((c) => wilayas.some((w) => w.code === c), "e:invalid"),
  commune: z.string().trim().min(2, "e:tooShort").max(120, "e:invalid"),
  address: z.string().trim().max(255, "e:invalid").optional().default(""),
  deliveryType: z.enum(deliveryTypes),
  shippingPrice: z.preprocess((v) => Number(String(v ?? "").replace(/\s/g, "") || 0), z.number().int("e:price").min(0, "e:price").max(1_000_000, "e:price")),
});

// The call center corrects what the customer typed (wrong commune, other number…).
export async function updateOrderCustomer(lang: string, orderId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("orders/edit", async () => {
    const ctx = await guard(lang);
    const { shop, user } = ctx;
    const parsed = customerSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    if (!(await canTouchOrder(viewerOf(ctx), orderId))) return { ok: false, error: "notFound" };
    const d = parsed.data;
    const [order] = await db.select({ subtotal: schema.orders.subtotal }).from(schema.orders).where(and(eq(schema.orders.shopId, shop.id), eq(schema.orders.id, orderId)));
    if (!order) return { ok: false, error: "notFound" };
    await db.transaction(async (tx) => {
      await tx
        .update(schema.orders)
        .set({ ...d, address: d.address || null, total: order.subtotal + d.shippingPrice })
        .where(and(eq(schema.orders.shopId, shop.id), eq(schema.orders.id, orderId)));
      await tx.insert(schema.orderEvents).values({ id: newId(), orderId, shopId: shop.id, userId: user.id, type: "edit" });
    });
    scheduleOrderSync(shop.id, orderId);
    refresh();
    return { ok: true };
  });
}

export async function setPhoneBlocked(lang: string, rawPhone: string, blocked: boolean): Promise<ActionState> {
  return safeAction("orders/block", async () => {
    const { shop } = await guard(lang);
    const phone = normalizePhone(rawPhone);
    if (!isValidDzPhone(phone)) return { ok: false, error: "phone" };
    if (blocked) await db.insert(schema.blockedPhones).ignore().values({ shopId: shop.id, phone });
    else await db.delete(schema.blockedPhones).where(and(eq(schema.blockedPhones.shopId, shop.id), eq(schema.blockedPhones.phone, phone)));
    refresh();
    return { ok: true };
  });
}

export async function setLeadStatus(lang: string, leadId: string, status: "abandoned" | "contacted"): Promise<ActionState> {
  return safeAction("leads/status", async () => {
    const { shop } = await guard(lang);
    if (status !== "abandoned" && status !== "contacted") return { ok: false, error: "invalid" };
    await db.update(schema.leads).set({ status }).where(and(eq(schema.leads.shopId, shop.id), eq(schema.leads.id, leadId)));
    refresh();
    return { ok: true };
  });
}

export async function deleteLead(lang: string, leadId: string): Promise<ActionState> {
  return safeAction("leads/delete", async () => {
    const { shop } = await guard(lang);
    await db.delete(schema.leads).where(and(eq(schema.leads.shopId, shop.id), eq(schema.leads.id, leadId)));
    refresh();
    return { ok: true };
  });
}

// Gives an order to a team member (or nobody). Managers and owners only.
export async function assignOrder(lang: string, orderId: string, userId: string | null): Promise<ActionState> {
  return safeAction("orders/assign", async () => {
    const { shop, user, role } = await guard(lang);
    if (role === "agent") return { ok: false, error: "forbidden" };
    let name: string | null = null;
    if (userId) {
      const [member] = await db
        .select({ name: schema.users.name })
        .from(schema.shopMembers)
        .innerJoin(schema.users, eq(schema.users.id, schema.shopMembers.userId))
        .where(and(eq(schema.shopMembers.shopId, shop.id), eq(schema.shopMembers.userId, userId), eq(schema.shopMembers.active, true)));
      if (!member) return { ok: false, error: "notFound" };
      name = member.name;
    }
    const [res] = await db
      .update(schema.orders)
      .set({ assignedTo: userId, assignedAt: userId ? new Date() : null })
      .where(and(eq(schema.orders.shopId, shop.id), eq(schema.orders.id, orderId)));
    if (!res.affectedRows) return { ok: false, error: "notFound" };
    await db.insert(schema.orderEvents).values({ id: newId(), orderId, shopId: shop.id, userId: user.id, type: "assign", note: name });
    scheduleOrderSync(shop.id, orderId);
    refresh();
    return { ok: true };
  });
}
