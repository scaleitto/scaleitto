import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeName, isBotAgent, isObviousBot, scoreOrder, type RiskSignals } from "../../src/features/checkout/risk";
import { resolveProtection } from "../../src/features/checkout/protection-settings";

const clean: RiskSignals = { returned: 0, cancelled: 0, delivered: 0, networkReturned: 0, fillSeconds: 40, minFillSeconds: 4, botAgent: false, name: "Amine Benali", phonesFromIp: 1 };

test("a normal order has no risk", () => {
  assert.deepEqual(scoreOrder(clean), { score: 0, reasons: [] });
});

test("each signal adds to the risk, with its reason; delivered orders lower it", () => {
  assert.deepEqual(scoreOrder({ ...clean, returned: 1 }), { score: 25, reasons: ["returned"] });
  assert.equal(scoreOrder({ ...clean, returned: 5 }).score, 50, "returns are capped");
  assert.deepEqual(scoreOrder({ ...clean, fillSeconds: 1 }).reasons, ["fast"]);
  assert.deepEqual(scoreOrder({ ...clean, fillSeconds: null }).reasons, ["noScript"]);
  assert.deepEqual(scoreOrder({ ...clean, networkReturned: 3 }), { score: 35, reasons: ["network"] });
  assert.deepEqual(scoreOrder({ ...clean, name: "aaaa1234" }).reasons, ["name"]);
  assert.deepEqual(scoreOrder({ ...clean, phonesFromIp: 3 }).reasons, ["sharedIp"]);
  const robot = scoreOrder({ ...clean, botAgent: true, fillSeconds: null, name: "xx" });
  assert.equal(robot.score, 100, "capped at 100");
  assert.equal(scoreOrder({ ...clean, returned: 1, delivered: 3 }).score, 0, "a customer who received parcels before is trusted");
});

test("names, robot browsers, obvious robots", () => {
  assert.equal(fakeName("سارة مراد"), false);
  assert.equal(fakeName("Yu"), true);
  assert.equal(fakeName("test test"), true);
  assert.equal(isBotAgent("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36"), false);
  assert.equal(isBotAgent("Mozilla/5.0 HeadlessChrome/130"), true);
  assert.equal(isBotAgent("python-requests/2.31"), true);
  assert.equal(isBotAgent(null), true);
  assert.equal(isObviousBot({ botAgent: false, fillSeconds: 2 }), false, "fast alone is a signal, not a refusal");
  assert.equal(isObviousBot({ botAgent: false, fillSeconds: null }), true);
});

test("protection settings: defaults, and invalid values replaced", () => {
  const d = resolveProtection(null);
  assert.equal(d.maxPerPhonePerDay, 3);
  assert.equal(d.riskThreshold, 50);
  const s = resolveProtection({ maxPerPhonePerDay: 0, riskThreshold: 70, holdSuspicious: true, blockBots: "yes" as never });
  assert.equal(s.maxPerPhonePerDay, 3);
  assert.equal(s.riskThreshold, 70);
  assert.equal(s.holdSuspicious, true);
  assert.equal(s.blockBots, true);
});
