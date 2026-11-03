import { test } from "node:test";
import assert from "node:assert/strict";
import { applyDelivery, cleanManifest, optionFromTable, resolveDelivery, resolveManifest } from "../../src/features/delivery/settings";
import { shippingPrice } from "../../src/features/checkout/pricing";

const table = { 16: { home: 500, office: 300 }, 31: { home: 700, office: null } };

test("delivery settings: defaults, older options read, bad values dropped, one preferred method", () => {
  assert.deepEqual(resolveDelivery(null), { enabled: true, autoSend: false, options: [] });
  const s = resolveDelivery({
    autoSend: true,
    options: [
      { type: "home", pricing: "flat", price: 400, name: "Express", isDefault: true },
      { type: "both", pricing: "wilaya", name: "Standard", isDefault: true, rates: { 16: { state: "paid", home: 500, office: -3 }, 31: { state: "free" }, 99: { state: "paid", home: 1 }, 5: { state: "nope" } } },
      { type: "nope", pricing: "nope", price: -5 },
    ],
  });
  assert.equal(s.autoSend, true);
  assert.deepEqual(s.options.map((o) => `${o.type}:${o.pricing}:${o.home}:${o.office}`), ["home:flat:400:0", "both:wilaya:0:0", "home:wilaya:0:0"]);
  assert.deepEqual(s.options[1].rates, { 16: { state: "paid", home: 500, office: null }, 31: { state: "free", home: null, office: null } });
  assert.equal(s.options[2].rates, null, "older wilaya options use the shared table");
  assert.deepEqual(s.options.map((o) => o.isDefault), [true, false, false]);
});

test("delivery prices: the table without methods, each method's own prices, free when delivery is off", () => {
  assert.deepEqual(applyDelivery(table, resolveDelivery(null)), table);
  assert.deepEqual(applyDelivery(table, resolveDelivery({ enabled: false })), {});
  assert.equal(shippingPrice(applyDelivery(table, resolveDelivery({ enabled: false })), 31, "home"), 0);
  // Home at one price everywhere, office from an older method (the shared table)
  const shaped = applyDelivery(table, resolveDelivery({ options: [{ type: "home", pricing: "flat", price: 450 }, { type: "office", pricing: "wilaya" }] }));
  assert.equal(shippingPrice(shaped, 1, "home"), 450);
  assert.equal(shippingPrice(shaped, 16, "office"), 300);
  assert.equal(shippingPrice(shaped, 31, "office"), null);
  // Per-wilaya prices: paid (empty office = no office), free, not delivered, not set
  const perWilaya = resolveDelivery({ options: [{ id: "std", name: "Standard", type: "both", pricing: "wilaya", rates: { 16: { state: "paid", home: 600, office: null }, 31: { state: "free" }, 1: { state: "none" } } }] });
  const rates = applyDelivery(table, perWilaya);
  assert.equal(shippingPrice(rates, 16, "home"), 600);
  assert.equal(shippingPrice(rates, 16, "office"), null);
  assert.equal(shippingPrice(rates, 31, "office"), 0);
  assert.equal(shippingPrice(rates, 1, "home"), null);
  assert.equal(shippingPrice(rates, 2, "home"), null);
  // The preferred method comes first; another method fills the wilayas it does not deliver
  const two = resolveDelivery({ options: [{ id: "a", name: "A", type: "home", pricing: "flat", home: 800 }, { id: "b", name: "B", type: "both", pricing: "wilaya", isDefault: true, rates: { 16: { state: "paid", home: 400, office: 250 } } }] });
  assert.equal(shippingPrice(applyDelivery(table, two), 16, "home"), 400);
  assert.equal(shippingPrice(applyDelivery(table, two), 31, "home"), 800);
  // A product sold with one method only gets that one
  assert.equal(shippingPrice(applyDelivery(table, two, "a"), 16, "home"), 800);
  assert.equal(shippingPrice(applyDelivery(table, two, "a"), 16, "office"), null);
  // Only a free office method: home is not offered; an inactive method is not offered
  const deskOnly = applyDelivery(table, resolveDelivery({ options: [{ type: "office", pricing: "free" }] }));
  assert.equal(shippingPrice(deskOnly, 16, "home"), null);
  assert.equal(shippingPrice(deskOnly, 16, "office"), 0);
  assert.equal(shippingPrice(applyDelivery(table, resolveDelivery({ options: [{ type: "home", pricing: "free", active: false }] })), 16, "home"), null);
  // An older store's table as one method gives the same prices
  const legacy = applyDelivery(table, { enabled: true, autoSend: false, options: [optionFromTable(table)] });
  assert.equal(shippingPrice(legacy, 16, "office"), 300);
  assert.equal(shippingPrice(legacy, 31, "office"), null);
  assert.equal(shippingPrice(legacy, 31, "home"), 700);
});

test("manifest template: defaults, draft and published, text limits", () => {
  const empty = resolveManifest(null);
  assert.equal(empty.published, null);
  assert.equal(empty.draft.show.items, false);
  assert.equal(empty.draft.show.signatures, true);
  const t = cleanManifest({ language: "fr", paper: "a6", header: "x".repeat(900), show: { items: true } });
  assert.equal(t.direction, "ltr");
  assert.equal(t.paper, "a6");
  assert.equal(t.header.length, 500);
  assert.equal(t.show.items, true);
  assert.equal(resolveManifest({ published: t }).draft.paper, "a6");
});
