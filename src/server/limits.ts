import "server-only";
import { and, count, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { limitKeys, type LimitKey } from "@/server/db/schema";
import { algeriaMonthStart } from "@/lib/time";

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

export const FREE_PLAN = "starter";

// The shop's plan, or the free plan once a paid period has ended
export async function getCurrentPlan(shopId: string) {
  const [row] = await db
    .select({ plan: schema.plans, expiresAt: schema.shops.planExpiresAt })
    .from(schema.shops)
    .innerJoin(schema.plans, eq(schema.plans.id, schema.shops.planId))
    .where(eq(schema.shops.id, shopId));
  if (!row) return null;
  const expired = Boolean(row.expiresAt && row.expiresAt < new Date() && row.plan.code !== FREE_PLAN);
  if (!expired) return { plan: row.plan, expiresAt: row.expiresAt, expired: false };
  const [free] = await db.select().from(schema.plans).where(eq(schema.plans.code, FREE_PLAN));
  return { plan: free ?? row.plan, expiresAt: row.expiresAt, expired: true, previous: row.plan };
}

// A shop owned by the platform admin (the platform's own store): no plan, no limits, every feature.
export async function isPlatformShop(shopId: string) {
  const [row] = await db
    .select({ admin: schema.users.isPlatformAdmin })
    .from(schema.shops)
    .innerJoin(schema.users, eq(schema.users.id, schema.shops.ownerId))
    .where(eq(schema.shops.id, shopId));
  return Boolean(row?.admin);
}

const UNLIMITED = Object.fromEntries(limitKeys.map((k) => [k, -1])) as EffectiveLimits;

// The plan's limits, overridden key by key by the shop's active contract.
export async function getEffectiveLimits(shopId: string): Promise<EffectiveLimits> {
  if (await isPlatformShop(shopId)) return { ...UNLIMITED };
  const [current, contract] = await Promise.all([getCurrentPlan(shopId), getActiveContract(shopId)]);
  const row = current?.plan;
  const limits = {} as EffectiveLimits;
  for (const key of limitKeys) limits[key] = contract?.limits[key] ?? row?.limits[key] ?? 0;
  return limits;
}

// How much of each limit a shop uses. Sections add their counter when they are built.
const counters: Partial<Record<LimitKey, (shopId: string) => Promise<number>>> = {
  maxProducts: async (shopId) => (await db.select({ n: count() }).from(schema.products).where(eq(schema.products.shopId, shopId)))[0].n,
  maxOrdersPerMonth: async (shopId) => (await db.select({ n: count() }).from(schema.orders).where(and(eq(schema.orders.shopId, shopId), gte(schema.orders.createdAt, algeriaMonthStart()))))[0].n,
  maxLandingPages: async (shopId) => (await db.select({ n: count() }).from(schema.landingPages).where(eq(schema.landingPages.shopId, shopId)))[0].n,
  // Every request sent to the AI this month (failed ones included: they used the AI too)
  maxAiPerMonth: async (shopId) => (await db.select({ n: count() }).from(schema.aiGenerations).where(and(eq(schema.aiGenerations.shopId, shopId), gte(schema.aiGenerations.createdAt, algeriaMonthStart()))))[0].n,
  // Deactivated members do not count
  maxStaff: async (shopId) => (await db.select({ n: count() }).from(schema.shopMembers).where(and(eq(schema.shopMembers.shopId, shopId), eq(schema.shopMembers.active, true))))[0].n,
};

export async function getAllUsage(shopId: string): Promise<Record<LimitKey, number>> {
  const values = await Promise.all(limitKeys.map((k) => getUsage(shopId, k)));
  return Object.fromEntries(limitKeys.map((k, i) => [k, values[i]])) as Record<LimitKey, number>;
}

export async function getUsage(shopId: string, key: LimitKey) {
  return (await counters[key]?.(shopId)) ?? 0;
}

export async function canAdd(shopId: string, key: LimitKey, adding = 1) {
  const [limits, used] = await Promise.all([getEffectiveLimits(shopId), getUsage(shopId, key)]);
  return limits[key] === -1 || used + adding <= limits[key];
}

export type OrderRule = { kind: "monthly"; limit: number } | { kind: "credits"; credits: number };

// How the shop's orders are counted: a monthly quota, or the balance of a pay-as-you-go plan (plans.order_pack).
// A contract that sets its own monthly orders always wins over the balance.
export async function orderRule(shopId: string): Promise<OrderRule> {
  if (await isPlatformShop(shopId)) return { kind: "monthly", limit: -1 };
  const [current, contract] = await Promise.all([getCurrentPlan(shopId), getActiveContract(shopId)]);
  if (current?.plan.orderPack && contract?.limits.maxOrdersPerMonth == null) {
    const [shop] = await db.select({ credits: schema.shops.orderCredits }).from(schema.shops).where(eq(schema.shops.id, shopId));
    return { kind: "credits", credits: shop?.credits ?? 0 };
  }
  return { kind: "monthly", limit: (await getEffectiveLimits(shopId)).maxOrdersPerMonth };
}
