import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanOrigin } from "../../src/features/storefront/origins";
import { previewDiscount } from "../../src/features/referrals/discount";
import { cleanScopes } from "../../src/features/mcp/scopes";

test("allowed origins: https + domain only", () => {
  assert.equal(cleanOrigin(" HTTPS://Shop.Example.com/ "), "https://shop.example.com");
  assert.equal(cleanOrigin("http://shop.example.com"), null);
  assert.equal(cleanOrigin("https://shop.example.com/path"), null);
  assert.equal(cleanOrigin("https://localhost"), null);
});

test("referral discount: 10% of a referred store's first payment, half a month of the lower price per voucher", () => {
  assert.equal(previewDiscount({ firstPayment: true, voucherValue: null }, 3500, 10500), 1050);
  assert.equal(previewDiscount({ firstPayment: false, voucherValue: 6900 }, 3500, 3500), 1750);
  assert.equal(previewDiscount({ firstPayment: false, voucherValue: 3500 }, 6900, 6900), 1750);
  assert.equal(previewDiscount({ firstPayment: false, voucherValue: null }, 3500, 3500), 0);
});

test("MCP scopes: only known ones, once", () => {
  assert.deepEqual(cleanScopes(["read_orders", "read_orders", "admin", 3]), ["read_orders"]);
});
