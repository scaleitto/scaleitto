import { test } from "node:test";
import assert from "node:assert/strict";
import { CONFIRMED_STATUSES, PENDING_STATUSES, REJECTED_STATUSES, callStatuses, holdsStock, orderStatuses } from "../../src/features/orders/statuses";
import { stageNames, stageShipments, trackingStages } from "../../src/features/orders/views";
import { computeAnalytics } from "../../src/features/analytics/compute";
import { computeInsights } from "../../src/features/analytics/insights-math";
import { resolveRange } from "../../src/features/analytics/range";
import { blockedWordIn, isIp, listOf, resolveProtection } from "../../src/features/checkout/protection-settings";
import { scoreOrder } from "../../src/features/checkout/risk";
import { defaultQuantity, lineShipping, linePrice, offerTemplate } from "../../src/features/checkout/pricing";
import { cleanStrategy } from "../../src/features/landing/angles";
import { landingAngles } from "../../src/lib/enums";

test("statuses: the owner's model, every status in exactly one place", () => {
  assert.deepEqual([...callStatuses], ["new", "confirmed", "cancelled", "callback", "no_answer", "voicemail", "fake", "wrong_number", "duplicate", "remark"]);
  assert.ok(!orderStatuses.includes("postponed" as never), "postponed became callback");
  // Pending, refused and confirmed never overlap, and together with "new" … they cover every status
  const groups = [...PENDING_STATUSES, ...REJECTED_STATUSES, ...CONFIRMED_STATUSES];
  assert.equal(new Set(groups).size, groups.length);
  assert.deepEqual(new Set(groups), new Set(orderStatuses));
  // Refused and returned orders give the stock back, the others keep it
  for (const s of orderStatuses) assert.equal(holdsStock(s), !(REJECTED_STATUSES as readonly string[]).includes(s) && s !== "returned", s);
});

test("tracking: the 13 courier stages in the Ecotrack order, Retours = returning + returned", () => {
  assert.equal(trackingStages.length, 13);
  assert.deepEqual(
    trackingStages.map((s) => stageNames[s]),
    ["Prêt à expédier", "En ramassage", "Vers Station", "En Station", "Vers Wilaya", "En preparation", "En livraison", "Suspendus", "Livrés", "Retours", "Colis Supprimés", "Colis Annulés", "Colis à supprimer"],
  );
  assert.deepEqual(stageShipments("returns"), ["returning", "returned"]);
  assert.deepEqual(stageShipments("pickup"), ["pickup"]);
});

test("analytics: fake and wrong numbers count as refusals, duplicates are left out of the rates", () => {
  const range = resolveRange({ period: "custom", from: "2026-10-01", to: "2026-10-10" }, new Date("2026-10-20T12:00:00Z"));
  const at = new Date("2026-10-05T10:00:00Z");
  const row = (id: string, status: (typeof orderStatuses)[number]) => ({ id, createdAt: at, status, subtotal: 1000, total: 1500, wilayaCode: 16, landingPageId: null });
  const orders = [row("a", "confirmed"), row("b", "delivered"), row("c", "fake"), row("d", "wrong_number"), row("e", "duplicate"), row("f", "callback"), row("g", "voicemail")];
  const r = computeAnalytics(range, orders, [], []);
  assert.equal(r.totals.confirmed, 2);
  assert.equal(r.totals.cancelled, 2); // fake + wrong number
  assert.equal(r.totals.fake, 1);
  assert.equal(r.totals.duplicate, 1);
  assert.equal(r.totals.pending, 2); // callback + voicemail
  assert.equal(r.totals.confirmation, 50); // 2 ÷ (2 + 2), the duplicate is not a refusal
});

test("order analysis in Analytics: delivery follow-up and whose fault the returns were", () => {
  const h = new Date("2026-10-05T10:00:00Z");
  const o = (id: string, status: (typeof orderStatuses)[number], extra: object = {}) => ({ id, status, createdAt: h, carrier: "Yalidine", stage: null, ...extra });
  const r = computeInsights(
    [o("a", "shipped", { deliveryState: "postponed" }), o("b", "shipped", { deliveryState: "no_answer" }), o("c", "returned", { deliveryFault: "customer" }), o("d", "returned"), o("e", "delivered"), o("f", "fake")],
    [],
  );
  assert.deepEqual(r.followUp, { postponed: 1, noAnswer: 1 });
  assert.deepEqual(r.faults, { courier: 0, customer: 1, company: 0, unknown: 1 });
  assert.equal(r.rates.fake, 16.7);
  assert.equal(r.rates.delivery, 33.3);
});

test("protection: lists, limits and the fake-order signal", () => {
  const d = resolveProtection(null);
  assert.equal(d.maxPerPhonePerWeek, 10);
  assert.equal(d.duplicateHours, 24);
  assert.equal(d.autoFakeScore, 0);
  const s = resolveProtection({ blockedIps: ["1.2.3.4", "nope", "1.2.3.4"], blockedWords: ["TEST", "x"], blockedWilayas: [16, 99, 31], maxQuantity: 5, autoFakeScore: 80, autoBlockFake: 2 });
  assert.deepEqual(s.blockedIps, ["1.2.3.4"]);
  assert.deepEqual(s.blockedWords, ["test"]);
  assert.deepEqual(s.blockedWilayas, [16, 31]);
  assert.equal(s.maxQuantity, 5);
  assert.equal(s.autoFakeScore, 80);
  assert.equal(blockedWordIn(s.blockedWords, "Amine", "rue Test 12"), "test");
  assert.equal(blockedWordIn(s.blockedWords, "Amine", null), null);
  assert.deepEqual(listOf("a\nb, a،c"), ["a", "b", "c"]);
  assert.ok(isIp("2001:db8::1") && isIp("10.0.0.1") && !isIp("abc"));
  const base = { returned: 0, cancelled: 0, fake: 1, delivered: 0, networkReturned: 0, fillSeconds: 40, minFillSeconds: 4, botAgent: false, name: "Amine Benali", phonesFromIp: 1 };
  assert.deepEqual(scoreOrder(base), { score: 40, reasons: ["fake"] });
});

test("offers: free delivery, preselected quantity, ready-made templates", () => {
  const offers = [
    { quantity: 2, price: 3600, freeShipping: true, badge: "bestSeller" as const, preselected: true },
    { quantity: 3, price: 5000, gift: "حافظة" },
  ];
  assert.equal(defaultQuantity(offers), 2);
  assert.equal(defaultQuantity([]), 1);
  const two = linePrice(2000, 2, offers);
  assert.equal(two.total, 3600);
  assert.equal(lineShipping(500, two.offer), 0);
  assert.equal(lineShipping(500, linePrice(2000, 3, offers).offer), 500);
  assert.equal(lineShipping(null, two.offer), null, "free delivery never opens a wilaya the store does not serve");
  assert.deepEqual(offerTemplate(2000, "pct", 2, 10), { quantity: 2, price: 3600 });
  assert.deepEqual(offerTemplate(2000, "free", 3, 1), { quantity: 3, price: 4000 });
});

test("angles: the 11, automatic = 5 required + at most 2 optional, manual = exactly the merchant's", () => {
  assert.equal(landingAngles.length, 11);
  const raw = {
    audience: "Families",
    angles: ["problem", "solution", "benefits", "proof", "offer", "features", "emotional", "comparison", "problem", "made-up"].map((key, i) => ({ key, required: i < 3, name: key, why: "…" })),
  };
  const auto = cleanStrategy(raw, false)!;
  assert.equal(auto.angles.length, 7);
  assert.equal(auto.angles.filter((a) => a.required).length, 5);
  assert.ok(auto.angles.every((a) => (landingAngles as readonly string[]).includes(a.key!)), "only the 11 keys");
  assert.equal(new Set(auto.angles.map((a) => a.key)).size, 7, "each angle once");
  assert.equal(auto.mode, "auto");
  const manual = cleanStrategy(raw, false, { mode: "manual", keys: ["offer", "advanced"] })!;
  assert.deepEqual(
    manual.angles.map((a) => [a.key, a.required, a.why]),
    [
      ["offer", true, "…"],
      ["advanced", true, ""],
    ],
  );
  assert.equal(manual.mode, "manual");
});
