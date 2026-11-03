import { test } from "node:test";
import assert from "node:assert/strict";
import { productSchema } from "../../src/features/products/validators";
import { combinations, variantTitle } from "../../src/features/products/variants";
import { fieldErrorsFrom } from "../../src/lib/validation";

const base = { name: "Montre Classique", price: "4 500", status: "active", images: "[]", options: "[]", variants: "[]", offers: "[]" };

test("combinations build every variant in option order", () => {
  const options = [
    { name: "Size", values: ["S", "M"] },
    { name: "Color", values: ["Red", "Blue"] },
  ];
  const combos = combinations(options);
  assert.equal(combos.length, 4);
  assert.deepEqual(combos[1], { Size: "S", Color: "Blue" });
  assert.equal(variantTitle(combos[3], options), "M / Blue");
  assert.deepEqual(combinations([]), []);
  assert.deepEqual(combinations([{ name: "Size", values: [] }]), []);
});

test("a valid product is normalized", () => {
  const r = productSchema.parse({ ...base, compareAtPrice: "", trackStock: "on", stock: "12" });
  assert.equal(r.price, 4500);
  assert.equal(r.compareAtPrice, null);
  assert.equal(r.trackStock, true);
  assert.equal(r.stock, 12);
  assert.equal(r.slug, "montre-classique");
});

test("missing price, bad compare price and bad JSON fields give message keys", () => {
  const r = productSchema.safeParse({ ...base, name: "x", price: "", compareAtPrice: "100", options: "not json", offers: JSON.stringify([{ quantity: 2, price: 100 }, { quantity: 2, price: 90 }]) });
  assert.ok(!r.success);
  const errors = fieldErrorsFrom(r.error);
  assert.equal(errors.name, "tooShort");
  assert.equal(errors.price, "price");
  assert.equal(errors.options, "options");
  assert.equal(errors.offers, "offers");
});

test("compare-at price must be above the price", () => {
  const r = productSchema.safeParse({ ...base, compareAtPrice: "4000" });
  assert.ok(!r.success);
  assert.equal(fieldErrorsFrom(r.error).compareAtPrice, "compareAtPrice");
});

test("duplicate option values and too many variants are refused", () => {
  const dup = productSchema.safeParse({ ...base, options: JSON.stringify([{ name: "Size", values: ["S", "s"] }]) });
  assert.ok(!dup.success);
  const many = Array.from({ length: 13 }, (_, i) => String(i));
  const huge = productSchema.safeParse({ ...base, options: JSON.stringify([{ name: "A", values: many }, { name: "B", values: many }]) });
  assert.ok(!huge.success);
});

test("images must be our uploads or https links", () => {
  assert.ok(productSchema.safeParse({ ...base, images: JSON.stringify(["/uploads/abc-123/f.webp", "https://cdn.example.com/a.jpg"]) }).success);
  assert.ok(!productSchema.safeParse({ ...base, images: JSON.stringify(["javascript:alert(1)"]) }).success);
});

test("Zimam's variants: displays, optional and hidden options, values and combinations switched off", async () => {
  const { combinations, offered, optionalChoices, displayOf } = await import("../../src/features/products/variants");
  const options = [
    { name: "Color", values: ["Red", "Blue"], display: "color" as const, colors: { Red: "#ff0000", Blue: "#0000ff" }, off: ["Blue"] },
    { name: "Size", values: ["S", "M"] },
    { name: "Gift wrap", values: ["Yes"], optional: true },
    { name: "Internal", values: ["x"], hidden: true },
  ];
  // Optional and hidden options do not make combinations
  assert.equal(combinations(options).length, 4);
  // A switched-off value or combination is not offered
  const rows = combinations(options).map((v, i) => ({ optionValues: v, active: i !== 0 }));
  assert.deepEqual(offered(options, rows).map((r) => r.optionValues), [{ Color: "Red", Size: "M" }]);
  assert.deepEqual(optionalChoices(options, { "Gift wrap": "Yes", Internal: "x", Size: "S" }), [{ label: "Gift wrap", value: "Yes" }]);
  assert.equal(displayOf({ name: "C", values: ["a"], kind: "color" }), "color");
  // The form's JSON keeps only what the display uses
  const parsed = productSchema.safeParse({ ...base, options: JSON.stringify([{ name: "Size", values: ["S"], display: "text", colors: { S: "#000000" }, optional: true }]) });
  assert.ok(parsed.success);
  assert.deepEqual(parsed.data.options, [{ name: "Size", values: ["S"], display: "text", optional: true }]);
  assert.ok(!productSchema.safeParse({ ...base, maxPerOrder: "0" }).success);
  assert.equal(productSchema.safeParse({ ...base, maxPerOrder: "5" }).data?.maxPerOrder, 5);
});
