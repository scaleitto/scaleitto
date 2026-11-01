import { test } from "node:test";
import assert from "node:assert/strict";
import { computeInsights, median } from "../../src/features/analytics/insights-math";
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

