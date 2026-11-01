import { addDays, algeriaParts, weekdayOf } from "@/lib/time";

export type DayPoint = { day: string; weekday: number; assigned: number; confirmed: number };

// The agent portal's 7-day trend (pure): orders handed to the agent and orders they confirmed, per Algeria day,
// oldest first; today is the last point
export function agentTrend(assignedAt: Date[], confirmedAt: Date[], now = new Date(), days = 7): DayPoint[] {
  const today = algeriaParts(now).day;
  const points = Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i - days + 1);
    return { day, weekday: weekdayOf(day), assigned: 0, confirmed: 0 };
  });
  const at = new Map(points.map((p) => [p.day, p]));
  for (const d of assignedAt) {
    const p = at.get(algeriaParts(d).day);
    if (p) p.assigned++;
  }
  for (const d of confirmedAt) {
    const p = at.get(algeriaParts(d).day);
    if (p) p.confirmed++;
  }
  return points;
}

// Confirmed ÷ assigned as a whole percent (null without assigned orders), capped at 100
export const confirmShare = (confirmed: number, assigned: number) => (assigned > 0 ? Math.min(100, Math.round((confirmed / assigned) * 100)) : null);
