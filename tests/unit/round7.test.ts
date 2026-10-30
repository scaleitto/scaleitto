import { test } from "node:test";
import assert from "node:assert/strict";
import { computeInsights, median } from "../../src/features/analytics/insights-math";
import { stockRows, stockTotals } from "../../src/features/inventory/stock";
import { computeFinance } from "../../src/features/finance/compute";
import { customFieldValid, resolveForm } from "../../src/features/landing/types";

const h = (n: number) => new Date(Date.UTC(2026, 9, 1) + n * 3_600_000);

test("order analysis: rates, step times (median) and couriers", () => {
  const orders = [
    { id: "a", status: "delivered" as const, createdAt: h(0), carrier: "Yalidine", stage: "delivered" },
    { id: "b", status: "returned" as const, createdAt: h(0), carrier: "Yalidine", stage: "returned" },
    { id: "c", status: "cancelled" as const, createdAt: h(0), carrier: null, stage: null },
    { id: "d", status: "pending" as const, createdAt: h(0), carrier: null, stage: null },
    { id: "e", status: "in_transit" as const, createdAt: h(0), carrier: "ZR", stage: "pickup" },
  ];
  const events = [
    { orderId: "a", toStatus: "confirmed", at: h(2) },
    { orderId: "a", toStatus: "in_transit", at: h(5) },
    { orderId: "a", toStatus: "delivered", at: h(53) },
    { orderId: "b", toStatus: "confirmed", at: h(4) },
    { orderId: "e", toStatus: "confirmed", at: h(6) },
  ];
  const r = computeInsights(orders, events);
  assert.equal(r.orders, 5);
  assert.equal(r.pending, 1);
  assert.equal(r.inTransit, 1);
  assert.equal(r.rates.confirmation, 75); // 3 ÷ (3 + 1)
  assert.equal(r.rates.delivery, 50);
  assert.equal(r.rates.return, 50);
  assert.equal(r.rates.cancel, 20);
  assert.equal(r.timing.confirmHours, 4); // 2, 4, 6
  assert.equal(r.timing.shipHours, 3);
  assert.equal(r.timing.deliverDays, 2);
  assert.deepEqual(r.carriers[0], { name: "Yalidine", sent: 2, delivered: 1, returned: 1, transit: 0, delivery: 50 });
  assert.equal(median([]), null);
});

test("inventory: one line per variant, held units, value, alerts first", () => {
  const products = [
    { id: "p1", name: "Montre", sku: "M", stock: 0, costPrice: 1000, price: 3000, trackStock: true, images: [], status: "active" },
    { id: "p2", name: "Sac", sku: null, stock: 3, costPrice: null, price: 2000, trackStock: true, images: [], status: "active" },
    { id: "p3", name: "Service", sku: null, stock: 0, costPrice: null, price: 500, trackStock: false, images: [], status: "active" },
  ];
  const variants = [
    { id: "v1", productId: "p1", title: "Noir", sku: null, stock: 10, price: null },
    { id: "v2", productId: "p1", title: "Rouge", sku: "MR", stock: 0, price: null },
  ];
  const rows = stockRows(products, variants, [{ productId: "p1", variantId: "v1", n: 2 }], 5);
  assert.deepEqual(rows.map((r) => [r.key, r.state]), [["v2", "out"], ["p2", "low"], ["v1", "ok"]]);
  assert.equal(rows.find((r) => r.key === "v1")!.held, 2);
  assert.equal(rows.find((r) => r.key === "v1")!.value, 10_000);
  assert.equal(rows.find((r) => r.key === "v2")!.sku, "MR");
  const t = stockTotals(rows);
  assert.deepEqual([t.lines, t.units, t.held, t.value, t.valueMissing, t.low, t.out], [3, 13, 2, 10_000, true, 1, 1]);
});

test("finance: delivered products − cost − expenses", () => {
  const f = computeFinance(
    [
      { id: "a", status: "delivered", subtotal: 5000, shippingPrice: 400, total: 5400, paidAt: null },
      { id: "b", status: "delivered", subtotal: 3000, shippingPrice: 0, total: 3000, paidAt: new Date() },
      { id: "c", status: "returned", subtotal: 9000, shippingPrice: 400, total: 9400, paidAt: null },
    ],
    [
      { orderId: "a", quantity: 2, costPrice: 1000 },
      { orderId: "b", quantity: 1, costPrice: null },
      { orderId: "c", quantity: 1, costPrice: 4000 },
    ],
    [
      { category: "ads", amount: 2000 },
      { category: "packaging", amount: 500 },
      { category: "ads", amount: 1000 },
    ],
  );
  assert.equal(f.delivered, 2);
  assert.equal(f.sales, 8000);
  assert.equal(f.cashIn, 8400);
  assert.equal(f.cost, 2000);
  assert.ok(f.costMissing);
  assert.equal(f.expenses, 3500);
  assert.equal(f.net, 2500);
  assert.equal(f.margin, 31.3);
  assert.equal(f.perOrder, 1250);
  assert.equal(f.costPerDelivered, 1750);
  assert.deepEqual(f.categories, [{ category: "ads", amount: 3000 }, { category: "packaging", amount: 500 }]);
});

test("order form: new field types are checked, blocks kept in the order, stepper", () => {
  assert.ok(customFieldValid({ type: "email", options: [] }, "a@b.dz"));
  assert.ok(!customFieldValid({ type: "email", options: [] }, "nope"));
  assert.ok(customFieldValid({ type: "number", options: [] }, "42,5"));
  assert.ok(!customFieldValid({ type: "number", options: [] }, "4a"));
  assert.ok(customFieldValid({ type: "radio", options: ["S", "M"] }, "M"));
  assert.ok(!customFieldValid({ type: "radio", options: ["S", "M"] }, "XL"));
  assert.ok(!customFieldValid({ type: "date", options: [] }, "1/2/2026"));
  const f = resolveForm({
    stepper: true,
    custom: [{ id: "r1", label: "Taille", type: "radio", options: ["S", "M"] }, { id: "r2", label: "Bad", type: "radio", options: ["S"] }],
    blocks: [{ id: "b1", kind: "heading", text: "Vos infos" }, { id: "b2", kind: "image", image: "javascript:alert(1)" }, { id: "b3", kind: "divider" }],
    order: ["el:b1", "name", "phone"],
  });
  assert.ok(f.stepper);
  assert.deepEqual(f.custom.map((c) => c.id), ["r1"]);
  assert.deepEqual(f.blocks.map((b) => b.id), ["b1", "b3"]);
  assert.equal(f.order[0], "el:b1");
  assert.ok(f.order.indexOf("el:b3") < f.order.indexOf("summary"));
});
