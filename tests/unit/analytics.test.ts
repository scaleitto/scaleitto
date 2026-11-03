import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveRange } from "../../src/features/analytics/range";
import { change, computeAnalytics, type OrderRow } from "../../src/features/analytics/compute";

// 23:30 UTC on May 31st is already June 1st in Algeria
const now = new Date("2026-05-31T23:30:00Z");

test("periods are Algeria days, with a previous period of the same length", () => {
  const r = resolveRange({ period: "7d" }, now);
  assert.equal(r.fromDay, "2026-05-26");
  assert.equal(r.toDay, "2026-06-01");
  assert.equal(r.days.length, 7);
  assert.equal(r.start.toISOString(), "2026-05-25T23:00:00.000Z");
  assert.equal(r.prevStart.toISOString(), "2026-05-18T23:00:00.000Z");
  assert.deepEqual([resolveRange({ period: "yesterday" }, now).fromDay, resolveRange({ period: "month" }, now).fromDay], ["2026-05-31", "2026-06-01"]);
  assert.equal(resolveRange({ period: "nope" }, now).preset, "7d");
  // Last month: the whole of May, compared with the 31 days before it
  const lm = resolveRange({ period: "lastMonth" }, now);
  assert.deepEqual([lm.fromDay, lm.toDay, lm.days.length], ["2026-05-01", "2026-05-31", 31]);
  assert.equal(lm.end.toISOString(), "2026-05-31T23:00:00.000Z");
});

test("custom periods are ordered, end today at the latest and stay under a year", () => {
  const r = resolveRange({ period: "custom", from: "2026-06-20", to: "2026-05-10" }, now);
  assert.deepEqual([r.preset, r.fromDay, r.toDay], ["custom", "2026-05-10", "2026-06-01"]);
  assert.equal(resolveRange({ period: "custom", from: "2020-01-01", to: "2026-06-01" }, now).days.length, 366);
  assert.equal(resolveRange({ period: "custom", from: "bad", to: "2026-06-01" }, now).preset, "7d");
});

test("Zimam's tabs: orders (KPIs, days against the period before, statuses, funnel, insights, wilayas), products, impressions, agents", () => {
  const range = resolveRange({ period: "7d" }, now);
  const at = (iso: string) => new Date(iso);
  const order = (id: string, createdAt: string, status: OrderRow["status"], total: number, wilayaCode = 16, assignedTo: string | null = null): OrderRow => ({ id, createdAt: at(createdAt), status, total, wilayaCode, assignedTo });
  const orders = [
    order("a", "2026-05-31T23:10:00Z", "delivered", 5000, 16, "u1"), // June 1st, 00:10 in Algeria
    order("b", "2026-05-30T10:00:00Z", "returned", 4000, 31, "u1"),
    order("c", "2026-05-30T10:30:00Z", "cancelled", 3000, 31, "u1"),
    order("d", "2026-05-29T12:00:00Z", "in_transit", 2000, 16),
    order("e", "2026-05-28T12:00:00Z", "pending", 1000, 9),
    order("old", "2026-05-20T12:00:00Z", "delivered", 9000), // previous period
  ];
  const items = [
    { orderId: "a", productId: "p1", name: "Montre", quantity: 2, total: 4600 },
    { orderId: "b", productId: "p1", name: "Montre", quantity: 1, total: 3600 },
    { orderId: "c", productId: "p2", name: "Sac", quantity: 1, total: 2600 },
    { orderId: "d", productId: "p2", name: "Sac", quantity: 1, total: 1600 },
  ];
  const views = [
    { day: "2026-06-01", productId: "p1", source: "facebook.com", impressions: 30, visitors: 20 },
    { day: "2026-05-30", productId: "p2", source: "direct", impressions: 12, visitors: 10 },
    { day: "2026-05-20", productId: "p1", source: "direct", impressions: 5, visitors: 5 }, // previous period
  ];
  const catalog = [
    { id: "p1", name: "Montre", image: null },
    { id: "p2", name: "Sac", image: null },
  ];
  const r = computeAnalytics(range, orders, items, views, catalog, [{ userId: "u1", name: "Amina" }], now);
  const o = r.orders;
  assert.deepEqual([o.kpis.orders.value, o.kpis.orders.previous, o.kpis.sales.value, o.kpis.delivery.value, o.kpis.avgDaily.value], [5, 1, 15000, 50, 0.7]);
  assert.equal(o.daily.at(-1)?.orders, 1);
  assert.equal(o.daily.reduce((s, d) => s + d.previous, 0), 1);
  assert.deepEqual(Object.fromEntries(o.statuses.filter((s) => s.n).map((s) => [s.status, s.n])), { pending: 1, in_transit: 1, delivered: 1, returned: 1, cancelled: 1 });
  assert.deepEqual(o.funnel.map((s) => [s.n, s.rate]), [[5, 100], [3, 60], [3, 100], [1, 33.3]]);
  assert.deepEqual(o.insights.map((i) => i.key), ["pending", "dropoff", "waiting", "noConfirm"]);
  assert.deepEqual(o.insights[1].values, { from: "orders", to: "confirmed", fromN: 5, toN: 3 }); // a tie keeps the earliest stage
  assert.deepEqual(o.wilayas.map((w) => [w.code, w.orders, w.confirmed, w.returnRate]), [[16, 2, 2, 0], [31, 2, 1, 100], [9, 1, 0, null]]);
  const p = r.products;
  assert.deepEqual([p.kpis.products, p.kpis.visitors, p.kpis.orders, p.kpis.orderRate], [2, 30, 5, 16.7]);
  assert.deepEqual(p.rows.map((x) => [x.id, x.visitors, x.orders, x.orderRate, x.deliveryRate]), [["p1", 20, 2, 10, 50], ["p2", 10, 2, 20, null]]);
  assert.deepEqual(p.bands, { excellent: 2, good: 0, low: 0 });
  const im = r.impressions;
  assert.deepEqual([im.kpis.impressions.value, im.kpis.impressions.previous, im.kpis.visitors.value], [42, 5, 30]);
  assert.deepEqual(im.sources.map((s) => [s.source, s.visitors]), [["facebook.com", 20], ["direct", 10]]);
  assert.deepEqual(r.team.map((a) => [a.name, a.assigned, a.confirmed, a.cancelled, a.confirmation, a.delivery]), [["Amina", 3, 2, 1, 66.7, 50]]);
  assert.equal(change(150, 100), 50);
  assert.equal(change(5, 0), null);
});
