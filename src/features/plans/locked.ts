import "server-only";
import { and, asc, count, eq, gte, lt } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { getEffectiveLimits } from "@/server/limits";
import { algeriaMonthStart } from "@/lib/time";
import { scheduleOrderSync } from "@/features/apps/sync";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Called while placing an order (shop row locked): true when this month's quota is already used,
// so the order is kept but locked. limit -1 = unlimited.
export async function overOrderLimit(tx: Tx, shopId: string, limit: number) {
  if (limit === -1) return false;
  const [{ n }] = await tx.select({ n: count() }).from(schema.orders).where(and(eq(schema.orders.shopId, shopId), gte(schema.orders.createdAt, algeriaMonthStart())));
  return n >= limit;
}

// Unlocks what the shop is now entitled to see: every locked order of past months, and this month's
// locked orders (oldest first) up to the room left in the quota (e.g. after an upgrade).
// Unlocked orders are sent to the shop's apps, which never received them.
export async function releaseLockedOrders(shopId: string) {
  const o = schema.orders;
  const [{ n: lockedCount }] = await db.select({ n: count() }).from(o).where(and(eq(o.shopId, shopId), eq(o.locked, true)));
  if (!lockedCount) return 0;
  const monthStart = algeriaMonthStart();
  const ids: string[] = [];
  ids.push(...(await db.select({ id: o.id }).from(o).where(and(eq(o.shopId, shopId), eq(o.locked, true), lt(o.createdAt, monthStart)))).map((r) => r.id));
  const limit = (await getEffectiveLimits(shopId)).maxOrdersPerMonth;
  const thisMonth = and(eq(o.shopId, shopId), eq(o.locked, true), gte(o.createdAt, monthStart));
  if (limit === -1) ids.push(...(await db.select({ id: o.id }).from(o).where(thisMonth)).map((r) => r.id));
  else {
    const [{ n: open }] = await db.select({ n: count() }).from(o).where(and(eq(o.shopId, shopId), eq(o.locked, false), gte(o.createdAt, monthStart)));
    const room = limit - open;
    if (room > 0) ids.push(...(await db.select({ id: o.id }).from(o).where(thisMonth).orderBy(asc(o.createdAt)).limit(room)).map((r) => r.id));
  }
  for (const id of ids) {
    await db.update(o).set({ locked: false }).where(and(eq(o.shopId, shopId), eq(o.id, id)));
    scheduleOrderSync(shopId, id, "order.created");
  }
  return ids.length;
}

export async function lockedOrderCount(shopId: string) {
  const [{ n }] = await db.select({ n: count() }).from(schema.orders).where(and(eq(schema.orders.shopId, shopId), eq(schema.orders.locked, true)));
  return n;
}
