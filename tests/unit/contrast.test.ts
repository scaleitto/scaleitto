import { test } from "node:test";
import assert from "node:assert/strict";
import { contrastRatio, readableOn, textOn } from "../../src/lib/contrast";

test("contrast ratio of black and white is 21", () => {
  assert.equal(Math.round(contrastRatio("#000000", "#ffffff")), 21);
});

test("buttons get white or dark text, whichever reads better", () => {
  assert.equal(textOn("#047857"), "#ffffff");
  assert.equal(textOn("#d4a017"), "#111111");
  assert.equal(textOn("#facc15"), "#111111");
});

test("a light color used as text is darkened until it reads on its surface", () => {
  assert.equal(readableOn("#047857", "#ffffff", "#0f172a"), "#047857");
  const gold = readableOn("#d4a017", "#ffffff", "#0f172a");
  assert.ok(contrastRatio(gold, "#ffffff") >= 4.5);
  // On a dark surface the dark brand is mixed toward the light text
  const onDark = readableOn("#1d4ed8", "#141a24", "#f3f4f6");
  assert.ok(contrastRatio(onDark, "#141a24") >= 4.5);
});
