import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { getActiveContract, getAllUsage, getCurrentPlan, getEffectiveLimits, isPlatformShop, orderRule } from "@/server/limits";
import { limitKeys, type LimitKey } from "@/server/db/schema";
import { lockedOrderCount } from "./locked";

export const DEFAULT_THRESHOLD = 80;
const monthlyKeys: LimitKey[] = ["maxOrdersPerMonth", "maxAiPerMonth"];
const percent = (used: number, limit: number) => (limit === -1 ? 0 : limit === 0 ? 100 : Math.round((used / limit) * 100));

// Everything the Plans page shows
export async function planOverview(shopId: string) {
  const [platform, current, contract, limits, usage, plans, requests, rule] = await Promise.all([
    isPlatformShop(shopId),
    getCurrentPlan(shopId),
    getActiveContract(shopId),
    getEffectiveLimits(shopId),
    getAllUsage(shopId),
    db.select().from(schema.plans).where(eq(schema.plans.isActive, true)).orderBy(asc(schema.plans.priceMonthly)),
    db
      .select({ request: schema.planRequests, planName: schema.plans.name, orderPack: schema.plans.orderPack })
      .from(schema.planRequests)
      .innerJoin(schema.plans, eq(schema.plans.id, schema.planRequests.planId))
      .where(eq(schema.planRequests.shopId, shopId))
      .orderBy(desc(schema.planRequests.createdAt))
      .limit(10),
    orderRule(shopId),
  ]);
  const threshold = contract?.alertThreshold ?? DEFAULT_THRESHOLD;
  return {
    platform,
    current,
    contract,
    threshold,
    // A pay-as-you-go balance replaces the monthly orders meter
    credits: rule.kind === "credits" ? rule.credits : null,
    meters: limitKeys
      .filter((key) => !(rule.kind === "credits" && key === "maxOrdersPerMonth"))
      .map((key) => ({ key, used: usage[key], limit: limits[key], percent: percent(usage[key], limits[key]) })),
    plans,
    requests: requests.map((r) => ({ ...r.request, planName: r.planName, orderPack: r.orderPack })),
    pending: requests.find((r) => r.request.status === "pending") ?? null,
  };
}

// The warning at the top of the dashboard: locked orders first, then a monthly quota past the alert threshold.
export type PlanNotice = { kind: "locked"; n: number } | { kind: "credits"; n: number } | { kind: "usage"; key: LimitKey; percent: number };
// A pay-as-you-go balance at or under this many orders is announced
const LOW_CREDITS = 10;

export async function planNotice(shopId: string): Promise<PlanNotice | null> {
  const locked = await lockedOrderCount(shopId);
  if (locked) return { kind: "locked", n: locked };
  const [limits, usage, contract, rule] = await Promise.all([getEffectiveLimits(shopId), getAllUsage(shopId), getActiveContract(shopId), orderRule(shopId)]);
  if (rule.kind === "credits" && rule.credits <= LOW_CREDITS) return { kind: "credits", n: rule.credits };
  const threshold = contract?.alertThreshold ?? DEFAULT_THRESHOLD;
  // Only the monthly quotas: the others (products, team…) being full is a normal state, not an alarm
  const worst = monthlyKeys.map((key) => ({ key, percent: percent(usage[key], limits[key]) })).sort((a, b) => b.percent - a.percent)[0];
  return worst && worst.percent >= threshold ? { kind: "usage", ...worst } : null;
}

export async function pendingRequest(shopId: string) {
  const [r] = await db.select().from(schema.planRequests).where(and(eq(schema.planRequests.shopId, shopId), eq(schema.planRequests.status, "pending")));
  return r ?? null;
}

// Platform admin: every request, pending first
export async function adminPlanRequests() {
  return db
    .select({ request: schema.planRequests, planName: schema.plans.name, orderPack: schema.plans.orderPack, shopName: schema.shops.name, shopSlug: schema.shops.slug })
    .from(schema.planRequests)
    .innerJoin(schema.plans, eq(schema.plans.id, schema.planRequests.planId))
    .innerJoin(schema.shops, eq(schema.shops.id, schema.planRequests.shopId))
    .orderBy(desc(sql`${schema.planRequests.status} = 'pending'`), desc(schema.planRequests.createdAt))
    .limit(200);
}
