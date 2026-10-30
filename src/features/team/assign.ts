import "server-only";
import { and, count, eq, inArray, isNotNull, max } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { algeriaParts } from "@/lib/time";
import { inShift } from "./schedule";
import { PENDING_STATUSES } from "@/features/orders/statuses";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Orders still waiting for the call center
export const OPEN_STATUSES = PENDING_STATUSES;

// Chooses the agent for a new order: the active agent with the fewest open orders
// (ties → the one who got an order least recently). In "on_shift" mode only agents
// currently in their working hours are considered, falling back to every active agent.
export async function pickAgent(tx: Tx, shopId: string, now = new Date()): Promise<{ userId: string; name: string } | null> {
  const [shop] = await tx.select({ mode: schema.shops.assignMode }).from(schema.shops).where(eq(schema.shops.id, shopId));
  if (!shop || shop.mode === "manual") return null;

  let agents = await tx
    .select({ userId: schema.shopMembers.userId, name: schema.users.name, schedule: schema.shopMembers.schedule })
    .from(schema.shopMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.shopMembers.userId))
    .where(and(eq(schema.shopMembers.shopId, shopId), eq(schema.shopMembers.role, "agent"), eq(schema.shopMembers.active, true)));
  if (!agents.length) return null;
  if (shop.mode === "on_shift") {
    const { weekday, minutes } = algeriaParts(now);
    const onShift = agents.filter((a) => inShift(a.schedule ?? null, weekday, minutes));
    if (onShift.length) agents = onShift;
  }

  const ids = agents.map((a) => a.userId);
  const o = schema.orders;
  const [load, recent] = await Promise.all([
    tx
      .select({ userId: o.assignedTo, n: count() })
      .from(o)
      .where(and(eq(o.shopId, shopId), inArray(o.assignedTo, ids), inArray(o.status, [...OPEN_STATUSES])))
      .groupBy(o.assignedTo),
    tx
      .select({ userId: o.assignedTo, last: max(o.assignedAt) })
      .from(o)
      .where(and(eq(o.shopId, shopId), inArray(o.assignedTo, ids), isNotNull(o.assignedAt)))
      .groupBy(o.assignedTo),
  ]);
  const open = new Map(load.map((l) => [l.userId, l.n]));
  const last = new Map(recent.map((r) => [r.userId, r.last ? new Date(r.last).getTime() : 0]));
  agents.sort((a, b) => (open.get(a.userId) ?? 0) - (open.get(b.userId) ?? 0) || (last.get(a.userId) ?? 0) - (last.get(b.userId) ?? 0));
  return { userId: agents[0].userId, name: agents[0].name };
}
