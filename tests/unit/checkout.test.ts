import { test } from "node:test";
import assert from "node:assert/strict";
import { linePrice, shippingPrice } from "../../src/features/checkout/pricing";
import { orderInputSchema } from "../../src/features/checkout/validators";
import { holdsStock } from "../../src/features/orders/statuses";

test("quantity offers replace unit price × quantity", () => {
  const offers = [{ quantity: 2, price: 8500 }];
  assert.equal(linePrice(4500, 1, offers).total, 4500);
  assert.equal(linePrice(4500, 2, offers).total, 8500);
  assert.equal(linePrice(4500, 2, offers).offer?.price, 8500);
  assert.equal(linePrice(4500, 3, offers).total, 13500);
});

test("shipping: free without rates, null when a wilaya or type is not delivered", () => {
  assert.equal(shippingPrice({}, 16, "home"), 0);
  const rates = { 16: { home: 400, office: null }, 31: { home: 700, office: 500 } };
  assert.equal(shippingPrice(rates, 16, "home"), 400);
  assert.equal(shippingPrice(rates, 16, "office"), null);
  assert.equal(shippingPrice(rates, 31, "office"), 500);
  assert.equal(shippingPrice(rates, 1, "home"), null);
});

test("order form normalizes the phone and rejects bad input with keys", () => {
  const ok = orderInputSchema.parse({ name: "Karim", phone: "+213 555 12 34 56", wilaya: "16", commune: "Bab Ezzouar", deliveryType: "home", quantity: "2" });
  assert.equal(ok.phone, "0555123456");
  assert.equal(ok.wilaya, 16);
  const bad = orderInputSchema.safeParse({ name: "K", phone: "0123", wilaya: "99", commune: "", deliveryType: "drone", quantity: "1" });
  assert.ok(!bad.success);
  const keys = new Set(bad.error.issues.map((i) => i.message.replace(/^e:/, "")));
  for (const k of ["name", "phone", "wilaya", "commune", "deliveryType"]) assert.ok(keys.has(k), k);
});

test("cancelled and returned orders release stock", () => {
  assert.equal(holdsStock("new"), true);
  assert.equal(holdsStock("delivered"), true);
  assert.equal(holdsStock("cancelled"), false);
  assert.equal(holdsStock("returned"), false);
});
