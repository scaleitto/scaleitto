import { test } from "node:test";
import assert from "node:assert/strict";
import { agentTrend, confirmShare } from "../../src/features/team/agent-stats";

test("agent trend: 7 Algeria days, oldest first, today last", () => {
  const now = new Date("2026-11-01T22:30:00Z"); // 23:30 in Algeria, still Nov 1
  const trend = agentTrend(
    [new Date("2026-11-01T10:00:00Z"), new Date("2026-10-31T23:30:00Z"), new Date("2026-10-20T10:00:00Z")],
    [new Date("2026-11-01T11:00:00Z"), new Date("2026-10-26T09:00:00Z")],
    now,
  );
  assert.equal(trend.length, 7);
  assert.equal(trend[0].day, "2026-10-26");
  assert.equal(trend[6].day, "2026-11-01");
  // 23:30 UTC on Oct 31 is 00:30 on Nov 1 in Algeria
  assert.equal(trend[6].assigned, 2);
  assert.equal(trend[6].confirmed, 1);
  assert.equal(trend[0].confirmed, 1);
  assert.equal(trend.reduce((s, p) => s + p.assigned, 0), 2);
  assert.equal(trend[6].weekday, 0);
});

test("confirmation share", () => {
  assert.equal(confirmShare(0, 0), null);
  assert.equal(confirmShare(3, 4), 75);
  assert.equal(confirmShare(5, 4), 100);
});
