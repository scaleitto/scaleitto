import "server-only";
import { and, count, eq, inArray, isNotNull, max } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { algeriaParts } from "@/lib/time";
import { inShift } from "./schedule";
import { resolveApps } from "@/features/apps/settings";
import { matchAgentRules, type OrderSource } from "@/features/apps/rules";
import { PENDING_STATUSES } from "@/features/orders/statuses";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Orders still waiting for the call center
export const OPEN_STATUSES = PENDING_STATUSES;

// Chooses the agent for a new order. Apps → Agent auto assign rules come first: the order goes to the matching rules'
// agents (any mode). Otherwise: the active agent with the fewest open orders (ties → the one who got an order least
// recently); in "on_shift" mode only agents currently in their working hours, falling back to every active agent.
export async function pickAgent(tx: Tx, shopId: string, order: { productIds: string[]; wilaya: number; source: OrderSource } | null = null, now = new Date()): Promise<{ userId: string; name: string } | null> {
  const [shop] = await tx.select({ mode: schema.shops.assignMode, apps: schema.shops.apps }).from(schema.shops).where(eq(schema.shops.id, shopId));
  if (!shop) return null;
  const ruled = order ? matchAgentRules(resolveApps(shop.apps).agentRules, { ...order, minutes: algeriaParts(now).minutes }) : [];
  if (!ruled.length && shop.mode === "manual") return null;

  let agents = await tx
    .select({ userId: schema.shopMembers.userId, name: schema.users.name, schedule: schema.shopMembers.schedule })
    .from(schema.shopMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.shopMembers.userId))
    .where(and(eq(schema.shopMembers.shopId, shopId), eq(schema.shopMembers.role, "agent"), eq(schema.shopMembers.active, true)));
  const chosen = agents.filter((a) => ruled.includes(a.userId));
  if (chosen.length) agents = chosen;
  else if (shop.mode === "manual") return null;
  if (!agents.length) return null;
  if (!chosen.length && shop.mode === "on_shift") {
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
