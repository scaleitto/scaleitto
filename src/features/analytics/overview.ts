import "server-only";
import { and, count, eq, gte, inArray, sum } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { algeriaDayStart, algeriaMonthStart } from "@/lib/time";

// The four numbers at the top of the dashboard home
export async function overviewStats(shopId: string, now = new Date()) {
  const o = schema.orders;
  const [[today], [waiting], [month], [sales]] = await Promise.all([
    db.select({ n: count() }).from(o).where(and(eq(o.shopId, shopId), gte(o.createdAt, algeriaDayStart(now)))),
    db.select({ n: count() }).from(o).where(and(eq(o.shopId, shopId), inArray(o.status, ["new", "no_answer", "postponed"]))),
    db.select({ n: count() }).from(o).where(and(eq(o.shopId, shopId), gte(o.createdAt, algeriaMonthStart(now)))),
    db.select({ total: sum(o.total) }).from(o).where(and(eq(o.shopId, shopId), eq(o.status, "delivered"), gte(o.createdAt, algeriaMonthStart(now)))),
  ]);
  return { today: today.n, waiting: waiting.n, month: month.n, delivered: Number(sales.total ?? 0) };
}
