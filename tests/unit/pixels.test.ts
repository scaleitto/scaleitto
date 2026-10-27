import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidTag, normalizeTag } from "../../src/features/pixels/ids";
import { parsePixel } from "../../src/features/pixels/validators";

test("tag IDs are checked per platform (they end up in inline scripts)", () => {
  assert.ok(isValidTag("meta", "123456789012345"));
  assert.ok(!isValidTag("meta", "12345abc"));
  assert.ok(isValidTag("tiktok", normalizeTag("tiktok", " c4abcdefghij123 ")));
  assert.ok(isValidTag("ga4", normalizeTag("ga4", "g-abc1234")));
  assert.ok(!isValidTag("ga4", "G-abc');alert(1)//"));
  assert.ok(isValidTag("gtm", "GTM-ABC1234"));
  assert.ok(!isValidTag("gtm", "G-ABC1234"));
});

test("pixel form: scope needs products, ids normalized", () => {
  const fd = (entries: [string, string][]) => {
    const f = new FormData();
    for (const [k, v] of entries) f.append(k, v);
    return f;
  };
  const ok = parsePixel(fd([["platform", "ga4"], ["name", "GA"], ["tagId", "g-test1234"], ["purchaseOn", "placed"], ["scope", "all"]]));
  assert.ok(ok.success && ok.data.tagId === "G-TEST1234");
  const noProducts = parsePixel(fd([["platform", "meta"], ["name", "x"], ["tagId", "1234567"], ["purchaseOn", "confirmed"], ["scope", "products"]]));
  assert.ok(!noProducts.success && noProducts.error.issues.some((i) => i.path[0] === "productIds"));
  const bad = parsePixel(fd([["platform", "meta"], ["name", "x"], ["tagId", "abc"], ["purchaseOn", "placed"], ["scope", "all"]]));
  assert.ok(!bad.success && bad.error.issues.some((i) => i.message === "e:tagId"));
});
