// Pure analytics math (unit-tested): orders, items and abandoned carts in → numbers for the page out.
import { algeriaParts } from "@/lib/time";
import type { OrderStatus } from "@/server/db/schema";
import type { Range } from "./range";
import { PARCEL_STATUSES, isConfirmed, isPending, isRejected } from "@/features/orders/statuses";

export type OrderRow = { id: string; createdAt: Date; status: OrderStatus; subtotal: number; total: number; wilayaCode: number; landingPageId: string | null };
export type ItemRow = { orderId: string; productId: string | null; name: string; quantity: number; total: number; costPrice: number | null };
export type LeadRow = { createdAt: Date; status: string };

const REFUSED_COUNTED = new Set<OrderStatus>(["cancelled", "fake", "wrong_number"]);
export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

// cancelled = refusals that count against the confirmation rate (cancelled, fake order, wrong number);
// duplicates are the same customer's other order: counted apart, left out of the rates.
type Counts = { orders: number; confirmed: number; pending: number; cancelled: number; fake: number; duplicate: number; shipped: number; delivered: number; returned: number; revenue: number; total: number };
function counts(orders: OrderRow[]): Counts {
  const c: Counts = { orders: 0, confirmed: 0, pending: 0, cancelled: 0, fake: 0, duplicate: 0, shipped: 0, delivered: 0, returned: 0, revenue: 0, total: 0 };
  for (const o of orders) {
    c.orders++;
    c.total += o.total;
    if (isConfirmed(o.status)) c.confirmed++;
    if (isPending(o.status)) c.pending++;
    if (REFUSED_COUNTED.has(o.status)) c.cancelled++;
    if (o.status === "fake") c.fake++;
    if (o.status === "duplicate") c.duplicate++;
    if ((PARCEL_STATUSES as readonly OrderStatus[]).includes(o.status)) c.shipped++;
    if (o.status === "delivered") {
      c.delivered++;
      c.revenue += o.total;
    }
    if (o.status === "returned") c.returned++;
  }
  return c;
}

// Confirmation: confirmed ÷ orders the call center finished with (pending calls and duplicates are left out).
// Delivery: delivered ÷ parcels that reached an end (delivered or returned).
const rates = (c: Counts) => ({ confirmation: pct(c.confirmed, c.confirmed + c.cancelled), delivery: pct(c.delivered, c.delivered + c.returned) });

export function computeAnalytics(range: Range, allOrders: OrderRow[], items: ItemRow[], leads: LeadRow[]) {
  const inRange = (d: Date) => d >= range.start && d < range.end;
  const orders = allOrders.filter((o) => inRange(o.createdAt));
  const previous = allOrders.filter((o) => o.createdAt >= range.prevStart && o.createdAt < range.start);
  const c = counts(orders);
  const p = counts(previous);
  const ids = new Set(orders.map((o) => o.id));
  const byId = new Map(orders.map((o) => [o.id, o]));
  const myItems = items.filter((i) => ids.has(i.orderId));

  // Estimated profit on delivered orders: product price − cost price (only lines whose product has a cost)
  let profit = 0;
  let costMissing = false;
  for (const i of myItems) {
    if (byId.get(i.orderId)?.status !== "delivered") continue;
    if (i.costPrice == null) costMissing = true;
    else profit += i.total - i.costPrice * i.quantity;
  }

  const daily = new Map(range.days.map((d) => [d, { day: d, orders: 0, confirmed: 0, delivered: 0, revenue: 0 }]));
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0 }));
  for (const o of orders) {
    const parts = algeriaParts(o.createdAt);
    const d = daily.get(parts.day);
    if (d) {
      d.orders++;
      if (isConfirmed(o.status)) d.confirmed++;
      if (o.status === "delivered") {
        d.delivered++;
        d.revenue += o.total;
      }
    }
    hourly[Math.floor(parts.minutes / 60)].orders++;
  }

  const group = <K extends string | number>(key: (o: OrderRow) => K) => {
    const map = new Map<K, OrderRow[]>();
    for (const o of orders) map.set(key(o), [...(map.get(key(o)) ?? []), o]);
    return [...map.entries()].map(([k, list]) => {
      const g = counts(list);
      return { key: k, orders: g.orders, confirmed: g.confirmed, delivered: g.delivered, returned: g.returned, revenue: g.revenue, ...rates(g) };
    });
  };

  const products = new Map<string, { key: string; name: string; quantity: number; orders: Set<string>; delivered: number; revenue: number }>();
  for (const i of myItems) {
    const o = byId.get(i.orderId)!;
    if (isRejected(o.status)) continue;
    const key = i.productId ?? `name:${i.name}`;
    const row = products.get(key) ?? { key, name: i.name, quantity: 0, orders: new Set<string>(), delivered: 0, revenue: 0 };
    row.quantity += i.quantity;
    row.orders.add(o.id);
    if (o.status === "delivered") {
      row.delivered += i.quantity;
      row.revenue += i.total;
    }
    products.set(key, row);
  }

  const leadsIn = leads.filter((l) => inRange(l.createdAt));
  const recovered = leadsIn.filter((l) => l.status === "converted").length;
  const statuses = new Map<OrderStatus, number>();
  for (const o of orders) statuses.set(o.status, (statuses.get(o.status) ?? 0) + 1);

  return {
    totals: {
      ...c,
      ...rates(c),
      averageOrder: c.orders ? Math.round(c.total / c.orders) : 0,
      inDelivery: orders.filter((o) => o.status === "confirmed" || o.status === "shipped").reduce((s, o) => s + o.total, 0),
      profit,
      costMissing,
      leads: leadsIn.length,
      recovered,
      recoveryRate: pct(recovered, leadsIn.length),
    },
    previous: { orders: p.orders, revenue: p.revenue, ...rates(p) },
    funnel: { orders: c.orders, confirmed: c.confirmed, shipped: c.shipped, delivered: c.delivered },
    statuses: [...statuses.entries()].map(([status, n]) => ({ status, n })).sort((a, b) => b.n - a.n),
    daily: [...daily.values()],
    hourly,
    products: [...products.values()].map((r) => ({ ...r, orders: r.orders.size })).sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue).slice(0, 10),
    wilayas: group((o) => o.wilayaCode).sort((a, b) => b.orders - a.orders),
    sources: group((o) => o.landingPageId ?? "").sort((a, b) => b.orders - a.orders),
  };
}

export type Analytics = ReturnType<typeof computeAnalytics>;

// Change against the previous period, in % (null when there is nothing to compare)
export const change = (now: number | null, before: number | null) => (now == null || before == null || before === 0 ? null : Math.round(((now - before) / before) * 100));
