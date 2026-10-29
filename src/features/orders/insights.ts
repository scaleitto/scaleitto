// Order analysis (Orders → Order analysis): what happens to the orders — rates, how long each step takes, which
// couriers deliver. Pure math here (unit-tested); orderInsights() loads the period's data.
import "server-only";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import type { OrderStatus } from "@/server/db/schema";
import type { Range } from "@/features/analytics/range";
import { computeInsights, type EventRow, type InsightOrder } from "./insights-math";

export async function orderInsights(shopId: string, range: Range) {
  const o = schema.orders;
  const sh = schema.shipments;
  const orders: InsightOrder[] = (
    await db
      .select({ id: o.id, status: o.status, createdAt: o.createdAt, carrier: sh.carrierName, stage: sh.status })
      .from(o)
      .leftJoin(sh, eq(sh.orderId, o.id))
      .where(and(eq(o.shopId, shopId), gte(o.createdAt, range.start), lt(o.createdAt, range.end)))
  ).map((r) => ({ ...r, status: r.status as OrderStatus }));
  const ids = orders.map((r) => r.id);
  const events: EventRow[] = ids.length
    ? (
        await db
          .select({ orderId: schema.orderEvents.orderId, toStatus: schema.orderEvents.toStatus, at: sql<Date>`min(${schema.orderEvents.createdAt})` })
          .from(schema.orderEvents)
          .where(and(eq(schema.orderEvents.shopId, shopId), eq(schema.orderEvents.type, "status"), inArray(schema.orderEvents.toStatus, ["confirmed", "shipped", "delivered"]), inArray(schema.orderEvents.orderId, ids)))
          .groupBy(schema.orderEvents.orderId, schema.orderEvents.toStatus)
      ).map((e) => ({ orderId: e.orderId, toStatus: e.toStatus ?? "", at: new Date(e.at) }))
    : [];
  return computeInsights(orders, events);
}
