// Pure math of the Order analysis page (unit-tested, no database).
import type { OrderStatus } from "@/server/db/schema";
import { pct } from "@/features/analytics/compute";

export type InsightOrder = { id: string; status: OrderStatus; createdAt: Date; carrier: string | null; stage: string | null };
export type EventRow = { orderId: string; toStatus: string; at: Date };

const CONFIRMED: OrderStatus[] = ["confirmed", "shipped", "delivered", "returned"];
const PENDING: OrderStatus[] = ["new", "no_answer", "postponed"];

export function median(values: number[]) {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}
const round1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);

export function computeInsights(orders: InsightOrder[], events: EventRow[]) {
  const n = (statuses: OrderStatus[]) => orders.filter((o) => statuses.includes(o.status)).length;
  const confirmed = n(CONFIRMED);
  const cancelled = n(["cancelled"]);
  const delivered = n(["delivered"]);
  const returned = n(["returned"]);
  const pending = n(PENDING);
  const inTransit = n(["shipped"]);

  // Time between the steps (first time the order reached each one)
  const at = new Map<string, Partial<Record<string, Date>>>();
  for (const e of events) at.set(e.orderId, { ...at.get(e.orderId), [e.toStatus]: e.at });
  const hours = (a?: Date, b?: Date) => (a && b && b >= a ? (b.getTime() - a.getTime()) / 3_600_000 : null);
  const toConfirm: number[] = [];
  const toShip: number[] = [];
  const toDeliver: number[] = [];
  for (const o of orders) {
    const s = at.get(o.id) ?? {};
    const c = hours(o.createdAt, s.confirmed);
    const sh = hours(s.confirmed, s.shipped);
    const d = hours(s.shipped, s.delivered);
    if (c != null) toConfirm.push(c);
    if (sh != null) toShip.push(sh);
    if (d != null) toDeliver.push(d / 24);
  }

  // Couriers: parcels sent, delivered, returned, still on their way
  const carriers = new Map<string, { name: string; sent: number; delivered: number; returned: number; transit: number }>();
  for (const o of orders) {
    if (!o.carrier) continue;
    const c = carriers.get(o.carrier) ?? { name: o.carrier, sent: 0, delivered: 0, returned: 0, transit: 0 };
    c.sent++;
    if (o.status === "delivered") c.delivered++;
    else if (o.status === "returned") c.returned++;
    else if (o.status === "shipped") c.transit++;
    carriers.set(o.carrier, c);
  }

  return {
    orders: orders.length,
    pending,
    inTransit,
    rates: {
      confirmation: pct(confirmed, confirmed + cancelled),
      delivery: pct(delivered, delivered + returned),
      return: pct(returned, delivered + returned),
      cancel: pct(cancelled, orders.length),
    },
    timing: { confirmHours: round1(median(toConfirm)), shipHours: round1(median(toShip)), deliverDays: round1(median(toDeliver)) },
    carriers: [...carriers.values()].map((c) => ({ ...c, delivery: pct(c.delivered, c.delivered + c.returned) })).sort((a, b) => b.sent - a.sent),
  };
}

export type OrderInsights = ReturnType<typeof computeInsights>;
