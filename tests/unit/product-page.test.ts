import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalProductUrl, cookieHeader, isBlockedPage, mergeCookies, parseAliExpress } from "../../src/lib/product-page";

test("AliExpress links lose their tracking and regional subdomain", () => {
  const long = "https://ar.aliexpress.com/item/1005012615752371.html?spm=a2g0o.home.pcJustForYou.13&gps-id=pcJustForYou&pdp_npi=6%40dis%21DZD";
  assert.equal(canonicalProductUrl(long).toString(), "https://www.aliexpress.com/item/1005012615752371.html");
  assert.equal(canonicalProductUrl("https://fr.aliexpress.com/item/42.html").toString(), "https://www.aliexpress.com/item/42.html");
  // Other sites keep their link as is
  assert.equal(canonicalProductUrl("https://shop.example.com/products/robe?variant=1").toString(), "https://shop.example.com/products/robe?variant=1");
});

test("AliExpress page data: title, photos, price", () => {
  const html = `<script>window.runParams = {"subject":"Lampe anti moustique \\u00e9lectrique - AliExpress 13","imagePathList":["//ae01.alicdn.com/kf/a.jpg","https://ae01.alicdn.com/kf/b.jpg"],"minActivityAmount":{"currency":"DZD","value":354.41}};</script>`;
  const p = parseAliExpress(html);
  assert.equal(p?.title, "Lampe anti moustique électrique");
  assert.deepEqual(p?.images, ["https://ae01.alicdn.com/kf/a.jpg", "https://ae01.alicdn.com/kf/b.jpg"]);
  assert.equal(p?.price, 354);
  assert.equal(parseAliExpress("<html>nothing</html>"), null);
});

test("anti-bot pages are recognised; cookies are kept across redirects", () => {
  assert.ok(isBlockedPage("https://www.aliexpress.com/_____tmd_____/punish?x5secdata=1", ""));
  assert.ok(!isBlockedPage("https://www.aliexpress.com/item/1.html", "<html>product</html>"));
  const jar = mergeCookies(new Map(), ["aep_usuc_f=site=glo; Path=/; Domain=.aliexpress.com", "xman_t=abc; HttpOnly"]);
  assert.equal(cookieHeader(jar), "aep_usuc_f=site=glo; xman_t=abc");
});
