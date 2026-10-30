import { test } from "node:test";
import assert from "node:assert/strict";
import { orderModel } from "../../src/features/orders/statuses";
import { fillRecovery, recoveryTemplates, suggestedStep } from "../../src/features/orders/recovery";

const order = (status: Parameters<typeof orderModel>[0]["status"], extra: Partial<Parameters<typeof orderModel>[0]> = {}) => orderModel({ status, deliveryState: null, deliveryFault: null, processing: null, ...extra });

test("the order's five sections: a sent order stays confirmed, injection only once confirmed, final = delivered / returned", () => {
  assert.deepEqual(order("no_answer"), { call: "no_answer", injection: null, delivery: null, fault: null, processing: null, final: null });
  assert.equal(order("confirmed").injection, "pending");
  const sent = order("shipped", { deliveryState: "postponed", deliveryFault: "customer", processing: "claim" });
  assert.deepEqual(sent, { call: "confirmed", injection: "done", delivery: "postponed", fault: "customer", processing: "claim", final: null });
  assert.equal(order("returned", { deliveryState: "returned" }).final, "returned");
  assert.equal(order("delivered").call, "confirmed");
});

test("abandoned carts: call fresh carts, message older ones, offer to those contacted; messages filled", () => {
  assert.equal(suggestedStep({ status: "abandoned", hoursAgo: 1 }), "call");
  assert.equal(suggestedStep({ status: "abandoned", hoursAgo: 30 }), "message");
  assert.equal(suggestedStep({ status: "contacted", hoursAgo: 1 }), "offer");
  const text = fillRecovery(recoveryTemplates.ar.offer, { name: "ليلى", product: "مصباح", link: "https://x/p/lamp", store: "متجري", offer: "توصيل مجاني" });
  assert.ok(text.includes("ليلى") && text.includes("توصيل مجاني") && text.includes("https://x/p/lamp") && !text.includes("{"));
});
