import { test } from "node:test";
import assert from "node:assert/strict";
import { algeriaParts, daysBetween, weekdayOf } from "../../src/lib/time";
import { inShift, scheduleAdherence, shiftLength } from "../../src/features/team/schedule";

test("Algeria time is UTC+1", () => {
  const p = algeriaParts(new Date("2026-10-27T23:30:00Z"));
  assert.equal(p.day, "2026-10-28");
  assert.equal(p.minutes, 30);
  assert.equal(p.weekday, 3); // Wednesday
  assert.deepEqual(daysBetween("2026-10-30", "2026-11-02"), ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  assert.equal(weekdayOf("2026-11-01"), 0); // Sunday
});

test("shift hours, including night shifts", () => {
  const day = { days: [0, 1, 2, 3, 4], start: "09:00", end: "17:00" };
  assert.equal(inShift(day, 1, 9 * 60), true);
  assert.equal(inShift(day, 1, 17 * 60), false);
  assert.equal(inShift(day, 5, 10 * 60), false); // Friday off
  assert.equal(shiftLength(day), 480);
  const night = { days: [1], start: "22:00", end: "06:00" };
  assert.equal(inShift(night, 1, 23 * 60), true);
  assert.equal(inShift(night, 2, 2 * 60), true); // Tuesday 02:00 belongs to Monday's shift
  assert.equal(inShift(night, 2, 23 * 60), false);
  assert.equal(shiftLength(night), 480);
  assert.equal(inShift(null, 1, 600), false);
});

test("attendance, punctuality, lateness and coverage", () => {
  const schedule = { days: [0, 1, 2, 3, 4], start: "09:00", end: "17:00" }; // Sunday → Thursday
  // Sun 1 Nov → Thu 5 Nov 2026 = 5 workdays
  const r = scheduleAdherence(schedule, { from: "2026-11-01", to: "2026-11-07" }, [
    { day: "2026-11-01", firstMinute: 9 * 60 + 5, activeMinutes: 400, shiftMinutes: 400 }, // on time (grace)
    { day: "2026-11-02", firstMinute: 10 * 60, activeMinutes: 300, shiftMinutes: 300 }, // 60 min late
    { day: "2026-11-03", firstMinute: 9 * 60 + 40, activeMinutes: 320, shiftMinutes: 320 }, // 40 min late
    { day: "2026-11-06", firstMinute: 10 * 60, activeMinutes: 60, shiftMinutes: 0 }, // Friday: not a workday
  ]);
  assert.ok(r);
  assert.equal(r.workdays, 5);
  assert.equal(r.present, 3);
  assert.equal(r.attendance, 60);
  assert.equal(r.punctuality, 33);
  assert.equal(r.avgLateMinutes, 50);
  assert.equal(r.coverage, Math.round((1020 / 2400) * 100));
  assert.equal(scheduleAdherence(null, { from: "2026-11-01", to: "2026-11-07" }, []), null);
});
