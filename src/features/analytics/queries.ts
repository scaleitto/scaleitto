import "server-only";
import { and, eq, gte, lt, ne, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { computeAnalytics } from "./compute";
import type { Range } from "./range";

// Everything the analytics page needs for the period (and the one before it, for comparison).
export async function shopAnalytics(shopId: string, range: Range) {
  const o = schema.orders;
  // Abandoned checkouts are not orders: counted apart as the period's abandoned carts
  const orders = await db
    .select({ id: o.id, createdAt: o.createdAt, status: o.status, subtotal: o.subtotal, total: o.total, wilayaCode: o.wilayaCode, landingPageId: o.landingPageId })
    .from(o)
    .where(and(eq(o.shopId, shopId), ne(o.status, "abandoned"), gte(o.createdAt, range.prevStart), lt(o.createdAt, range.end)));
  const i = schema.orderItems;
  const [items, leads, pages] = await Promise.all([
    db
      .select({ orderId: i.orderId, productId: i.productId, name: i.name, quantity: i.quantity, total: i.total })
      .from(i)
      .innerJoin(o, eq(o.id, i.orderId))
      .leftJoin(schema.products, eq(schema.products.id, i.productId))
      .where(and(eq(i.shopId, shopId), eq(o.shopId, shopId), gte(o.createdAt, range.start), lt(o.createdAt, range.end))),
    // Checkouts that started as abandoned: still abandoned, or recovered by the team since ("converted")
    db
      .select({ createdAt: o.createdAt, status: sql<string>`case when ${o.status} = 'abandoned' then 'abandoned' else 'converted' end` })
      .from(o)
      .where(and(eq(o.shopId, shopId), gte(o.createdAt, range.start), lt(o.createdAt, range.end), sql`exists (select 1 from order_events ce where ce.order_id = ${o.id} and ce.type = 'created' and ce.to_status = 'abandoned')`)),
    db.select({ id: schema.landingPages.id, title: schema.landingPages.title }).from(schema.landingPages).where(eq(schema.landingPages.shopId, shopId)),
  ]);
  return { ...computeAnalytics(range, orders, items, leads), pageTitles: Object.fromEntries(pages.map((p) => [p.id, p.title])) as Record<string, string> };
}
