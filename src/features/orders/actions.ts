"use server";

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
import { holdsStock, isOrderStatus } from "./statuses";
import { applyOrderStatus } from "./transition";
import { canTouchOrder, viewerOf } from "./access";
import { scheduleOrderSync } from "@/features/apps/sync";
import { spreadOrders, type Spread } from "@/features/team/distribution";
import { pickAgent } from "@/features/team/assign";
import { isIp, listOf, resolveProtection } from "@/features/checkout/protection-settings";
import { autoBlockFakePhone } from "@/features/checkout/protection";
import { nextOrderNumber } from "@/features/checkout/place-order";
import { getShippingRates } from "@/features/storefront/queries";
import { shippingPrice } from "@/features/checkout/pricing";
import { logStock } from "@/features/inventory/movements";
import { takeOrderSlot } from "@/features/plans/locked";
import { orderRule } from "@/server/limits";

const guard = (lang: string) => requireSection(asLocale(lang), "orders");
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// The status menu of a row or of the edit dialog: any of the nine statuses
export async function changeOrderStatus(lang: string, orderId: string, status: string): Promise<ActionState> {
  return safeAction("orders/status", async () => {
    const ctx = await guard(lang);
    const { shop, user } = ctx;
    if (!isOrderStatus(status)) return { ok: false, error: "invalid" };
    if (!(await canTouchOrder(viewerOf(ctx), orderId))) return { ok: false, error: "notFound" };
    await db.transaction((tx) => applyOrderStatus(tx, shop.id, orderId, status, user.id));
    // Flagged orders can block the phone (Fake order guard → automatic block)
    if (status === "flagged") {
      const [order] = await db.select({ phone: schema.orders.phone }).from(schema.orders).where(and(eq(schema.orders.shopId, shop.id), eq(schema.orders.id, orderId)));
      if (order) await autoBlockFakePhone(shop.id, order.phone);
    }
    refresh();
    return { ok: true };
  });
}

// The table's inline cells: the amount, the delivery type, the agent, the delivery company, the note
export type InlineField = "total" | "deliveryType" | "agent" | "carrier" | "note";
export async function updateOrderField(lang: string, orderId: string, field: InlineField, value: string): Promise<ActionState> {
  return safeAction("orders/inline", async () => {
    const ctx = await guard(lang);
    const { shop, user } = ctx;
    if (!(await canTouchOrder(viewerOf(ctx), orderId))) return { ok: false, error: "notFound" };
    const where = and(eq(schema.orders.shopId, shop.id), eq(schema.orders.id, orderId));
    if (field === "agent") return assignMany(lang, [orderId], value || null);
    if (field === "total") {
      const total = Number(value.replace(/\s/g, ""));
      if (!Number.isInteger(total) || total < 0 || total > 100_000_000) return { ok: false, error: "price" };
      await db.update(schema.orders).set({ total }).where(where);
    } else if (field === "deliveryType") {
      if (!(deliveryTypes as readonly string[]).includes(value)) return { ok: false, error: "invalid" };
      await db.update(schema.orders).set({ deliveryType: value as (typeof deliveryTypes)[number] }).where(where);
    } else if (field === "carrier") {
      if (value) {
        const [account] = await db.select({ id: schema.carrierAccounts.id }).from(schema.carrierAccounts).where(and(eq(schema.carrierAccounts.shopId, shop.id), eq(schema.carrierAccounts.id, value)));
        if (!account) return { ok: false, error: "notFound" };
      }
      await db.update(schema.orders).set({ carrierAccountId: value || null }).where(where);
    } else if (field === "note") {
      await db.update(schema.orders).set({ note: value.trim().slice(0, 500) || null }).where(where);
    } else return { ok: false, error: "invalid" };
    await db.insert(schema.orderEvents).values({ id: newId(), orderId, shopId: shop.id, userId: user.id, type: "edit" });
    await scheduleOrderSync(shop.id, orderId);
    refresh();
    return { ok: true };
  });
}

// ─── The order dialog (edit an order, or create one by hand) ─────────────

const lineSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional().default(null),
  quantity: z.coerce.number().int().min(1).max(999),
  unitPrice: z.coerce.number().int().min(0).max(100_000_000),
});
const orderSchema = z.object({
  customerName: z.string().trim().min(2, "e:tooShort").max(120, "e:invalid"),
  phone: z.string().transform(normalizePhone).refine(isValidDzPhone, "e:phone"),
  wilayaCode: z.coerce.number().int().refine((c) => wilayas.some((w) => w.code === c), "e:required"),
  commune: z.string().trim().min(2, "e:required").max(120, "e:invalid"),
  address: z.string().trim().max(255).optional().default(""),
  deliveryType: z.enum(deliveryTypes),
  carrierAccountId: z.string().optional().default(""),
  shippingWaived: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  total: z.preprocess((v) => (v === "" || v == null ? null : Number(String(v).replace(/\s/g, ""))), z.number().int().min(0).max(100_000_000).nullable()),
  agent: z.string().optional().default(""),
  note: z.string().trim().max(500).optional().default(""),
  status: z.string().optional().default(""),
  items: z.preprocess((v) => {
    try {
      return JSON.parse(String(v ?? "[]"));
    } catch {
      return null;
    }
  }, z.array(lineSchema).min(1, "e:required").max(20)),
});

// The lines as order items: the products' names and the variants' titles come from the store, never the browser
async function buildLines(shopId: string, lines: z.infer<typeof lineSchema>[]) {
  const ids = [...new Set(lines.map((l) => l.productId))];
  const [products, variants] = await Promise.all([
    db.select().from(schema.products).where(and(eq(schema.products.shopId, shopId), inArray(schema.products.id, ids))),
    db.select().from(schema.productVariants).where(and(eq(schema.productVariants.shopId, shopId), inArray(schema.productVariants.productId, ids))),
  ]);
  const out = [];
  for (const l of lines) {
    const p = products.find((x) => x.id === l.productId);
    if (!p) return null;
    const v = l.variantId ? variants.find((x) => x.id === l.variantId && x.productId === p.id) : null;
    if (l.variantId && !v) return null;
    out.push({ productId: p.id, variantId: v?.id ?? null, name: p.name, variantTitle: v?.title ?? null, sku: v?.sku || p.sku, unitPrice: l.unitPrice, quantity: l.quantity, total: l.unitPrice * l.quantity, stockTracked: p.trackStock });
  }
  return out;
}

// Takes (sign -1) or gives back (+1) the pieces of tracked lines
async function moveStock(tx: Tx, shopId: string, orderId: string, userId: string, lines: { productId: string | null; variantId: string | null; quantity: number; stockTracked: boolean }[], sign: 1 | -1, reason: "edit" | "order") {
  for (const l of lines) {
    if (!l.stockTracked || !l.productId) continue;
    const delta = sign * l.quantity;
    if (l.variantId) await tx.update(schema.productVariants).set({ stock: sql`GREATEST(${schema.productVariants.stock} + ${delta}, 0)` }).where(and(eq(schema.productVariants.shopId, shopId), eq(schema.productVariants.id, l.variantId)));
    else await tx.update(schema.products).set({ stock: sql`GREATEST(${schema.products.stock} + ${delta}, 0)` }).where(and(eq(schema.products.shopId, shopId), eq(schema.products.id, l.productId)));
    await logStock(tx, [{ shopId, productId: l.productId, variantId: l.variantId, delta, reason, orderId, userId }]);
  }
}

// Saves the dialog: an existing order (id) or a new manual order (null). The delivery fee comes from the store's rates
// (0 when waived); the total is the merchant's (products + delivery by default).
export async function saveOrder(lang: string, orderId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("orders/save", async () => {
    const ctx = await guard(lang);
    const { shop, user, role } = ctx;
    const parsed = orderSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const d = parsed.data;
    const lines = await buildLines(shop.id, d.items);
    if (!lines) return { ok: false, error: "notFound" };
    if (d.carrierAccountId) {
      const [account] = await db.select({ id: schema.carrierAccounts.id }).from(schema.carrierAccounts).where(and(eq(schema.carrierAccounts.shopId, shop.id), eq(schema.carrierAccounts.id, d.carrierAccountId)));
      if (!account) return { ok: false, error: "notFound" };
    }
    const fee = d.shippingWaived ? 0 : (shippingPrice(await getShippingRates(shop.id), d.wilayaCode, d.deliveryType) ?? 0);
    const subtotal = lines.reduce((s, l) => s + l.total, 0);
    const values = {
      customerName: d.customerName,
      phone: d.phone,
      wilayaCode: d.wilayaCode,
      commune: d.commune,
      address: d.address || null,
      deliveryType: d.deliveryType,
      carrierAccountId: d.carrierAccountId || null,
      shippingWaived: d.shippingWaived,
      shippingPrice: fee,
      subtotal,
      total: d.total ?? subtotal + fee,
      note: d.note || null,
    };
    if (orderId) {
      if (!(await canTouchOrder(viewerOf(ctx), orderId))) return { ok: false, error: "notFound" };
      const [order] = await db.select({ status: schema.orders.status, assignedTo: schema.orders.assignedTo }).from(schema.orders).where(and(eq(schema.orders.shopId, shop.id), eq(schema.orders.id, orderId)));
      if (!order) return { ok: false, error: "notFound" };
      await db.transaction(async (tx) => {
        const old = await tx.select().from(schema.orderItems).where(and(eq(schema.orderItems.shopId, shop.id), eq(schema.orderItems.orderId, orderId)));
        // The pieces follow the new lines (only while the order holds stock)
        if (holdsStock(order.status)) {
          await moveStock(tx, shop.id, orderId, user.id, old, 1, "edit");
          await moveStock(tx, shop.id, orderId, user.id, lines, -1, "edit");
        }
        await tx.delete(schema.orderItems).where(and(eq(schema.orderItems.shopId, shop.id), eq(schema.orderItems.orderId, orderId)));
        await tx.insert(schema.orderItems).values(lines.map((l) => ({ id: newId(), orderId, shopId: shop.id, ...l })));
        await tx.update(schema.orders).set(values).where(and(eq(schema.orders.shopId, shop.id), eq(schema.orders.id, orderId)));
        await tx.insert(schema.orderEvents).values({ id: newId(), orderId, shopId: shop.id, userId: user.id, type: "edit" });
        if (isOrderStatus(d.status) && d.status !== order.status) await applyOrderStatus(tx, shop.id, orderId, d.status, user.id);
      });
      if (role !== "agent" && d.agent !== (order.assignedTo ?? "")) await assignMany(lang, [orderId], d.agent || null);
      await scheduleOrderSync(shop.id, orderId);
      refresh();
      return { ok: true };
    }
    // A new order taken by the team: a number, the stock, the plan's count, an agent (the store's rule)
    const id = newId();
    const rule = await orderRule(shop.id);
    await db.transaction(async (tx) => {
      const number = await nextOrderNumber(tx, shop.id);
      const locked = await takeOrderSlot(tx, shop.id, rule);
      await tx.insert(schema.orders).values({ id, shopId: shop.id, number, status: "pending", locked, ...values });
      await tx.insert(schema.orderItems).values(lines.map((l) => ({ id: newId(), orderId: id, shopId: shop.id, ...l })));
      await moveStock(tx, shop.id, id, user.id, lines, -1, "order");
      await tx.insert(schema.orderEvents).values({ id: newId(), orderId: id, shopId: shop.id, userId: user.id, type: "created", toStatus: "pending", note: "↺" });
      const agent = locked ? null : await pickAgent(tx, shop.id);
      if (agent) {
        await tx.update(schema.orders).set({ assignedTo: agent.userId, assignedAt: new Date() }).where(eq(schema.orders.id, id));
        await tx.insert(schema.orderEvents).values({ id: newId(), orderId: id, shopId: shop.id, type: "assign", note: agent.name });
      }
    });
    await scheduleOrderSync(shop.id, id);
    refresh();
    return { ok: true, message: id };
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
      if (order && !order.assignedTo && order.status === "pending") {
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

