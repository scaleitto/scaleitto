import "server-only";
import { and, count, countDistinct, eq, gte } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { addDays, algeriaParts } from "@/lib/time";
import { agentTrend, confirmShare } from "./agent-stats";

// Figures of the agent portal's dashboard (Zimam's "Agent overview"), only for the signed-in agent
export async function agentOverview(shopId: string, userId: string, now = new Date()) {
  const o = schema.orders;
  const e = schema.orderEvents;
  const since = new Date(`${addDays(algeriaParts(now).day, -6)}T00:00:00+01:00`);
  const confirmedBy = and(eq(e.shopId, shopId), eq(e.userId, userId), eq(e.type, "status"), eq(e.toStatus, "confirmed"));
  const [assignedRows, confirmedRows, [totalAssigned], [totalConfirmed]] = await Promise.all([
    db.select({ at: o.assignedAt }).from(o).where(and(eq(o.shopId, shopId), eq(o.assignedTo, userId), gte(o.assignedAt, since))),
    db.select({ at: e.createdAt }).from(e).where(and(confirmedBy, gte(e.createdAt, since))),
    db.select({ n: count() }).from(o).where(and(eq(o.shopId, shopId), eq(o.assignedTo, userId))),
    db.select({ n: countDistinct(e.orderId) }).from(e).where(confirmedBy),
  ]);
  const trend = agentTrend(
    assignedRows.flatMap((r) => (r.at ? [new Date(r.at)] : [])),
    confirmedRows.map((r) => new Date(r.at)),
    now,
  );
  const week = trend.reduce((s, p) => ({ assigned: s.assigned + p.assigned, confirmed: s.confirmed + p.confirmed }), { assigned: 0, confirmed: 0 });
  const today = trend[trend.length - 1];
  return {
    today,
    trend,
    week,
    rate: confirmShare(week.confirmed, week.assigned),
    totalAssigned: totalAssigned?.n ?? 0,
    totalConfirmed: totalConfirmed?.n ?? 0,
  };
}
export type AgentOverview = Awaited<ReturnType<typeof agentOverview>>;
