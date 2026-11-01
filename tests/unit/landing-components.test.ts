import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeSections } from "../../src/features/landing/types";

test("landing: announcement bar and spacer are kept clean", () => {
  const out = sanitizeSections([
    { id: "a", type: "announcement", text: "  توصيل مجاني هذا الأسبوع  " },
    { id: "b", type: "announcement", text: "" },
    { id: "c", type: "spacer", size: "huge", line: "yes" },
    { id: "d", type: "spacer", size: "lg", line: true },
  ]);
  assert.deepEqual(out, [
    { id: "a", type: "announcement", text: "توصيل مجاني هذا الأسبوع" },
    { id: "c", type: "spacer", size: "md", line: false },
    { id: "d", type: "spacer", size: "lg", line: true },
  ]);
});
