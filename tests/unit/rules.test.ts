import { test } from "node:test";
import assert from "node:assert/strict";
import { inWindow, matchAgentRules, matchDeliveryRule, resolveAgentRules, resolveDeliveryRules } from "../../src/features/apps/rules";

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

test("delivery rules: first active match by wilaya, total and type", () => {
  const rules = resolveDeliveryRules([
    { id: id(1), name: "off", active: false, carrierAccountId: id(7), wilayas: [], deliveryType: "any" },
    { id: id(2), name: "Alger big", carrierAccountId: id(8), wilayas: [16], minTotal: 5000, deliveryType: "home" },
    { id: id(3), name: "rest", carrierAccountId: id(9), wilayas: [], deliveryType: "any" },
    { id: "bad", carrierAccountId: id(9) },
  ]);
  assert.equal(rules.length, 3);
  assert.equal(matchDeliveryRule(rules, { wilaya: 16, total: 6000, deliveryType: "home" }), id(8));
  assert.equal(matchDeliveryRule(rules, { wilaya: 16, total: 6000, deliveryType: "office" }), id(9));
  assert.equal(matchDeliveryRule(rules, { wilaya: 31, total: 100, deliveryType: "home" }), id(9));
  assert.equal(matchDeliveryRule([], { wilaya: 31, total: 100, deliveryType: "home" }), null);
});

test("agent rules: product, wilaya, source and time window (overnight too)", () => {
  assert.ok(inWindow("22:00", "06:00", 23 * 60) && inWindow("22:00", "06:00", 60) && !inWindow("22:00", "06:00", 12 * 60));
  assert.ok(inWindow("", "", 0) && inWindow("09:00", "", 10 * 60) && !inWindow("09:00", "", 8 * 60));
  const rules = resolveAgentRules([
    { id: id(1), agentId: id(5), productIds: [id(2)], source: "landing" },
    { id: id(3), agentId: id(6), wilayas: [16], from: "08:00", to: "16:00" },
    { id: id(4), agentId: id(7), source: "nonsense" },
  ]);
  assert.equal(rules[2].source, "any");
  assert.deepEqual(matchAgentRules(rules, { productIds: [id(2)], wilaya: 16, minutes: 9 * 60, source: "landing" }), [id(5), id(6), id(7)]);
  assert.deepEqual(matchAgentRules(rules, { productIds: [id(2)], wilaya: 31, minutes: 20 * 60, source: "store" }), [id(7)]);
});
