import { test } from "node:test";
import assert from "node:assert/strict";
import { cookieHeader, mergeCookies } from "../../src/lib/cookies";

test("cookies set while redirecting are kept for the next request", () => {
  const jar = mergeCookies(new Map(), ["aep_usuc_f=site=glo; Path=/; Domain=.aliexpress.com", "xman_t=abc; HttpOnly"]);
  assert.equal(cookieHeader(jar), "aep_usuc_f=site=glo; xman_t=abc");
  mergeCookies(jar, ["xman_t=new"]);
  assert.equal(cookieHeader(jar), "aep_usuc_f=site=glo; xman_t=new");
});
