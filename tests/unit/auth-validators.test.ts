import { test } from "node:test";
import assert from "node:assert/strict";
import { registerSchema } from "../../src/features/auth/validators";

const valid = { name: "Amine", email: "Amine@Example.com ", password: "password123", shopName: "متجري", shopSlug: "My-Shop", phone: "0555 12 34 56", storeLanguage: "fr" };

test("valid registration is normalized", () => {
  const r = registerSchema.parse(valid);
  assert.equal(r.email, "amine@example.com");
  assert.equal(r.shopSlug, "my-shop");
  assert.equal(r.phone, "0555123456");
  assert.equal(r.storeLanguage, "fr");
});

test("the phone is required and must be Algerian", () => {
  for (const phone of ["", "0123", "+33 6 12 34 56 78"]) {
    const r = registerSchema.safeParse({ ...valid, phone });
    assert.ok(!r.success && r.error.issues.some((i) => i.path[0] === "phone" && i.message === "e:phone"), phone);
  }
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
