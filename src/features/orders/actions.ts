"use server";

import { placeOrder } from "@/features/checkout/place-order";
import type { OrderInput } from "@/features/checkout/validators";
import { and, eq, inArray, sql } from "drizzle-orm";
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
import { PARCEL_STATUSES, callStatuses, type OrderStatus } from "./statuses";
import { applyOrderStatus } from "./transition";
import { canTouchOrder, viewerOf } from "./access";
import { scheduleOrderSync } from "@/features/apps/sync";
import { spreadOrders, type Spread } from "@/features/team/distribution";
import { pickAgent } from "@/features/team/assign";
import { isIp, listOf, resolveProtection } from "@/features/checkout/protection-settings";
import { autoBlockFakePhone } from "@/features/checkout/protection";

const guard = (lang: string) => requireSection(asLocale(lang), "orders");

export async function changeOrderStatus(lang: string, orderId: string, status: string): Promise<ActionState> {
  return safeAction("orders/status", async () => {
    const ctx = await guard(lang);
    const { shop, user } = ctx;
    // The call's outcome only: shipped comes from sending, delivered / returned from tracking or the delivery follow-up
    if (!(callStatuses as readonly string[]).includes(status)) return { ok: false, error: "invalid" };
    if (!(await canTouchOrder(viewerOf(ctx), orderId))) return { ok: false, error: "notFound" };
    const where = and(eq(schema.orders.shopId, shop.id), eq(schema.orders.id, orderId));
    const [order] = await db.select({ status: schema.orders.status }).from(schema.orders).where(where);
    if (!order) return { ok: false, error: "notFound" };
    // A sent order is already confirmed; any other call status waits until its parcel is removed (Injection → not injected)
    if ((PARCEL_STATUSES as readonly string[]).includes(order.status)) return status === "confirmed" ? { ok: true } : { ok: false, error: "parcelExists" };
    await db.transaction(async (tx) => {
      const changed = await applyOrderStatus(tx, shop.id, orderId, status as OrderStatus, user.id);
      // Each call is counted (the rule: 3 calls at different times, then a message); the same outcome again
      // ("no answer" a second time) is a new attempt, recorded as its own event
      if (status !== "new") {
        await tx.update(schema.orders).set({ callAttempts: sql`${schema.orders.callAttempts} + 1`, lastCallAt: new Date() }).where(where);
        if (!changed) await tx.insert(schema.orderEvents).values({ id: newId(), orderId, shopId: shop.id, userId: user.id, type: "call", note: status });
      }
    });
    // Fake orders / wrong numbers can block the phone (Protection → automatic block)
    if (status === "fake" || status === "wrong_number") {
      const [order] = await db.select({ phone: schema.orders.phone }).from(schema.orders).where(and(eq(schema.orders.shopId, shop.id), eq(schema.orders.id, orderId)));
      if (order) await autoBlockFakePhone(shop.id, order.phone);
    }
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
    await scheduleOrderSync(shop.id, orderId);
    refresh();
    return { ok: true };
  });
}

export async function setPhoneBlocked(lang: string, rawPhone: string, blocked: boolean, reason?: string): Promise<ActionState> {
  return safeAction("orders/block", async () => {
    const { shop } = await guard(lang);
    const phone = normalizePhone(rawPhone);
    if (!isValidDzPhone(phone)) return { ok: false, error: "phone" };
    if (blocked) await db.insert(schema.blockedPhones).ignore().values({ shopId: shop.id, phone, reason: reason?.trim().slice(0, 200) || null });
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

// An active member of this shop, by id (null when not found)
async function activeMemberName(shopId: string, userId: string) {
  const [member] = await db
    .select({ name: schema.users.name })
    .from(schema.shopMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.shopMembers.userId))
    .where(and(eq(schema.shopMembers.shopId, shopId), eq(schema.shopMembers.userId, userId), eq(schema.shopMembers.active, true)));
  return member?.name ?? null;
}

// Gives orders to a team member (or nobody). Managers and owners only; locked orders are skipped.
async function assignMany(lang: string, orderIds: string[], userId: string | null): Promise<ActionState & { assigned?: number }> {
  const { shop, user, role } = await guard(lang);
  if (role === "agent") return { ok: false, error: "forbidden" };
  const ids = z.array(z.string().uuid()).min(1).max(500).safeParse(orderIds);
  if (!ids.success) return { ok: false, error: "invalid" };
  const name = userId ? await activeMemberName(shop.id, userId) : null;
  if (userId && !name) return { ok: false, error: "notFound" };
  const o = schema.orders;
  const rows = await db.select({ id: o.id }).from(o).where(and(eq(o.shopId, shop.id), inArray(o.id, ids.data), eq(o.locked, false)));
  if (!rows.length) return { ok: false, error: "notFound" };
  await db
    .update(o)
    .set({ assignedTo: userId, assignedAt: userId ? new Date() : null })
    .where(and(eq(o.shopId, shop.id), inArray(o.id, rows.map((r) => r.id))));
  await db.insert(schema.orderEvents).values(rows.map((r) => ({ id: newId(), orderId: r.id, shopId: shop.id, userId: user.id, type: "assign" as const, note: name })));
  for (const r of rows) await scheduleOrderSync(shop.id, r.id);
  refresh();
  return { ok: true, assigned: rows.length };
}

export async function assignOrder(lang: string, orderId: string, userId: string | null): Promise<ActionState> {
  return safeAction("orders/assign", () => assignMany(lang, [orderId], userId));
}

// The orders list's bulk bar: the selected orders to one member, or to nobody
export async function assignOrders(lang: string, orderIds: string[], userId: string | null) {
  return safeAction("orders/assign-many", () => assignMany(lang, orderIds, userId));
}

// Shares orders between the active agents (fewest open orders first): the selected ones, or (null) every
// unassigned open order. Returns who got how many, so the manager sees what happened.
export async function spreadOrdersAction(lang: string, orderIds: string[] | null): Promise<ActionState & { spread?: Spread }> {
  let spread: Spread | undefined;
  const state = await safeAction("orders/spread", async () => {
    const { shop, user, role } = await guard(lang);
    if (role === "agent") return { ok: false, error: "forbidden" };
    const ids = orderIds === null ? null : z.array(z.string().uuid()).min(1).max(500).safeParse(orderIds);
    if (ids && !ids.success) return { ok: false, error: "invalid" };
    const result = await spreadOrders(shop.id, user.id, ids ? ids.data : null);
    if (result === "noAgents") return { ok: false, error: "noAgents" };
    spread = result;
    refresh();
    return { ok: true };
  });
  return { ...state, spread };
}

// ─── Fake-order protection ────────────────────────────────

// The store's protection settings (owners and managers: Orders → Protection)
export async function saveProtection(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("orders/protection", async () => {
    const { shop, role } = await guard(lang);
    if (role === "agent") return { ok: false, error: "forbidden" };
    const num = (k: string) => Number(formData.get(k));
    const on = (k: string) => formData.get(k) === "on";
    const raw = {
      maxPerPhonePerDay: num("maxPerPhonePerDay"),
      maxPerIpPerHour: num("maxPerIpPerHour"),
      blockDuplicates: on("blockDuplicates"),
      minFillSeconds: num("minFillSeconds"),
      blockBots: on("blockBots"),
      riskThreshold: num("riskThreshold"),
      holdSuspicious: on("holdSuspicious"),
      useNetwork: on("useNetwork"),
      maxPerPhonePerWeek: num("maxPerPhonePerWeek"),
      duplicateHours: num("duplicateHours"),
      maxQuantity: num("maxQuantity"),
      autoFakeScore: num("autoFakeScore"),
      autoBlockFake: num("autoBlockFake"),
      blockedIps: listOf(formData.get("blockedIps")),
      blockedWords: listOf(formData.get("blockedWords")),
      blockedWilayas: formData.getAll("blockedWilayas").map(Number),
    };
    // Out-of-range numbers are refused (resolveProtection would silently use the default)
    const bounds: [keyof typeof raw, number, number][] = [
      ["maxPerPhonePerDay", 1, 50],
      ["maxPerPhonePerWeek", 1, 100],
      ["maxPerIpPerHour", 1, 500],
      ["duplicateHours", 1, 168],
      ["maxQuantity", 0, 1000],
      ["minFillSeconds", 0, 60],
      ["riskThreshold", 10, 100],
      ["autoBlockFake", 0, 10],
    ];
    const fieldErrors: Record<string, string> = {};
    for (const [k, min, max] of bounds) if (!Number.isInteger(raw[k]) || (raw[k] as number) < min || (raw[k] as number) > max) fieldErrors[k] = "invalid";
    if (raw.autoFakeScore !== 0 && (!Number.isInteger(raw.autoFakeScore) || raw.autoFakeScore < raw.riskThreshold || raw.autoFakeScore > 100)) fieldErrors.autoFakeScore = "invalid";
    if (raw.blockedIps.some((ip) => !isIp(ip))) fieldErrors.blockedIps = "invalid";
    if (Object.keys(fieldErrors).length) return { ok: false, error: "checkFields", fieldErrors };
    await db.update(schema.shops).set({ protection: resolveProtection(raw) }).where(eq(schema.shops.id, shop.id));
    refresh();
    return { ok: true };
  });
}

// "This order is fine": the risk flag is removed and, when suspicious orders were held, it goes to an agent now
export async function markOrderTrusted(lang: string, orderId: string): Promise<ActionState> {
  return safeAction("orders/trusted", async () => {
    const ctx = await guard(lang);
    const { shop, user } = ctx;
    if (!(await canTouchOrder(viewerOf(ctx), orderId))) return { ok: false, error: "notFound" };
    await db.transaction(async (tx) => {
      await tx.update(schema.orders).set({ risk: 0, riskReasons: null }).where(and(eq(schema.orders.shopId, shop.id), eq(schema.orders.id, orderId)));
      await tx.insert(schema.orderEvents).values({ id: newId(), orderId, shopId: shop.id, userId: user.id, type: "risk", note: "0" });
      const [order] = await tx.select({ assignedTo: schema.orders.assignedTo, status: schema.orders.status }).from(schema.orders).where(eq(schema.orders.id, orderId));
      if (order && !order.assignedTo && order.status === "new") {
        const agent = await pickAgent(tx, shop.id);
        if (agent) {
          await tx.update(schema.orders).set({ assignedTo: agent.userId, assignedAt: new Date() }).where(eq(schema.orders.id, orderId));
          await tx.insert(schema.orderEvents).values({ id: newId(), orderId, shopId: shop.id, type: "assign", note: agent.name });
        }
      }
    });
    refresh();
    return { ok: true };
  });
}

const convertSchema = z.object({
  name: z.string().trim().min(2, "e:tooShort").max(120, "e:invalid"),
  wilaya: z.coerce.number().int().refine((c) => wilayas.some((w) => w.code === c), "e:invalid"),
  commune: z.string().trim().min(2, "e:tooShort").max(120, "e:invalid"),
  address: z.string().trim().max(255, "e:invalid").optional().default(""),
  deliveryType: z.enum(deliveryTypes),
  quantity: z.coerce.number().int().min(1).max(20),
});

// An abandoned cart recovered by phone: the order is created by the member (through placeOrder: stock, number, offers,
// delivery price, assignment) and the cart becomes "converted". Returns the new order's id in message.
export async function convertLead(lang: string, leadId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("leads/convert", async () => {
    const { shop, user } = await guard(lang);
    const parsed = convertSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const [lead] = await db.select().from(schema.leads).where(and(eq(schema.leads.shopId, shop.id), eq(schema.leads.id, leadId)));
    if (!lead || lead.status === "converted") return { ok: false, error: "notFound" };
    const d = parsed.data;
    const result = await placeOrder(
      shop,
      lead.productId,
      { name: d.name, phone: lead.phone, wilaya: d.wilaya, commune: d.commune, address: d.address, deliveryType: d.deliveryType, quantity: d.quantity, variantId: lead.variantId ?? "", note: "", fill: null, website: "" } as OrderInput,
      { ip: null, userAgent: null, memberId: user.id },
    );
    if (!result.ok) return { ok: false, error: result.error === "stock" ? "outOfStock" : result.error === "shipping" ? "noShipping" : "unavailable" };
    refresh();
    return { ok: true, message: result.orderId };
  });
}
