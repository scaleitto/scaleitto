import { test } from "node:test";
import assert from "node:assert/strict";
import { checkContact } from "../../src/features/checkout/validators";
import { resolveForm } from "../../src/features/landing/types";

test("checkout fields: hidden dropped, optional may be empty, required must be filled", () => {
  const errors: Record<string, string> = {};
  assert.deepEqual(checkContact({ name: "hidden", commune: "optional" }, { name: "Ali", commune: "" }, errors), { name: "", commune: "" });
  assert.deepEqual(errors, {});
  const e2: Record<string, string> = {};
  checkContact({ name: "required", commune: "required" }, { name: "", commune: "H" }, e2);
  assert.deepEqual(e2, { name: "name", commune: "commune" });
  const form = resolveForm({ name: "nope", commune: "hidden", optionButtons: true });
  assert.equal(form.name, "required");
  assert.equal(form.commune, "hidden");
  assert.equal(form.optionButtons, true);
});

test("checkout fields: the wilaya is required unless the store makes it optional", () => {
  const e1: Record<string, string> = {};
  checkContact({ name: "required", commune: "hidden", wilaya: "required" }, { name: "Ali", commune: "", wilaya: 0 }, e1);
  assert.deepEqual(e1, { wilaya: "wilaya" });
  const e2: Record<string, string> = {};
  checkContact({ name: "required", commune: "hidden", wilaya: "optional" }, { name: "Ali", commune: "", wilaya: 0 }, e2);
  assert.deepEqual(e2, {});
});
