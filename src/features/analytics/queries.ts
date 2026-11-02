import "server-only";
import { and, asc, eq, gte, lt, lte, ne } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { assignableMembers } from "@/features/team/queries";
import { computeAnalytics } from "./compute";
import type { Range } from "./range";

// Everything the analytics tabs need for the period (and the one before it, for comparison).
export async function shopAnalytics(shopId: string, range: Range) {
  const o = schema.orders;
  const i = schema.orderItems;
  const v = schema.pageViews;
  const prevFromDay = new Date(range.prevStart.getTime() + 3_600_000).toISOString().slice(0, 10);
  // Abandoned checkouts are not orders
  const [orders, items, views, catalog, members] = await Promise.all([
    db
      .select({ id: o.id, createdAt: o.createdAt, status: o.status, total: o.total, wilayaCode: o.wilayaCode, assignedTo: o.assignedTo })
      .from(o)
      .where(and(eq(o.shopId, shopId), ne(o.status, "abandoned"), gte(o.createdAt, range.prevStart), lt(o.createdAt, range.end))),
    db
      .select({ orderId: i.orderId, productId: i.productId, name: i.name, quantity: i.quantity, total: i.total })
      .from(i)
      .innerJoin(o, eq(o.id, i.orderId))
      .where(and(eq(i.shopId, shopId), eq(o.shopId, shopId), ne(o.status, "abandoned"), gte(o.createdAt, range.start), lt(o.createdAt, range.end))),
    db
      .select({ day: v.day, productId: v.productId, source: v.source, impressions: v.impressions, visitors: v.visitors })
      .from(v)
      .where(and(eq(v.shopId, shopId), gte(v.day, prevFromDay), lte(v.day, range.toDay))),
    db.select({ id: schema.products.id, name: schema.products.name, images: schema.products.images }).from(schema.products).where(eq(schema.products.shopId, shopId)).orderBy(asc(schema.products.name)),
    assignableMembers(shopId),
  ]);
  const catalogRows = catalog.map((p) => ({ id: p.id, name: p.name, image: p.images[0] ?? null }));
  // The call center tab: the store's agents (not the owner)
  const agents = members.filter((m) => m.role === "agent").map((m) => ({ userId: m.userId, name: m.name }));
  return computeAnalytics(range, orders, items, views, catalogRows, agents);
}
