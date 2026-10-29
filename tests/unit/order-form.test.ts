import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultForm, formElements, resolveForm } from "../../src/features/landing/types";
import { resolveDesign, storeTheme } from "../../src/features/design/types";
import { colorByName } from "../../src/lib/colors";

test("old forms get every element in the default order", () => {
  const f = resolveForm({ title: "x" });
  assert.deepEqual(f.order, [...formElements]);
  assert.equal(f.appearance, "direct");
  assert.deepEqual(resolveForm(null), defaultForm);
});

test("element order: unknown and repeated keys dropped, missing ones added, new custom fields before the summary", () => {
  const f = resolveForm({
    order: ["phone", "phone", "name", "evil", "summary"],
    custom: [{ id: "c1", label: "Taille", type: "text" }],
  });
  assert.equal(f.order[0], "phone");
  assert.equal(f.order[1], "name");
  assert.equal(new Set(f.order).size, f.order.length);
  assert.ok(!f.order.includes("evil"));
  assert.ok(f.order.indexOf("custom:c1") < f.order.indexOf("summary"));
  for (const k of formElements) assert.ok(f.order.includes(k), k);
});

test("labels keep only real text, choices only known values", () => {
  const f = resolveForm({ labels: { name: { label: " Nom ", placeholder: "" }, phone: { label: "" }, hack: { label: "x" } }, appearance: "modal", buttonEffect: "shake" });
  assert.deepEqual(f.labels, { name: { label: "Nom", placeholder: "" } });
  assert.equal(f.appearance, "direct");
  assert.equal(f.buttonEffect, "shake");
});

test("theme adjustments override the theme, empty ones keep it", () => {
  const plain = storeTheme(resolveDesign({ theme: "minimal" }));
  assert.equal(plain.font, "readex");
  const own = storeTheme(resolveDesign({ theme: "minimal", style: { font: "changa", corners: "round", columns: 3, cards: "bogus" } }));
  assert.equal(own.font, "changa");
  assert.equal(own.buttonRadius, 999);
  assert.equal(own.layout.columns, 3);
  assert.equal(own.layout.cards, plain.layout.cards);
});

test("color names find their swatch in any language", () => {
  assert.equal(colorByName("أحمر"), "#dc2626");
  assert.equal(colorByName("Rouge"), "#dc2626");
  assert.equal(colorByName("navy"), "#1f2a44");
  assert.equal(colorByName("Turquoise pâle"), null);
});
