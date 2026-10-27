import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDomain } from "../../src/features/settings/domain-name";

test("domains typed by merchants are cleaned up, bad ones refused", () => {
  process.env.ROOT_DOMAIN = "scaleitto.com";
  assert.equal(normalizeDomain("https://www.MyShop.dz/products?x=1"), "myshop.dz");
  assert.equal(normalizeDomain("boutique.example.com"), "boutique.example.com");
  assert.equal(normalizeDomain("not a domain"), null);
  assert.equal(normalizeDomain("localhost"), null);
  assert.equal(normalizeDomain("-bad-.com"), null);
  assert.equal(normalizeDomain("shop.scaleitto.com"), null);
  assert.equal(normalizeDomain("scaleitto.com"), null);
});
