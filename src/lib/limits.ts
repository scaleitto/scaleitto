import "server-only";
import { and, count, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Limits } from "@/db/schema";

export type LimitKey = keyof Limits;
export type EffectiveLimits = Record<LimitKey, number>; // -1 = unlimited

const today = () => new Date().toISOString().slice(0, 10);

export function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function getActiveContract(shopId: string) {
  const [contract] = await db
    .select()
    .from(schema.shopContracts)
    .where(
      and(
        eq(schema.shopContracts.shopId, shopId),
        lte(schema.shopContracts.startDate, today()),
        or(isNull(schema.shopContracts.endDate), gte(schema.shopContracts.endDate, today())),
      ),
    )
    .orderBy(desc(schema.shopContracts.startDate))
    .limit(1);
  return contract ?? null;
}

// Plan limits, overridden field-by-field by the shop's active contract.
export async function getEffectiveLimits(shopId: string) {
  const [row] = await db
    .select({ plan: schema.plans })
    .from(schema.shops)
    .innerJoin(schema.plans, eq(schema.plans.id, schema.shops.planId))
    .where(eq(schema.shops.id, shopId));
  const contract = await getActiveContract(shopId);
  const planLimits = row?.plan.limits ?? {};
  const keys: LimitKey[] = ["maxProducts", "maxOrdersPerMonth", "maxStaff", "maxLandingPages"];
  const limits = {} as EffectiveLimits;
  for (const k of keys) {
    limits[k] = contract?.limits[k] ?? planLimits[k] ?? 0;
  }
  return { plan: row?.plan ?? null, contract, limits };
}

export async function getUsage(shopId: string) {
  const [[products], [orders], [staff]] = await Promise.all([
    db.select({ n: count() }).from(schema.products).where(eq(schema.products.shopId, shopId)),
    db
      .select({ n: count() })
      .from(schema.orders)
      .where(and(eq(schema.orders.shopId, shopId), gte(schema.orders.createdAt, startOfMonth()))),
    db.select({ n: count() }).from(schema.shopMembers).where(eq(schema.shopMembers.shopId, shopId)),
  ]);
  return {
    maxProducts: products.n,
    maxOrdersPerMonth: orders.n,
    maxStaff: staff.n,
    maxLandingPages: 0,
  } satisfies EffectiveLimits;
}

export async function canAdd(shopId: string, key: LimitKey) {
  const [{ limits }, usage] = await Promise.all([getEffectiveLimits(shopId), getUsage(shopId)]);
  return limits[key] === -1 || usage[key] < limits[key];
}

export const percentUsed = (used: number, limit: number) =>
  limit === -1 ? 0 : limit === 0 ? 100 : Math.round((used / limit) * 100);
