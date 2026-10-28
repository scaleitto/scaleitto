// Algeria time helpers (the platform's merchants all work in Africa/Algiers, UTC+1 all year).
export const TIME_ZONE = "Africa/Algiers";

const partsFormat = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" });
const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// The Algeria calendar day ("YYYY-MM-DD"), weekday (0 = Sunday) and minute of the day of an instant.
export function algeriaParts(d: Date) {
  const p = Object.fromEntries(partsFormat.formatToParts(d).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, weekday: weekdays[p.weekday], minutes: Number(p.hour) * 60 + Number(p.minute) };
}

// "09:30" → 570
export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// Days from `from` to `to` included, as "YYYY-MM-DD" (calendar arithmetic in UTC, no time zone involved).
export function daysBetween(from: string, to: string) {
  const out: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
}

export const weekdayOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// The first instant of the current Algeria month (monthly quotas follow Algeria's calendar)
export function algeriaMonthStart(now = new Date()) {
  return new Date(`${algeriaParts(now).day.slice(0, 8)}01T00:00:00+01:00`);
}

// The first instant of the current Algeria day
export function algeriaDayStart(now = new Date()) {
  return new Date(`${algeriaParts(now).day}T00:00:00+01:00`);
}
