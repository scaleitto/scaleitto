import "server-only";
import { and, eq, gte, lt } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { computeAnalytics } from "./compute";
import type { Range } from "./range";

// Everything the analytics page needs for the period (and the one before it, for comparison).
export async function shopAnalytics(shopId: string, range: Range) {
  const o = schema.orders;
  const orders = await db
    .select({ id: o.id, createdAt: o.createdAt, status: o.status, subtotal: o.subtotal, total: o.total, wilayaCode: o.wilayaCode, landingPageId: o.landingPageId })
    .from(o)
    .where(and(eq(o.shopId, shopId), gte(o.createdAt, range.prevStart), lt(o.createdAt, range.end)));
  const i = schema.orderItems;
  const [items, leads, pages] = await Promise.all([
    db
      .select({ orderId: i.orderId, productId: i.productId, name: i.name, quantity: i.quantity, total: i.total, costPrice: schema.products.costPrice })
      .from(i)
      .innerJoin(o, eq(o.id, i.orderId))
      .leftJoin(schema.products, eq(schema.products.id, i.productId))
      .where(and(eq(i.shopId, shopId), eq(o.shopId, shopId), gte(o.createdAt, range.start), lt(o.createdAt, range.end))),
    db
      .select({ createdAt: schema.leads.createdAt, status: schema.leads.status })
      .from(schema.leads)
      .where(and(eq(schema.leads.shopId, shopId), gte(schema.leads.createdAt, range.start), lt(schema.leads.createdAt, range.end))),
    db.select({ id: schema.landingPages.id, title: schema.landingPages.title }).from(schema.landingPages).where(eq(schema.landingPages.shopId, shopId)),
  ]);
  return { ...computeAnalytics(range, orders, items, leads), pageTitles: Object.fromEntries(pages.map((p) => [p.id, p.title])) as Record<string, string> };
}
