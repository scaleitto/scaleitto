import "server-only";
import { and, count, desc, eq, gte, inArray, isNotNull, lt, lte, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { addDays, algeriaParts } from "@/lib/time";
import { scheduleAdherence, type DayActivity } from "./schedule";
import { OPEN_STATUSES } from "./assign";
import type { TeamMember } from "./queries";

export const periods = ["today", "7d", "30d"] as const;
export type Period = (typeof periods)[number];

// A period as Algeria days and as instants (Algeria is UTC+1 all year).
export function periodRange(period: Period, now = new Date()) {
  const today = algeriaParts(now).day;
  const from = period === "today" ? today : addDays(today, period === "7d" ? -6 : -29);
  return { fromDay: from, toDay: today, start: new Date(`${from}T00:00:00+01:00`), end: new Date(`${addDays(today, 1)}T00:00:00+01:00`) };
}

const ONLINE_WINDOW_MS = 3 * 60_000;
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);

export async function teamPerformance(shopId: string, team: TeamMember[], period: Period, now = new Date()) {
  const { fromDay, toDay, start, end } = periodRange(period, now);
  const ids = team.map((m) => m.userId);
  if (!ids.length) return [];
  const e = schema.orderEvents;
  const o = schema.orders;

  const [events, assigned, open, activity, response] = await Promise.all([
    // What each member did in the period
    db
      .select({ userId: e.userId, type: e.type, toStatus: e.toStatus, n: count() })
      .from(e)
      .where(and(eq(e.shopId, shopId), inArray(e.userId, ids), gte(e.createdAt, start), lt(e.createdAt, end)))
      .groupBy(e.userId, e.type, e.toStatus),
    // Orders handed to each member in the period, by their current status
    db
      .select({ userId: o.assignedTo, status: o.status, n: count() })
      .from(o)
      .where(and(eq(o.shopId, shopId), inArray(o.assignedTo, ids), gte(o.assignedAt, start), lt(o.assignedAt, end)))
      .groupBy(o.assignedTo, o.status),
    // Orders still waiting with each member right now
    db
      .select({ userId: o.assignedTo, n: count() })
      .from(o)
      .where(and(eq(o.shopId, shopId), inArray(o.assignedTo, ids), inArray(o.status, [...OPEN_STATUSES])))
      .groupBy(o.assignedTo),
    db
      .select()
      .from(schema.memberActivity)
      .where(and(eq(schema.memberActivity.shopId, shopId), inArray(schema.memberActivity.userId, ids), gte(schema.memberActivity.day, fromDay), lte(schema.memberActivity.day, toDay))),
    // Average minutes between receiving an order and the member's first action on it
    db
      .select({
        userId: o.assignedTo,
        // plain SQL names: inside a select Drizzle drops table names, which would make them ambiguous
        avg: sql<string | null>`avg(timestampdiff(second, orders.assigned_at, (select min(fe.created_at) from order_events fe where fe.order_id = orders.id and fe.user_id = orders.assigned_to and fe.type in ('status','note','edit') and fe.created_at >= orders.assigned_at)))`,
      })
      .from(o)
      .where(and(eq(o.shopId, shopId), inArray(o.assignedTo, ids), isNotNull(o.assignedAt), gte(o.assignedAt, start), lt(o.assignedAt, end)))
      .groupBy(o.assignedTo),
  ]);

  return team.map((m) => {
    const mine = events.filter((x) => x.userId === m.userId);
    const by = (status: string) => mine.filter((x) => x.type === "status" && x.toStatus === status).reduce((s, x) => s + x.n, 0);
    const confirmed = by("confirmed");
    const cancelled = by("cancelled");
    const got = assigned.filter((x) => x.userId === m.userId);
    const gotBy = (status: string) => got.filter((x) => x.status === status).reduce((s, x) => s + x.n, 0);
    const delivered = gotBy("delivered");
    const returned = gotBy("returned");
    const days = activity.filter((a) => a.userId === m.userId);
    const dayActivity: DayActivity[] = days.map((d) => ({ day: d.day, firstMinute: algeriaParts(new Date(d.firstSeen)).minutes, activeMinutes: d.activeMinutes, shiftMinutes: d.shiftMinutes }));
    const today = days.find((d) => d.day === toDay);
    const lastSeen = days.reduce<Date | null>((latest, d) => (!latest || new Date(d.lastSeen) > latest ? new Date(d.lastSeen) : latest), null);
    const avgSeconds = response.find((r) => r.userId === m.userId)?.avg;
    return {
      userId: m.userId,
      name: m.name,
      role: m.role,
      active: m.active,
      schedule: m.schedule ?? null,
      assigned: got.reduce((s, x) => s + x.n, 0),
      open: open.find((x) => x.userId === m.userId)?.n ?? 0,
      actions: mine.reduce((s, x) => s + x.n, 0),
      confirmed,
      cancelled,
      noAnswer: by("no_answer"),
      postponed: by("postponed"),
      notes: mine.filter((x) => x.type === "note").reduce((s, x) => s + x.n, 0),
      // Of the calls that ended in a decision, how many were confirmations
      confirmRate: pct(confirmed, confirmed + cancelled),
      // Of their orders that reached the customer or came back, how many were delivered
      deliveryRate: pct(delivered, delivered + returned),
      avgResponseMinutes: avgSeconds == null ? null : Math.round(Number(avgSeconds) / 60),
      activeMinutes: days.reduce((s, d) => s + d.activeMinutes, 0),
      daysActive: days.filter((d) => d.activeMinutes > 0).length,
      adherence: scheduleAdherence(m.schedule ?? null, { from: fromDay, to: toDay }, dayActivity),
      todayStart: today ? new Date(today.firstSeen) : null,
      lastSeen,
      online: Boolean(lastSeen && now.getTime() - lastSeen.getTime() < ONLINE_WINDOW_MS),
    };
  });
}

export type MemberPerformance = Awaited<ReturnType<typeof teamPerformance>>[number];

// Latest actions of the team on orders (the activity log).
export async function teamActivityLog(shopId: string, userId?: string, limit = 100) {
  const e = schema.orderEvents;
  return db
    .select({ id: e.id, type: e.type, fromStatus: e.fromStatus, toStatus: e.toStatus, note: e.note, createdAt: e.createdAt, userName: schema.users.name, orderId: e.orderId, orderNumber: schema.orders.number })
    .from(e)
    .innerJoin(schema.users, eq(schema.users.id, e.userId))
    .innerJoin(schema.orders, eq(schema.orders.id, e.orderId))
    .where(and(eq(e.shopId, shopId), isNotNull(e.userId), userId ? eq(e.userId, userId) : undefined))
    .orderBy(desc(e.createdAt))
    .limit(limit);
}
