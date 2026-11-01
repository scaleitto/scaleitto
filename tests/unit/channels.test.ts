import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { parseShopify, parseWoo, validSignature, wilayaFrom } from "../../src/features/channels/parse";

test("channels: wilaya from codes and names", () => {
  assert.equal(wilayaFrom("DZ-16"), 16);
  assert.equal(wilayaFrom("31"), 31);
  assert.equal(wilayaFrom("Algiers"), 16);
  assert.equal(wilayaFrom("Béjaïa"), 6);
  assert.equal(wilayaFrom("وهران"), 31);
  assert.equal(wilayaFrom("", "Nowhere"), 0);
});

test("channels: a Shopify order", () => {
  const o = parseShopify({
    id: 820982911946154500,
    name: "#1001",
    note: "Appeler le soir",
    total_price: "5400.00",
    shipping_lines: [{ price: "400.00" }],
    shipping_address: { first_name: "Amina", last_name: "B.", phone: "+213 555 12 34 56", city: "Bab Ezzouar", province: "Alger", province_code: "DZ-16", address1: "Cité 5 juillet" },
    line_items: [{ title: "Montre", variant_title: "Noir", sku: "W-1", quantity: 2, price: "2500.00" }],
  });
  assert.ok(o);
  assert.equal(o.ref, "shopify:820982911946154500");
  assert.equal(o.name, "Amina B.");
  assert.equal(o.phone, "0555123456");
  assert.equal(o.wilayaCode, 16);
  assert.deepEqual(o.lines, [{ name: "Montre", variant: "Noir", sku: "W-1", quantity: 2, unitPrice: 2500 }]);
  assert.equal(o.shipping, 400);
  assert.equal(o.total, 5400);
  assert.equal(parseShopify({}), null);
});

test("channels: a WooCommerce order", () => {
  const o = parseWoo({ id: 727, number: "727", total: "3300", shipping_total: "300", customer_note: "", billing: { first_name: "Yacine", last_name: "K", phone: "0661 00 00 42", city: "Es Senia", state: "DZ-31", address_1: "Rue 1" }, shipping: {}, line_items: [{ name: "Lampe", sku: "", quantity: 1, price: 3000, total: "3000" }] });
  assert.ok(o);
  assert.equal(o.ref, "woocommerce:727");
  assert.equal(o.label, "#727");
  assert.equal(o.phone, "0661000042");
  assert.equal(o.wilayaCode, 31);
  assert.equal(o.address, "Rue 1");
  assert.equal(o.total, 3300);
});

test("channels: signatures (base64 HMAC-SHA256 of the raw body)", () => {
  const raw = '{"id":1}';
  const sig = createHmac("sha256", "s3cret").update(raw).digest("base64");
  assert.ok(validSignature(raw, "s3cret", sig));
  assert.ok(!validSignature(raw, "other", sig));
  assert.ok(!validSignature(raw + " ", "s3cret", sig));
  assert.ok(!validSignature(raw, "s3cret", null));
});
