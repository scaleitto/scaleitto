// Pure analytics math (unit-tested), Zimam's four tabs: orders, products, impressions and the call center.
// Orders, their items, store visits and agents come in; the numbers each tab draws come out.
import { algeriaParts } from "@/lib/time";
import type { OrderStatus } from "@/server/db/schema";
import type { Range } from "./range";
import { PARCEL_STATUSES, REFUSED_STATUSES, isConfirmed, isPending } from "@/features/orders/statuses";

export type OrderRow = { id: string; createdAt: Date; status: OrderStatus; total: number; wilayaCode: number; assignedTo: string | null };
export type ItemRow = { orderId: string; productId: string | null; name: string; quantity: number; total: number };
export type ViewRow = { day: string; productId: string; source: string; impressions: number; visitors: number };
export type ProductInfo = { id: string; name: string; image: string | null };
export type AgentInfo = { userId: string; name: string };

export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
// Change against the previous period, in % (null when there is nothing to compare)
export const change = (now: number | null, before: number | null) => (now == null || before == null || before === 0 ? null : Math.round(((now - before) / before) * 100));

// The statuses of the distribution chart, in the order of an order's life (abandoned checkouts are not orders)
export const distributionStatuses = ["pending", "call_back", "confirmed", "in_transit", "delivered", "returned", "cancelled", "flagged"] as const satisfies readonly OrderStatus[];
const SHIPPED = new Set<OrderStatus>(PARCEL_STATUSES);
const REFUSED = new Set<OrderStatus>(REFUSED_STATUSES);
// A product's order rate: excellent from 5%, good from 1% (Zimam's tip: under 1% needs better visuals or pricing)
export const rateBand = (rate: number | null) => (rate == null ? null : rate >= 5 ? "excellent" : rate >= 1 ? "good" : "low");

const deliveryRate = (list: OrderRow[]) => {
  const delivered = list.filter((o) => o.status === "delivered").length;
  return pct(delivered, delivered + list.filter((o) => o.status === "returned").length);
};
const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeAnalytics(range: Range, allOrders: OrderRow[], items: ItemRow[], views: ViewRow[], catalog: ProductInfo[], agents: AgentInfo[], now = new Date()) {
  const days = range.days.length;
  const inRange = (d: Date) => d >= range.start && d < range.end;
  const orders = allOrders.filter((o) => inRange(o.createdAt));
  const previous = allOrders.filter((o) => o.createdAt >= range.prevStart && o.createdAt < range.start);
  const prevDays = new Set<string>();
  for (let i = 0; i < days; i++) prevDays.add(new Date(range.prevStart.getTime() + i * 86_400_000 + 3_600_000).toISOString().slice(0, 10));
  const viewsNow = views.filter((v) => v.day >= range.fromDay && v.day <= range.toDay);
  const viewsBefore = views.filter((v) => prevDays.has(v.day));
  const dayOf = (d: Date) => algeriaParts(d).day;
  const index = new Map(range.days.map((d, i) => [d, i]));
  const prevIndex = (d: Date) => Math.floor((d.getTime() - range.prevStart.getTime()) / 86_400_000);

  // ── Orders ─────────────────────────────────────────
  const daily = range.days.map((day) => ({ day, orders: 0, previous: 0, sales: 0, delivered: 0, returned: 0 }));
  for (const o of orders) {
    const d = daily[index.get(dayOf(o.createdAt)) ?? -1];
    if (!d) continue;
    d.orders++;
    d.sales += o.total;
    if (o.status === "delivered") d.delivered++;
    if (o.status === "returned") d.returned++;
  }
  for (const o of previous) {
    const d = daily[prevIndex(o.createdAt)];
    if (d) d.previous++;
  }
  const sales = (list: OrderRow[]) => list.reduce((s, o) => s + o.total, 0);
  const kpis = {
    orders: { value: orders.length, previous: previous.length },
    sales: { value: sales(orders), previous: sales(previous) },
    delivery: { value: deliveryRate(orders), previous: deliveryRate(previous) },
    avgDaily: { value: round1(orders.length / days), previous: round1(previous.length / days) },
  };
  const statuses = distributionStatuses.map((status) => ({ status, n: orders.filter((o) => o.status === status).length }));
  const confirmed = orders.filter((o) => isConfirmed(o.status)).length;
  const shipped = orders.filter((o) => SHIPPED.has(o.status)).length;
  const delivered = orders.filter((o) => o.status === "delivered").length;
  const funnel = [
    { key: "orders" as const, n: orders.length },
    { key: "confirmed" as const, n: confirmed },
    { key: "shipped" as const, n: shipped },
    { key: "delivered" as const, n: delivered },
  ].map((s, i, all) => ({ ...s, rate: i === 0 ? (s.n ? 100 : null) : pct(s.n, all[i - 1].n) }));

  const wilayaMap = new Map<number, OrderRow[]>();
  for (const o of orders) wilayaMap.set(o.wilayaCode, [...(wilayaMap.get(o.wilayaCode) ?? []), o]);
  const wilayas = [...wilayaMap.entries()]
    .map(([code, list]) => {
      const done = list.filter((o) => o.status === "delivered" || o.status === "returned").length;
      return { code, orders: list.length, confirmed: list.filter((o) => isConfirmed(o.status)).length, delivered: list.filter((o) => o.status === "delivered").length, returnRate: pct(list.filter((o) => o.status === "returned").length, done) };
    })
    .sort((a, b) => b.orders - a.orders);

  // Key insights: what is waiting, where orders are lost, which wilayas never confirm
  const pending = orders.filter((o) => isPending(o.status)).length;
  const insights: { key: "pending" | "dropoff" | "waiting" | "noConfirm"; values: Record<string, string | number> }[] = [];
  if (pending) insights.push({ key: "pending", values: { rate: pct(pending, orders.length) ?? 0, n: pending, total: orders.length } });
  const drops = funnel.slice(1).map((s, i) => ({ from: funnel[i].key, to: s.key, lost: funnel[i].n - s.n, fromN: funnel[i].n, toN: s.n })).filter((d) => d.lost > 0);
  const worst = drops.sort((a, b) => b.lost - a.lost)[0];
  if (worst) insights.push({ key: "dropoff", values: { from: worst.from, to: worst.to, fromN: worst.fromN, toN: worst.toN } });
  const stale = orders.filter((o) => o.status === "pending" && now.getTime() - o.createdAt.getTime() > 2 * 3_600_000).length;
  if (stale) insights.push({ key: "waiting", values: { n: stale } });
  const noConfirm = wilayas.filter((w) => w.confirmed === 0);
  if (noConfirm.length) insights.push({ key: "noConfirm", values: { n: noConfirm.length, codes: noConfirm.slice(0, 5).map((w) => w.code).join(",") } });

  // ── Products ───────────────────────────────────────
  const byId = new Map(orders.map((o) => [o.id, o]));
  const productOrders = new Map<string, Set<string>>();
  for (const i of items) {
    if (!i.productId || !byId.has(i.orderId)) continue;
    productOrders.set(i.productId, (productOrders.get(i.productId) ?? new Set()).add(i.orderId));
  }
  const visitorsOf = (list: ViewRow[], productId?: string) => list.filter((v) => (productId == null ? true : v.productId === productId)).reduce((s, v) => s + v.visitors, 0);
  const products = catalog
    .map((p) => {
      const ids = [...(productOrders.get(p.id) ?? [])];
      const list = ids.map((id) => byId.get(id)!);
      const visitors = visitorsOf(viewsNow, p.id);
      const spark = range.days.map(() => 0);
      for (const o of list) {
        const k = index.get(dayOf(o.createdAt));
        if (k != null) spark[k]++;
      }
      return { ...p, visitors, orders: list.length, orderRate: pct(list.length, visitors), deliveryRate: deliveryRate(list), spark };
    })
    .sort((a, b) => b.orders - a.orders || b.visitors - a.visitors);
  const totalVisitors = visitorsOf(viewsNow);
  const bands = { excellent: 0, good: 0, low: 0 };
  for (const p of products) {
    const band = rateBand(p.orderRate);
    if (band) bands[band]++;
  }
  const productDaily = range.days.map((day) => {
    const v = viewsNow.filter((x) => x.day === day).reduce((s, x) => s + x.visitors, 0);
    const n = orders.filter((o) => dayOf(o.createdAt) === day).length;
    return { day, visitors: v, orders: n, rate: pct(n, v) ?? 0 };
  });

  // ── Impressions ────────────────────────────────────
  const sum = (list: ViewRow[], key: "impressions" | "visitors") => list.reduce((s, v) => s + v[key], 0);
  const sourceMap = new Map<string, number>();
  for (const v of viewsNow) sourceMap.set(v.source || "direct", (sourceMap.get(v.source || "direct") ?? 0) + v.visitors);
  const sources = [...sourceMap.entries()].map(([source, visitors]) => ({ source, visitors, share: pct(visitors, totalVisitors) ?? 0 })).sort((a, b) => b.visitors - a.visitors);
  const impressionsDaily = range.days.map((day) => {
    const list = viewsNow.filter((v) => v.day === day);
    return { day, impressions: sum(list, "impressions"), visitors: sum(list, "visitors") };
  });

  // ── Call center ────────────────────────────────────
  const team = agents
    .map((a) => {
      const list = orders.filter((o) => o.assignedTo === a.userId);
      const conf = list.filter((o) => isConfirmed(o.status)).length;
      const refused = list.filter((o) => REFUSED.has(o.status)).length;
      return { ...a, assigned: list.length, confirmed: conf, cancelled: refused, pending: list.filter((o) => isPending(o.status)).length, confirmation: pct(conf, conf + refused), delivery: deliveryRate(list) };
    })
    .sort((a, b) => b.assigned - a.assigned);

  return {
    orders: { kpis, daily, statuses, total: orders.length, funnel, insights, wilayas },
    products: {
      kpis: { products: catalog.length, visitors: totalVisitors, orders: orders.length, orderRate: pct(orders.length, totalVisitors), avgDaily: kpis.avgDaily.value },
      daily: productDaily,
      bands,
      rows: products,
    },
    impressions: {
      kpis: {
        impressions: { value: sum(viewsNow, "impressions"), previous: sum(viewsBefore, "impressions") },
        visitors: { value: totalVisitors, previous: sum(viewsBefore, "visitors") },
        orderRate: { value: pct(orders.length, totalVisitors), previous: pct(previous.length, sum(viewsBefore, "visitors")) },
      },
      sources,
      daily: impressionsDaily,
    },
    team,
  };
}

export type Analytics = ReturnType<typeof computeAnalytics>;
