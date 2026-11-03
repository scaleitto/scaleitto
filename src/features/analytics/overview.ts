import "server-only";
import { and, count, desc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { addDays, algeriaParts } from "@/lib/time";
import { CONFIRMED_STATUSES, PENDING_STATUSES } from "@/features/orders/statuses";
import { dayStart, resolveRange } from "./range";

// Zimam's two dropdowns: the period of the four numbers, and the sales chart's range
export const overviewPeriods = ["today", "yesterday", "7d", "30d", "month", "lastMonth"] as const;
export type OverviewPeriod = (typeof overviewPeriods)[number];
export const chartRanges = ["7d", "30d", "month", "lastMonth"] as const;
export type ChartRange = (typeof chartRanges)[number];
const pct = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 100) : null);
// Minutes a task usually takes (the "≈ 5 min" of each card): a call per waiting order, a quick look otherwise
const MINUTES = { pending: 5, toShip: 5, flagged: 3 } as const;

// The dashboard home (Zimam's): the chosen period against the same length before it, the sales chart (7 or 30 days),
// best sellers, the latest orders, what is waiting on the merchant and the four set-up steps.
export async function overviewData(shopId: string, period: OverviewPeriod, chart: ChartRange, now = new Date()) {
  const o = schema.orders;
  const today = algeriaParts(now).day;
  const range = resolveRange({ period }, now);
  const { start, end, prevStart } = range;
  const chartRange = resolveRange({ period: chart }, now);
  const { start: chartStart, prevStart: chartPrevStart } = chartRange;
  const real = and(eq(o.shopId, shopId), ne(o.status, "abandoned"));
  const weekday = algeriaParts(now).weekday;
  const lastWeekStart = dayStart(addDays(today, -weekday - 7));
  const since = new Date(Math.min(prevStart.getTime(), chartPrevStart.getTime(), lastWeekStart.getTime()));
  const [orders, sold, products, latest, [pending], [toShip], [flagged], [carriers], [pixels], [pages]] = await Promise.all([
    db.select({ createdAt: o.createdAt, status: o.status, total: o.total }).from(o).where(and(real, gte(o.createdAt, since))),
    db
      .select({ productId: schema.orderItems.productId, orders: sql<number>`count(distinct ${o.id})`, revenue: sql<number>`sum(${schema.orderItems.total})` })
      .from(schema.orderItems)
      .innerJoin(o, eq(o.id, schema.orderItems.orderId))
      .where(and(real, gte(o.createdAt, start), lt(o.createdAt, end)))
      .groupBy(schema.orderItems.productId),
    db.select({ id: schema.products.id, name: schema.products.name, sku: schema.products.sku, slug: schema.products.slug, images: schema.products.images }).from(schema.products).where(eq(schema.products.shopId, shopId)).orderBy(desc(schema.products.createdAt)),
    db
      .select({ id: o.id, number: o.number, customerName: o.customerName, total: o.total, status: o.status, createdAt: o.createdAt, locked: o.locked, wilaya: o.wilayaCode, items: sql<number>`(select coalesce(sum(oi.quantity), 0) from order_items oi where oi.order_id = orders.id)` })
      .from(o)
      .where(real)
      .orderBy(desc(o.createdAt))
      .limit(5),
    db.select({ n: count() }).from(o).where(and(eq(o.shopId, shopId), inArray(o.status, [...PENDING_STATUSES]))),
    db.select({ n: count() }).from(o).where(and(eq(o.shopId, shopId), eq(o.status, "confirmed"))),
    db.select({ n: count() }).from(o).where(and(eq(o.shopId, shopId), eq(o.status, "flagged"))),
    db.select({ n: count() }).from(schema.carrierAccounts).where(eq(schema.carrierAccounts.shopId, shopId)),
    db.select({ n: count() }).from(schema.pixels).where(eq(schema.pixels.shopId, shopId)),
    db.select({ n: count() }).from(schema.landingPages).where(and(eq(schema.landingPages.shopId, shopId), eq(schema.landingPages.status, "published"))),
  ]);

  const between = (from: Date, to: Date) => orders.filter((r) => r.createdAt >= from && r.createdAt < to);
  const cur = between(start, end);
  const prev = between(prevStart, start);
  const isConfirmed = (s: string) => (CONFIRMED_STATUSES as readonly string[]).includes(s);
  const figures = (list: typeof orders) => ({
    orders: list.length,
    sales: list.reduce((s, r) => s + r.total, 0),
    confirmed: list.filter((r) => isConfirmed(r.status)).length,
    delivered: list.filter((r) => r.status === "delivered").length,
    pending: list.filter((r) => (PENDING_STATUSES as readonly string[]).includes(r.status)).length,
    cancelled: list.filter((r) => r.status === "cancelled").length,
    returned: list.filter((r) => r.status === "returned").length,
  });
  const now_ = figures(cur);
  const before = figures(prev);
  const chartDays = chartRange.days.map((day) => ({ day, sales: orders.filter((r) => algeriaParts(r.createdAt).day === day).reduce((s, r) => s + r.total, 0) }));
  const chartTotal = chartDays.reduce((s, d) => s + d.sales, 0);
  const chartPrev = between(chartPrevStart, chartStart).reduce((s, r) => s + r.total, 0);

  // Best sellers: the products with the most orders in the period, then the ones not selling yet
  const byProduct = new Map(sold.map((r) => [r.productId, { orders: Number(r.orders), revenue: Number(r.revenue) }]));
  const best = products
    .map((p) => ({ id: p.id, name: p.name, sku: p.sku || `PRD-${p.slug.toUpperCase().slice(0, 12)}`, image: p.images[0] ?? null, ...(byProduct.get(p.id) ?? { orders: 0, revenue: 0 }) }))
    .sort((a, b) => b.orders - a.orders || b.revenue - a.revenue)
    .slice(0, 5);

  const tasks = [
    pending.n > 0 && { key: "pending" as const, n: pending.n, minutes: MINUTES.pending },
    toShip.n > 0 && { key: "toShip" as const, n: toShip.n, minutes: MINUTES.toShip },
    flagged.n > 0 && { key: "flagged" as const, n: flagged.n, minutes: MINUTES.flagged },
  ].filter((x) => x !== false);
  const todayOrders = between(dayStart(today), dayStart(addDays(today, 1))).length;
  // The good news under the tasks: orders the store received last week (Sunday to Saturday, Algeria)
  const lastWeek = between(lastWeekStart, dayStart(addDays(today, -weekday))).length;

  return {
    todayOrders,
    kpis: {
      orders: { value: now_.orders, change: pct(now_.orders, before.orders), sub: now_.pending },
      sales: { value: now_.sales, change: pct(now_.sales, before.sales), sub: now_.orders ? Math.round(now_.sales / now_.orders) : 0 },
      confirmed: { value: now_.confirmed, change: pct(now_.confirmed, before.confirmed), sub: now_.cancelled },
      delivered: { value: now_.delivered, change: pct(now_.delivered, before.delivered), sub: now_.returned },
    },
    chart: { days: chartDays, total: chartTotal, previous: chartPrev, change: pct(chartTotal, chartPrev) },
    best,
    latest: latest.map((r) => ({ ...r, items: Number(r.items), customerName: r.locked ? "" : r.customerName })),
    tasks,
    minutes: tasks.reduce((s, x) => s + x.minutes, 0),
    lastWeek,
    steps: { pixels: pixels.n > 0, products: products.length >= 10, delivery: carriers.n > 0, landing: pages.n > 0 },
  };
}
export type OverviewData = Awaited<ReturnType<typeof overviewData>>;
