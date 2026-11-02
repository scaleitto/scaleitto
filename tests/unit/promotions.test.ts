import { test } from "node:test";
import assert from "node:assert/strict";
import { bestPercents, discounted, fromAlgeriaLocal, promoted, toAlgeriaLocal } from "../../src/features/promotions/pricing";

test("a running promotion lowers every price and shows the old one", () => {
  assert.equal(discounted(2000, 25), 1500);
  assert.equal(discounted(999, 33), 669);
  const p = promoted({ id: "a", price: 2000, compareAtPrice: null, offers: [{ quantity: 2, price: 3600 }], variants: [{ price: null }, { price: 2400 }] }, 25);
  assert.equal(p.price, 1500);
  assert.equal(p.compareAtPrice, 2000);
  assert.deepEqual(p.offers?.map((o) => o.price), [2700]);
  assert.deepEqual(p.variants?.map((v) => v.price), [null, 1800]);
  // the merchant's higher old price stays
  assert.equal(promoted({ price: 2000, compareAtPrice: 3000 }, 10).compareAtPrice, 3000);
  assert.equal(promoted({ price: 2000, compareAtPrice: null }, undefined).price, 2000);
});

test("the biggest percentage wins; Algeria local time is UTC+1", () => {
  const best = bestPercents([{ percent: 10, productIds: ["a", "b"] }, { percent: 30, productIds: ["b"] }]);
  assert.equal(best.get("a"), 10);
  assert.equal(best.get("b"), 30);
  assert.equal(fromAlgeriaLocal("2026-11-02T10:00")?.toISOString(), "2026-11-02T09:00:00.000Z");
  assert.equal(fromAlgeriaLocal("tomorrow"), null);
  assert.equal(toAlgeriaLocal(new Date("2026-11-02T09:00:00Z")), "2026-11-02T10:00");
});

test("wholesale: the tier reached prices every piece, offers still win, promotions lower tiers", async () => {
  const { linePrice, resolveWholesale } = await import("../../src/features/checkout/pricing");
  const w = resolveWholesale({ minQty: 2, tiers: [{ from: 10, price: 900 }, { from: 5, price: 1000 }, { from: 5, price: 1 }, { from: 1, price: 5 }] });
  assert.deepEqual(w, { minQty: 2, tiers: [{ from: 5, price: 1000 }, { from: 10, price: 900 }] });
  assert.equal(linePrice(1200, 3, [], w).total, 3600);
  assert.equal(linePrice(1200, 6, [], w).total, 6000);
  assert.equal(linePrice(1200, 12, [], w).total, 10800);
  assert.equal(linePrice(1200, 6, [{ quantity: 6, price: 5000 }], w).total, 5000);
  assert.equal(resolveWholesale({ minQty: 1, tiers: [] }), null);
  const p = promoted({ price: 1200, compareAtPrice: null, wholesale: w }, 50);
  assert.equal((p.wholesale as { tiers: { price: number }[] }).tiers[0].price, 500);
});
