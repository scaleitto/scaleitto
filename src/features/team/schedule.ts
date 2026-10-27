import type { WorkSchedule } from "@/server/db/schema";
import { daysBetween, toMinutes, weekdayOf } from "@/lib/time";

// Minutes a member may start late before counting as late
export const GRACE_MINUTES = 15;

export const isValidTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

// Is this minute of the day inside the shift? (Night shifts crossing midnight are supported.)
export function inShift(schedule: WorkSchedule | null, weekday: number, minutes: number) {
  if (!schedule) return false;
  const start = toMinutes(schedule.start);
  const end = toMinutes(schedule.end);
  if (start <= end) return schedule.days.includes(weekday) && minutes >= start && minutes < end;
  // e.g. 22:00 → 06:00: the part after midnight belongs to the previous day's shift
  return (schedule.days.includes(weekday) && minutes >= start) || (schedule.days.includes((weekday + 6) % 7) && minutes < end);
}

export const shiftLength = (s: WorkSchedule) => {
  const len = toMinutes(s.end) - toMinutes(s.start);
  return len > 0 ? len : len + 24 * 60;
};

export type DayActivity = { day: string; firstMinute: number; activeMinutes: number; shiftMinutes: number };

// How well a member followed their schedule over a period.
export function scheduleAdherence(schedule: WorkSchedule | null, days: { from: string; to: string }, activity: DayActivity[]) {
  if (!schedule || !schedule.days.length) return null;
  const byDay = new Map(activity.map((a) => [a.day, a]));
  const workdays = daysBetween(days.from, days.to).filter((d) => schedule.days.includes(weekdayOf(d)));
  const start = toMinutes(schedule.start);
  let present = 0;
  let onTime = 0;
  let lateTotal = 0;
  let shiftWorked = 0;
  for (const day of workdays) {
    const a = byDay.get(day);
    if (!a || a.activeMinutes === 0) continue;
    present++;
    shiftWorked += a.shiftMinutes;
    const late = a.firstMinute - start;
    if (late <= GRACE_MINUTES) onTime++;
    else lateTotal += late;
  }
  const late = present - onTime;
  const planned = workdays.length * shiftLength(schedule);
  return {
    workdays: workdays.length,
    present,
    attendance: workdays.length ? Math.round((present / workdays.length) * 100) : null,
    punctuality: present ? Math.round((onTime / present) * 100) : null,
    avgLateMinutes: late ? Math.round(lateTotal / late) : 0,
    // Share of the planned shift hours actually spent working
    coverage: planned ? Math.min(100, Math.round((shiftWorked / planned) * 100)) : null,
  };
}
