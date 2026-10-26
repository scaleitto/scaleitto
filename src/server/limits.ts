import "server-only";
import { and, count, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { limitKeys, type LimitKey } from "@/server/db/schema";

// -1 means unlimited
export type EffectiveLimits = Record<LimitKey, number>;

const today = () => new Date().toISOString().slice(0, 10);

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

// The plan's limits, overridden key by key by the shop's active contract.
export async function getEffectiveLimits(shopId: string): Promise<EffectiveLimits> {
  const [[row], contract] = await Promise.all([
    db.select({ limits: schema.plans.limits }).from(schema.shops).innerJoin(schema.plans, eq(schema.plans.id, schema.shops.planId)).where(eq(schema.shops.id, shopId)),
    getActiveContract(shopId),
  ]);
  const limits = {} as EffectiveLimits;
  for (const key of limitKeys) limits[key] = contract?.limits[key] ?? row?.limits[key] ?? 0;
  return limits;
}

// How much of each limit a shop uses. Sections add their counter when they are built.
const counters: Partial<Record<LimitKey, (shopId: string) => Promise<number>>> = {
  maxProducts: async (shopId) => (await db.select({ n: count() }).from(schema.products).where(eq(schema.products.shopId, shopId)))[0].n,
  maxOrdersPerMonth: async (shopId) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return (await db.select({ n: count() }).from(schema.orders).where(and(eq(schema.orders.shopId, shopId), gte(schema.orders.createdAt, monthStart))))[0].n;
  },
  maxStaff: async (shopId) => (await db.select({ n: count() }).from(schema.shopMembers).where(eq(schema.shopMembers.shopId, shopId)))[0].n,
};

export async function getUsage(shopId: string, key: LimitKey) {
  return (await counters[key]?.(shopId)) ?? 0;
}

export async function canAdd(shopId: string, key: LimitKey, adding = 1) {
  const [limits, used] = await Promise.all([getEffectiveLimits(shopId), getUsage(shopId, key)]);
  return limits[key] === -1 || used + adding <= limits[key];
}
