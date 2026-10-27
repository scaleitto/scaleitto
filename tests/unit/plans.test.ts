import { test } from "node:test";
import assert from "node:assert/strict";
import { algeriaMonthStart } from "../../src/lib/time";

test("monthly quotas follow the Algeria calendar", () => {
  // 23:30 UTC on Jan 31st is already February 1st in Algeria (UTC+1)
  assert.equal(algeriaMonthStart(new Date("2026-01-31T23:30:00Z")).toISOString(), "2026-01-31T23:00:00.000Z");
  assert.equal(algeriaMonthStart(new Date("2026-01-31T22:30:00Z")).toISOString(), "2025-12-31T23:00:00.000Z");
});
