import { test } from "node:test";
import assert from "node:assert/strict";
import { clientIp } from "../../src/server/client-ip";
import { allowAttempt, clearAttempts, recordFailure, tooManyFailures } from "../../src/server/rate-limit";

const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });

test("the visitor's IP is the one the proxy saw, not what the visitor wrote", () => {
  delete process.env.CLIENT_IP_HEADER;
  delete process.env.TRUSTED_PROXY_HOPS;
  // The visitor wrote "1.2.3.4"; the web server appended the real address
  assert.equal(clientIp(h({ "x-forwarded-for": "1.2.3.4, 41.100.5.6" })), "41.100.5.6");
  assert.equal(clientIp(h({ "x-forwarded-for": "41.100.5.6" })), "41.100.5.6");
  process.env.TRUSTED_PROXY_HOPS = "2";
  assert.equal(clientIp(h({ "x-forwarded-for": "1.2.3.4, 41.100.5.6, 10.0.0.1" })), "41.100.5.6");
  delete process.env.TRUSTED_PROXY_HOPS;
  assert.equal(clientIp(h({ "x-real-ip": "41.100.5.7" })), "41.100.5.7");
  assert.equal(clientIp(h({ "x-forwarded-for": "<script>" })), null);
  process.env.CLIENT_IP_HEADER = "cf-connecting-ip";
  assert.equal(clientIp(h({ "cf-connecting-ip": "2001:db8::1", "x-forwarded-for": "1.2.3.4" })), "2001:db8::1");
  delete process.env.CLIENT_IP_HEADER;
});

test("attempt limits: counted per key, failures only for sign-in, cleared on success", () => {
  for (let i = 0; i < 3; i++) assert.equal(allowAttempt("t:a", 3, 60_000), true);
  assert.equal(allowAttempt("t:a", 3, 60_000), false);
  assert.equal(allowAttempt("t:b", 3, 60_000), true);
  for (let i = 0; i < 10; i++) recordFailure("t:login");
  assert.equal(tooManyFailures("t:login", 10, 60_000), true);
  clearAttempts("t:login");
  assert.equal(tooManyFailures("t:login", 10, 60_000), false);
});
