import "server-only";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { orderToken } from "@/server/crypto";
import { timingSafeEqual } from "node:crypto";

// Apps → Order tracking: what a buyer sees about their own order (no notes, no agent, no address line).
export type TrackedOrder = Awaited<ReturnType<typeof loadOrders>>[number];

const hidden = ["abandoned", "flagged"] as const;

async function loadOrders(shopId: string, where: ReturnType<typeof and>) {
  const o = schema.orders;
  const orders = await db
    .select({ id: o.id, number: o.number, status: o.status, createdAt: o.createdAt, customerName: o.customerName, wilayaCode: o.wilayaCode, commune: o.commune, deliveryType: o.deliveryType, subtotal: o.subtotal, shippingPrice: o.shippingPrice, total: o.total, locked: o.locked })
    .from(o)
    .where(and(eq(o.shopId, shopId), where))
    .orderBy(desc(o.createdAt))
    .limit(10);
  if (!orders.length) return [];
  const ids = orders.map((x) => x.id);
  const [items, shipments] = await Promise.all([
    db.select({ orderId: schema.orderItems.orderId, name: schema.orderItems.name, variantTitle: schema.orderItems.variantTitle, quantity: schema.orderItems.quantity, total: schema.orderItems.total }).from(schema.orderItems).where(and(eq(schema.orderItems.shopId, shopId), inArray(schema.orderItems.orderId, ids))),
    db.select({ orderId: schema.shipments.orderId, carrierName: schema.shipments.carrierName, trackingNumber: schema.shipments.trackingNumber, status: schema.shipments.status }).from(schema.shipments).where(and(eq(schema.shipments.shopId, shopId), inArray(schema.shipments.orderId, ids))),
  ]);
  return orders.map((x) => ({
    ...x,
    // First name only: whoever knows the number does not learn the full name
    customerName: x.customerName.trim().split(/\s+/)[0] ?? "",
    items: items.filter((i) => i.orderId === x.id),
    shipment: shipments.find((s) => s.orderId === x.id) ?? null,
  }));
}

const visible = () => and(ne(schema.orders.status, hidden[0]), ne(schema.orders.status, hidden[1]));

// The private link sent after checkout
export async function orderByToken(shopId: string, orderId: string, token: string) {
  if (!/^[0-9a-f-]{36}$/.test(orderId) || typeof token !== "string") return null;
  const a = Buffer.from(orderToken(orderId));
  const b = Buffer.from(token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [order] = await loadOrders(shopId, and(eq(schema.orders.id, orderId), visible()));
  return order ?? null;
}

// The lookup form: the phone's orders, or one order by its number and phone
export async function lookupOrders(shopId: string, phone: string, number: number | null) {
  return loadOrders(shopId, and(eq(schema.orders.phone, phone), number === null ? undefined : eq(schema.orders.number, number), visible()));
}

export const trackLink = (base: string, orderId: string) => `${base}/track?o=${orderId}&k=${orderToken(orderId)}`;

// Lookups from one connection are limited (phone numbers are short: no guessing them one by one)
const attempts = new Map<string, number[]>();
export function lookupAllowed(ip: string | null, max = 20) {
  const key = ip ?? "?";
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= max) return false;
  recent.push(now);
  attempts.set(key, recent);
  if (attempts.size > 5000) attempts.clear();
  return true;
}
