import { test } from "node:test";
import assert from "node:assert/strict";
import { customFieldValid, resolveForm } from "../../src/features/landing/types";


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

