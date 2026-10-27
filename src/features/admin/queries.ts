import "server-only";
import { and, asc, count, desc, eq, gte, inArray, like, or, sql, sum, type SQL } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { algeriaMonthStart } from "@/lib/time";
import { escapeLike } from "@/lib/validation";
import { getEffectiveLimits } from "@/server/limits";
import { planOverview } from "@/features/plans/queries";

// The platform at a glance
export async function platformOverview() {
  const monthStart = algeriaMonthStart();
  const weekAgo = new Date(Date.now() - 7 * 86400_000);
  const dayAgo = new Date(Date.now() - 86400_000);
  const s = schema.shops;
  const [[shops], [newShops], [orders], [pending], [revenue], [errors], byPlan] = await Promise.all([
    db.select({ total: count(), active: sql<number>`SUM(${s.status} = 'active')` }).from(s),
    db.select({ n: count() }).from(s).where(gte(s.createdAt, weekAgo)),
    db.select({ n: count(), total: sum(schema.orders.total) }).from(schema.orders).where(gte(schema.orders.createdAt, monthStart)),
    db.select({ n: count() }).from(schema.planRequests).where(eq(schema.planRequests.status, "pending")),
    db.select({ total: sum(schema.planRequests.amount) }).from(schema.planRequests).where(and(eq(schema.planRequests.status, "approved"), gte(schema.planRequests.decidedAt, monthStart))),
    db.select({ n: count() }).from(schema.errorLogs).where(gte(schema.errorLogs.createdAt, dayAgo)),
    db.select({ name: schema.plans.name, n: count() }).from(s).innerJoin(schema.plans, eq(schema.plans.id, s.planId)).groupBy(schema.plans.name),
  ]);
  return {
    shops: Number(shops.total),
    activeShops: Number(shops.active ?? 0),
    newShops: newShops.n,
    ordersThisMonth: orders.n,
    gmvThisMonth: Number(orders.total ?? 0),
    pendingRequests: pending.n,
    revenueThisMonth: Number(revenue.total ?? 0),
    errors24h: errors.n,
    byPlan,
  };
}

const PAGE = 30;

// Shops with owner, plan and this month's orders; searchable by shop name, link, domain or owner email
export async function listShops({ q = "", status, page = 1 }: { q?: string; status?: "active" | "suspended"; page?: number }) {
  const s = schema.shops;
  const filters: (SQL | undefined)[] = [status ? eq(s.status, status) : undefined];
  if (q.trim()) {
    const term = `%${escapeLike(q.trim().toLowerCase())}%`;
    filters.push(or(like(s.name, term), like(s.slug, term), like(s.customDomain, term), like(schema.users.email, term)));
  }
  const where = and(...filters);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ id: s.id, name: s.name, slug: s.slug, status: s.status, createdAt: s.createdAt, planExpiresAt: s.planExpiresAt, planName: schema.plans.name, ownerEmail: schema.users.email })
      .from(s)
      .innerJoin(schema.plans, eq(schema.plans.id, s.planId))
      .innerJoin(schema.users, eq(schema.users.id, s.ownerId))
      .where(where)
      .orderBy(desc(s.createdAt))
      .limit(PAGE)
      .offset((Math.max(1, page) - 1) * PAGE),
    db.select({ total: count() }).from(s).innerJoin(schema.users, eq(schema.users.id, s.ownerId)).where(where),
  ]);
  const ids = rows.map((r) => r.id);
  const orders = ids.length
    ? await db.select({ shopId: schema.orders.shopId, n: count() }).from(schema.orders).where(and(inArray(schema.orders.shopId, ids), gte(schema.orders.createdAt, algeriaMonthStart()))).groupBy(schema.orders.shopId)
    : [];
  const limits = await Promise.all(ids.map((id) => getEffectiveLimits(id)));
  return {
    rows: rows.map((r, i) => ({ ...r, ordersThisMonth: orders.find((o) => o.shopId === r.id)?.n ?? 0, orderLimit: limits[i].maxOrdersPerMonth })),
    total,
    pageSize: PAGE,
  };
}

// One shop for the admin: details, owner, plan and usage, contracts, requests
export async function adminShop(id: string) {
  const [row] = await db
    .select({ shop: schema.shops, ownerEmail: schema.users.email, ownerName: schema.users.name, ownerPhone: schema.users.phone })
    .from(schema.shops)
    .innerJoin(schema.users, eq(schema.users.id, schema.shops.ownerId))
    .where(eq(schema.shops.id, id));
  if (!row) return null;
  const [overview, contracts, [{ n: members }]] = await Promise.all([
    planOverview(id),
    db.select().from(schema.shopContracts).where(eq(schema.shopContracts.shopId, id)).orderBy(desc(schema.shopContracts.startDate)),
    db.select({ n: count() }).from(schema.shopMembers).where(eq(schema.shopMembers.shopId, id)),
  ]);
  return { ...row, overview, contracts, members };
}

export async function recentErrors(limit = 100) {
  return db.select().from(schema.errorLogs).orderBy(desc(schema.errorLogs.createdAt)).limit(limit);
}

export async function allPlans() {
  return db.select().from(schema.plans).orderBy(asc(schema.plans.priceMonthly));
}

export async function appliedMigrations() {
  const [rows] = (await db.execute(sql`SELECT name FROM _migrations ORDER BY name`)) as unknown as [{ name: string }[]];
  return rows.map((r) => r.name);
}
