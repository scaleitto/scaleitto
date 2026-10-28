import "server-only";
import { and, count, eq, gte, inArray, isNull, max } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { newId } from "@/server/auth/context";
import { algeriaDayStart, algeriaParts } from "@/lib/time";
import { scheduleOrderSync } from "@/features/apps/sync";
import { OPEN_STATUSES } from "./assign";
import { inShift } from "./schedule";

// What the manager sees of the distribution: each active agent's load right now and today.
export async function distributionBoard(shopId: string, now = new Date()) {
  const o = schema.orders;
  const [agents, open, today, last, [unassigned]] = await Promise.all([
    db
      .select({ userId: schema.shopMembers.userId, name: schema.users.name, schedule: schema.shopMembers.schedule })
      .from(schema.shopMembers)
      .innerJoin(schema.users, eq(schema.users.id, schema.shopMembers.userId))
      .where(and(eq(schema.shopMembers.shopId, shopId), eq(schema.shopMembers.role, "agent"), eq(schema.shopMembers.active, true))),
    db.select({ userId: o.assignedTo, n: count() }).from(o).where(and(eq(o.shopId, shopId), inArray(o.status, [...OPEN_STATUSES]))).groupBy(o.assignedTo),
    db.select({ userId: o.assignedTo, n: count() }).from(o).where(and(eq(o.shopId, shopId), gte(o.assignedAt, algeriaDayStart(now)))).groupBy(o.assignedTo),
    db.select({ userId: o.assignedTo, at: max(o.assignedAt) }).from(o).where(eq(o.shopId, shopId)).groupBy(o.assignedTo),
    db.select({ n: count() }).from(o).where(and(eq(o.shopId, shopId), isNull(o.assignedTo), eq(o.locked, false), inArray(o.status, [...OPEN_STATUSES]))),
  ]);
  const map = (rows: { userId: string | null; n: number }[]) => new Map(rows.map((r) => [r.userId, r.n]));
  const openBy = map(open);
  const todayBy = map(today);
  const lastBy = new Map(last.map((r) => [r.userId, r.at ? new Date(r.at) : null]));
  const { weekday, minutes } = algeriaParts(now);
  return {
    unassigned: unassigned.n,
    agents: agents
      .map((a) => ({
        userId: a.userId,
        name: a.name,
        onShift: inShift(a.schedule ?? null, weekday, minutes),
        open: openBy.get(a.userId) ?? 0,
        today: todayBy.get(a.userId) ?? 0,
        lastAssignedAt: lastBy.get(a.userId) ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export type Spread = { assigned: number; byAgent: { name: string; n: number }[] };

// Shares orders between the active agents, one at a time to whoever has the fewest open orders
// (the same rule as the automatic distribution). `orderIds` null = every unassigned open order.
export async function spreadOrders(shopId: string, byUserId: string, orderIds: string[] | null): Promise<Spread | "noAgents"> {
  const o = schema.orders;
  const board = await distributionBoard(shopId);
  if (!board.agents.length) return "noAgents";
  const where = orderIds
    ? and(eq(o.shopId, shopId), eq(o.locked, false), inArray(o.id, orderIds.length ? orderIds : ["-"]))
    : and(eq(o.shopId, shopId), eq(o.locked, false), isNull(o.assignedTo), inArray(o.status, [...OPEN_STATUSES]));
  const orders = await db.select({ id: o.id, assignedTo: o.assignedTo, status: o.status }).from(o).where(where).orderBy(o.createdAt);
  const load = new Map(board.agents.map((a) => [a.userId, a.open]));
  const given = new Map<string, number>();
  for (const order of orders) {
    // A re-assigned open order no longer weighs on its previous agent
    if (order.assignedTo && load.has(order.assignedTo) && (OPEN_STATUSES as readonly string[]).includes(order.status)) load.set(order.assignedTo, load.get(order.assignedTo)! - 1);
    const agent = [...board.agents].sort((a, b) => load.get(a.userId)! - load.get(b.userId)! || (given.get(a.userId) ?? 0) - (given.get(b.userId) ?? 0))[0];
    load.set(agent.userId, load.get(agent.userId)! + 1);
    given.set(agent.userId, (given.get(agent.userId) ?? 0) + 1);
    await db.update(o).set({ assignedTo: agent.userId, assignedAt: new Date() }).where(and(eq(o.shopId, shopId), eq(o.id, order.id)));
    await db.insert(schema.orderEvents).values({ id: newId(), orderId: order.id, shopId, userId: byUserId, type: "assign", note: agent.name });
    scheduleOrderSync(shopId, order.id);
  }
  return {
    assigned: orders.length,
    byAgent: board.agents.filter((a) => given.has(a.userId)).map((a) => ({ name: a.name, n: given.get(a.userId)! })),
  };
}
