import "server-only";
import { and, count, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { addDays, algeriaParts, daysBetween } from "@/lib/time";
import { CONFIRMED_STATUSES, PENDING_STATUSES } from "@/features/orders/statuses";

const pct = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 100) : null);

// The dashboard home (Zimam's): the last 7 Algeria days against the 7 before, the daily sales, best sellers, the
// latest orders, what needs the merchant and the set-up checklist.
export async function overviewData(shopId: string, now = new Date()) {
  const o = schema.orders;
  const today = algeriaParts(now).day;
  const first = addDays(today, -6);
  const prevStart = new Date(`${addDays(first, -7)}T00:00:00+01:00`);
  const start = new Date(`${first}T00:00:00+01:00`);
  const real = and(eq(o.shopId, shopId), ne(o.status, "abandoned"));
  const [orders, best, latest, [pending], [flagged], [products], [carriers], [rates], [pixels], [shop]] = await Promise.all([
    db.select({ createdAt: o.createdAt, status: o.status, total: o.total }).from(o).where(and(real, gte(o.createdAt, prevStart))),
    db
      .select({ name: schema.orderItems.name, quantity: sql<number>`sum(${schema.orderItems.quantity})`, total: sql<number>`sum(${schema.orderItems.total})`, image: sql<string | null>`max(json_unquote(json_extract(${schema.products.images}, '$[0]')))` })
      .from(schema.orderItems)
      .innerJoin(o, eq(o.id, schema.orderItems.orderId))
      .leftJoin(schema.products, eq(schema.products.id, schema.orderItems.productId))
      .where(and(real, gte(o.createdAt, start)))
      .groupBy(schema.orderItems.name)
      .orderBy(desc(sql`sum(${schema.orderItems.quantity})`))
      .limit(5),
    db.select({ id: o.id, number: o.number, customerName: o.customerName, total: o.total, status: o.status, createdAt: o.createdAt, locked: o.locked }).from(o).where(real).orderBy(desc(o.createdAt)).limit(6),
    db.select({ n: count() }).from(o).where(and(eq(o.shopId, shopId), inArray(o.status, [...PENDING_STATUSES]))),
    db.select({ n: count() }).from(o).where(and(eq(o.shopId, shopId), eq(o.status, "flagged"))),
    db.select({ n: count() }).from(schema.products).where(eq(schema.products.shopId, shopId)),
    db.select({ n: count() }).from(schema.carrierAccounts).where(eq(schema.carrierAccounts.shopId, shopId)),
    db.select({ n: count() }).from(schema.shippingRates).where(eq(schema.shippingRates.shopId, shopId)),
    db.select({ n: count() }).from(schema.pixels).where(eq(schema.pixels.shopId, shopId)),
    db.select({ design: schema.shops.design }).from(schema.shops).where(eq(schema.shops.id, shopId)),
  ]);
  const inRange = orders.filter((r) => r.createdAt >= start);
  const before = orders.filter((r) => r.createdAt < start);
  const kpi = (list: typeof orders) => ({
    orders: list.length,
    sales: list.reduce((s, r) => s + r.total, 0),
    confirmed: list.filter((r) => (CONFIRMED_STATUSES as readonly string[]).includes(r.status)).length,
    delivered: list.filter((r) => r.status === "delivered").length,
  });
  const cur = kpi(inRange);
  const prev = kpi(before);
  const days = daysBetween(first, today).map((day) => {
    const list = inRange.filter((r) => algeriaParts(r.createdAt).day === day);
    return { day, orders: list.length, sales: list.reduce((s, r) => s + r.total, 0) };
  });
  return {
    kpis: (["orders", "sales", "confirmed", "delivered"] as const).map((key) => ({ key, value: cur[key], change: pct(cur[key], prev[key]) })),
    days,
    best: best.map((b) => ({ ...b, quantity: Number(b.quantity), total: Number(b.total) })),
    latest: latest.map((r) => (r.locked ? { ...r, customerName: "" } : r)),
    attention: { pending: pending.n, flagged: flagged.n, noCarrier: carriers.n === 0 },
    checklist: { products: products.n > 0, delivery: carriers.n > 0 || rates.n > 0, storeDesign: Boolean(shop?.design), pixels: pixels.n > 0 },
  };
}
