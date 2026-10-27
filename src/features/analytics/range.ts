// The period an analytics page looks at, in Algeria days, plus the period just before it (same length) for comparison.
import { addDays, algeriaParts, daysBetween } from "@/lib/time";

export const presets = ["today", "yesterday", "7d", "30d", "90d", "month"] as const;
export type Preset = (typeof presets)[number] | "custom";
export const MAX_DAYS = 366;

const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());
// Algeria is UTC+1 all year
export const dayStart = (day: string) => new Date(`${day}T00:00:00+01:00`);

export type Range = { preset: Preset; fromDay: string; toDay: string; days: string[]; start: Date; end: Date; prevStart: Date };

export function resolveRange(input: { period?: unknown; from?: unknown; to?: unknown }, now = new Date()): Range {
  const today = algeriaParts(now).day;
  let preset: Preset = presets.includes(input.period as (typeof presets)[number]) ? (input.period as Preset) : "30d";
  let fromDay: string;
  let toDay = today;
  if (input.period === "custom" && isDay(input.from) && isDay(input.to)) {
    preset = "custom";
    [fromDay, toDay] = input.from <= input.to ? [input.from, input.to] : [input.to, input.from];
    if (toDay > today) toDay = today;
    if (fromDay > toDay) fromDay = toDay;
    if (daysBetween(fromDay, toDay).length > MAX_DAYS) fromDay = addDays(toDay, -(MAX_DAYS - 1));
  } else if (preset === "yesterday") {
    fromDay = toDay = addDays(today, -1);
  } else if (preset === "month") {
    fromDay = `${today.slice(0, 8)}01`;
  } else {
    const back = { today: 0, "7d": 6, "30d": 29, "90d": 89 }[preset as "today" | "7d" | "30d" | "90d"];
    fromDay = addDays(today, -back);
  }
  const days = daysBetween(fromDay, toDay);
  return { preset, fromDay, toDay, days, start: dayStart(fromDay), end: dayStart(addDays(toDay, 1)), prevStart: dayStart(addDays(fromDay, -days.length)) };
}
