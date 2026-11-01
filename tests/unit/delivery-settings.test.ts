import { test } from "node:test";
import assert from "node:assert/strict";
import { applyDelivery, cleanManifest, resolveDelivery, resolveManifest } from "../../src/features/delivery/settings";
import { shippingPrice } from "../../src/features/checkout/pricing";

const table = { 16: { home: 500, office: 300 }, 31: { home: 700, office: null } };

test("delivery settings: defaults, one option per type, bad values dropped", () => {
  assert.deepEqual(resolveDelivery(null), { enabled: true, autoSend: false, options: [] });
  const s = resolveDelivery({ autoSend: true, options: [{ type: "home", pricing: "flat", price: 400, name: "Express" }, { type: "home", pricing: "free" }, { type: "office", pricing: "nope", price: -5 }] });
  assert.equal(s.autoSend, true);
  assert.deepEqual(s.options.map((o) => `${o.type}:${o.pricing}:${o.price}`), ["home:flat:400", "office:wilaya:0"]);
});

test("delivery prices: the table as it is, shaped by the options, free when delivery is off", () => {
  assert.equal(applyDelivery(table, resolveDelivery(null)), table);
  assert.deepEqual(applyDelivery(table, resolveDelivery({ enabled: false })), {});
  assert.equal(shippingPrice(applyDelivery(table, resolveDelivery({ enabled: false })), 31, "home"), 0);
  // Home at a fixed price everywhere, desk from the table; a wilaya missing from the table has no desk
  const shaped = applyDelivery(table, resolveDelivery({ options: [{ type: "home", pricing: "flat", price: 450 }, { type: "office", pricing: "wilaya" }] }));
  assert.equal(shippingPrice(shaped, 1, "home"), 450);
  assert.equal(shippingPrice(shaped, 16, "office"), 300);
  assert.equal(shippingPrice(shaped, 31, "office"), null);
  // Only a free desk option: home is not offered
  const deskOnly = applyDelivery(table, resolveDelivery({ options: [{ type: "office", pricing: "free" }] }));
  assert.equal(shippingPrice(deskOnly, 16, "home"), null);
  assert.equal(shippingPrice(deskOnly, 16, "office"), 0);
  // An inactive option is not offered
  assert.equal(shippingPrice(applyDelivery(table, resolveDelivery({ options: [{ type: "home", pricing: "free", active: false }] })), 16, "home"), null);
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
