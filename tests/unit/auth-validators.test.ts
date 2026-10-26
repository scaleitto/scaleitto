import { test } from "node:test";
import assert from "node:assert/strict";
import { registerSchema } from "../../src/features/auth/validators";

const valid = { name: "Amine", email: "Amine@Example.com ", password: "password123", shopName: "متجري", shopSlug: "My-Shop" };

test("valid registration is normalized", () => {
  const r = registerSchema.parse(valid);
  assert.equal(r.email, "amine@example.com");
  assert.equal(r.shopSlug, "my-shop");
});

test("rejects bad slugs and reserved names with the right message keys", () => {
  for (const [slug, key] of [["ab", "e:slug"], ["-shop", "e:slug"], ["shop_1", "e:slug"], ["admin", "e:slugTaken"]] as const) {
    const r = registerSchema.safeParse({ ...valid, shopSlug: slug });
    assert.ok(!r.success, slug);
    assert.equal(r.error!.issues[0].message, key, slug);
  }
});

test("short password and bad email", () => {
  const r = registerSchema.safeParse({ ...valid, password: "123", email: "nope" });
  assert.ok(!r.success);
  const keys = Object.fromEntries(r.error!.issues.map((i) => [i.path[0], i.message]));
  assert.equal(keys.password, "e:password");
  assert.equal(keys.email, "e:email");
});
