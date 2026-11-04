import "server-only";
import { and, desc, eq, gte, lt, ne, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { algeriaMonthStart } from "@/lib/time";

// Balance page: the balance, where credits came from, this month's spending, and the history
export async function balanceView(shopId: string) {
  const l = schema.creditLedger;
  const [[shop], sums, [spent], history, purchases] = await Promise.all([
    db.select({ credits: schema.shops.credits }).from(schema.shops).where(eq(schema.shops.id, shopId)),
    db.select({ kind: l.kind, total: sql<number>`sum(${l.amount})` }).from(l).where(and(eq(l.shopId, shopId), sql`${l.amount} > 0`)).groupBy(l.kind),
    db.select({ total: sql<number>`coalesce(sum(${l.amount}), 0)` }).from(l).where(and(eq(l.shopId, shopId), lt(l.amount, 0), gte(l.createdAt, algeriaMonthStart()))),
    db.select().from(l).where(eq(l.shopId, shopId)).orderBy(desc(l.createdAt)).limit(100),
    db.select().from(schema.creditPurchases).where(and(eq(schema.creditPurchases.shopId, shopId), eq(schema.creditPurchases.status, "pending"))).orderBy(desc(schema.creditPurchases.createdAt)),
  ]);
  const sum = (kinds: string[]) => sums.filter((s) => kinds.includes(s.kind)).reduce((n, s) => n + Number(s.total ?? 0), 0);
  return {
    credits: shop?.credits ?? 0,
    earned: sum(["trial", "subscription", "admin", "purchase", "refund"]),
    fromSubscription: sum(["trial", "subscription", "admin"]),
    purchased: sum(["purchase"]),
    spentThisMonth: Math.abs(Number(spent?.total ?? 0)),
    history,
    pending: purchases.filter((p) => p.method !== "card"),
  };
}

// Platform admin: credit packs paid by transfer, waiting for a decision
export async function pendingCreditPurchases() {
  return db
    .select({ purchase: schema.creditPurchases, shopName: schema.shops.name, shopSlug: schema.shops.slug })
    .from(schema.creditPurchases)
    .innerJoin(schema.shops, eq(schema.shops.id, schema.creditPurchases.shopId))
    // Card purchases are settled by the gateway, never by hand
    .where(and(eq(schema.creditPurchases.status, "pending"), ne(schema.creditPurchases.method, "card")))
    .orderBy(desc(schema.creditPurchases.createdAt))
    .limit(200);
}
