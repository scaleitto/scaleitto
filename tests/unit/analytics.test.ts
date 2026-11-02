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
  assert.equal(resolveRange({ period: "nope" }, now).preset, "30d");
});

test("custom periods are ordered, end today at the latest and stay under a year", () => {
  const r = resolveRange({ period: "custom", from: "2026-06-20", to: "2026-05-10" }, now);
  assert.deepEqual([r.preset, r.fromDay, r.toDay], ["custom", "2026-05-10", "2026-06-01"]);
  assert.equal(resolveRange({ period: "custom", from: "2020-01-01", to: "2026-06-01" }, now).days.length, 366);
  assert.equal(resolveRange({ period: "custom", from: "bad", to: "2026-06-01" }, now).preset, "30d");
});

test("rates, money, profit, days, hours, products, wilayas and sources", () => {
  const range = resolveRange({ period: "7d" }, now);
  const at = (iso: string) => new Date(iso);
  const order = (id: string, createdAt: string, status: OrderRow["status"], total: number, wilayaCode = 16, landingPageId: string | null = null): OrderRow => ({ id, createdAt: at(createdAt), status, subtotal: total - 400, total, wilayaCode, landingPageId });
  const orders = [
    order("a", "2026-05-31T23:10:00Z", "delivered", 5000), // June 1st, 00:10 in Algeria
    order("b", "2026-05-30T10:00:00Z", "returned", 4000, 31),
    order("c", "2026-05-30T10:30:00Z", "cancelled", 3000, 31, "lp1"),
    order("d", "2026-05-29T12:00:00Z", "in_transit", 2000, 16, "lp1"),
    order("e", "2026-05-28T12:00:00Z", "pending", 1000),
    order("old", "2026-05-20T12:00:00Z", "delivered", 9000), // previous period
  ];
  const items = [
    { orderId: "a", productId: "p1", name: "Montre", quantity: 2, total: 4600 },
    { orderId: "b", productId: "p1", name: "Montre", quantity: 1, total: 3600 },
    { orderId: "c", productId: "p2", name: "Sac", quantity: 1, total: 2600 },
    { orderId: "d", productId: "p2", name: "Sac", quantity: 1, total: 1600 },
  ];
  const leads = [
    { createdAt: at("2026-05-30T09:00:00Z"), status: "converted" },
    { createdAt: at("2026-05-30T09:00:00Z"), status: "abandoned" },
    { createdAt: at("2026-05-01T09:00:00Z"), status: "converted" },
  ];
  const r = computeAnalytics(range, orders, items, leads);
  assert.equal(r.totals.orders, 5);
  assert.equal(r.totals.confirmation, 75); // a, b, d confirmed ÷ (3 + 1 cancelled)
  assert.equal(r.totals.delivery, 50); // a delivered ÷ (a + b returned)
  assert.equal(r.totals.pending, 1);
  assert.equal(r.totals.revenue, 5000);
  assert.equal(r.totals.inDelivery, 2000);
  assert.equal(r.totals.averageOrder, 3000);
  assert.deepEqual([r.totals.leads, r.totals.recovered, r.totals.recoveryRate], [2, 1, 50]);
  assert.deepEqual([r.previous.orders, r.previous.revenue], [1, 9000]);
  assert.deepEqual(r.funnel, { orders: 5, confirmed: 3, shipped: 3, delivered: 1 });
  assert.equal(r.daily.length, 7);
  assert.deepEqual(r.daily.at(-1), { day: "2026-06-01", orders: 1, confirmed: 1, delivered: 1, revenue: 5000 });
  assert.equal(r.hourly[0].orders, 1);
  assert.equal(r.hourly[11].orders, 2);
  assert.deepEqual(r.products.map((p) => [p.name, p.quantity, p.orders, p.delivered, p.revenue]), [["Montre", 3, 2, 2, 4600], ["Sac", 1, 1, 0, 0]]);
  assert.deepEqual(r.wilayas.map((w) => [w.key, w.orders, w.confirmation]), [[16, 3, 100], [31, 2, 50]]);
  assert.deepEqual(r.sources.map((s) => [s.key, s.orders]), [["", 3], ["lp1", 2]]);
  assert.equal(change(150, 100), 50);
  assert.equal(change(5, 0), null);
});
