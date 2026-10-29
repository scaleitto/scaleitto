import "server-only";
import { and, asc, count, eq, gt, gte, lt, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { orderRule, type OrderRule } from "@/server/limits";
import { algeriaMonthStart } from "@/lib/time";
import { scheduleOrderSync } from "@/features/apps/sync";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Called while placing an order (shop row locked): true when the order must be kept but locked — this month's
// quota is used (limit -1 = unlimited), or a pay-as-you-go balance is empty (otherwise the order uses one).
export async function takeOrderSlot(tx: Tx, shopId: string, rule: OrderRule) {
  if (rule.kind === "credits") return !(await spendCredit(tx, shopId));
  if (rule.limit === -1) return false;
  const [{ n }] = await tx.select({ n: count() }).from(schema.orders).where(and(eq(schema.orders.shopId, shopId), gte(schema.orders.createdAt, algeriaMonthStart())));
  return n >= rule.limit;
}

async function spendCredit(tx: Tx | typeof db, shopId: string) {
  const [res] = await tx
    .update(schema.shops)
    .set({ orderCredits: sql`${schema.shops.orderCredits} - 1` })
    .where(and(eq(schema.shops.id, shopId), gt(schema.shops.orderCredits, 0)));
  return res.affectedRows > 0;
}

// Unlocks what the shop is now entitled to see (e.g. after an upgrade or a top-up), oldest first: with a monthly
// quota, every locked order of past months and this month's up to the room left; with a pay-as-you-go balance,
// as many locked orders as the balance pays for. Unlocked orders are sent to the shop's apps, which never received them.
export async function releaseLockedOrders(shopId: string) {
  const o = schema.orders;
  const [{ n: lockedCount }] = await db.select({ n: count() }).from(o).where(and(eq(o.shopId, shopId), eq(o.locked, true)));
  if (!lockedCount) return 0;
  const rule = await orderRule(shopId);
  const locked = and(eq(o.shopId, shopId), eq(o.locked, true));
  const ids: string[] = [];
  if (rule.kind === "credits") {
    for (const { id } of await db.select({ id: o.id }).from(o).where(locked).orderBy(asc(o.createdAt)).limit(rule.credits)) {
      const paid = await db.transaction(async (tx) => {
        if (!(await spendCredit(tx, shopId))) return false;
        await tx.update(o).set({ locked: false }).where(and(eq(o.shopId, shopId), eq(o.id, id), eq(o.locked, true)));
        return true;
      });
      if (!paid) break;
      ids.push(id);
    }
  } else {
    const monthStart = algeriaMonthStart();
    ids.push(...(await db.select({ id: o.id }).from(o).where(and(locked, lt(o.createdAt, monthStart)))).map((r) => r.id));
    const thisMonth = and(locked, gte(o.createdAt, monthStart));
    if (rule.limit === -1) ids.push(...(await db.select({ id: o.id }).from(o).where(thisMonth)).map((r) => r.id));
    else {
      const [{ n: open }] = await db.select({ n: count() }).from(o).where(and(eq(o.shopId, shopId), eq(o.locked, false), gte(o.createdAt, monthStart)));
      const room = rule.limit - open;
      if (room > 0) ids.push(...(await db.select({ id: o.id }).from(o).where(thisMonth).orderBy(asc(o.createdAt)).limit(room)).map((r) => r.id));
    }
    for (const id of ids) await db.update(o).set({ locked: false }).where(and(eq(o.shopId, shopId), eq(o.id, id)));
  }
  for (const id of ids) await scheduleOrderSync(shopId, id, "order.created");
  return ids.length;
}

export async function lockedOrderCount(shopId: string) {
  const [{ n }] = await db.select({ n: count() }).from(schema.orders).where(and(eq(schema.orders.shopId, shopId), eq(schema.orders.locked, true)));
  return n;
}
