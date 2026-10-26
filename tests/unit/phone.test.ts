import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidDzPhone, normalizePhone } from "../../src/lib/phone";

test("normalizes Algerian numbers", () => {
  assert.equal(normalizePhone("0555 12 34 56"), "0555123456");
  assert.equal(normalizePhone("+213 555-12-34-56"), "0555123456");
  assert.equal(normalizePhone("00213661223344"), "0661223344");
});

test("accepts only 05/06/07 mobiles with 10 digits", () => {
  assert.ok(isValidDzPhone("0555123456"));
  assert.ok(isValidDzPhone("0770998877"));
  assert.ok(!isValidDzPhone("0455123456"));
  assert.ok(!isValidDzPhone("055512345"));
  assert.ok(!isValidDzPhone("12345"));
});
