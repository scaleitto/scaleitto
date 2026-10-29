import "server-only";
import { and, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import type { Range } from "@/features/analytics/range";
import { computeFinance } from "./compute";

export async function shopFinance(shopId: string, range: Range) {
  const o = schema.orders;
  const orders = await db
    .select({ id: o.id, status: o.status, subtotal: o.subtotal, shippingPrice: o.shippingPrice, total: o.total, paidAt: o.paidAt })
    .from(o)
    .where(and(eq(o.shopId, shopId), gte(o.createdAt, range.start), lt(o.createdAt, range.end)));
  const delivered = orders.filter((r) => r.status === "delivered").map((r) => r.id);
  const items = delivered.length
    ? await db
        .select({ orderId: schema.orderItems.orderId, quantity: schema.orderItems.quantity, costPrice: schema.products.costPrice })
        .from(schema.orderItems)
        .leftJoin(schema.products, eq(schema.products.id, schema.orderItems.productId))
        .where(inArray(schema.orderItems.orderId, delivered))
    : [];
  const list = await expensesOf(shopId, range);
  // Money received from the couriers during the period (whatever the order date)
  const [collected] = await db
    .select({ n: sql<number>`count(*)`, amount: sql<number>`coalesce(sum(${o.total}), 0)` })
    .from(o)
    .where(and(eq(o.shopId, shopId), gte(o.paidAt, range.start), lt(o.paidAt, range.end)));
  return { ...computeFinance(orders, items, list), collected: { n: Number(collected?.n ?? 0), amount: Number(collected?.amount ?? 0) }, expenseList: list };
}

export async function expensesOf(shopId: string, range: Range) {
  const e = schema.expenses;
  return db
    .select({ id: e.id, day: e.day, category: e.category, amount: e.amount, note: e.note })
    .from(e)
    .where(and(eq(e.shopId, shopId), gte(e.day, range.fromDay), lt(e.day, nextDay(range.toDay))))
    .orderBy(desc(e.day), desc(e.createdAt));
}
const nextDay = (day: string) => new Date(new Date(`${day}T00:00:00Z`).getTime() + 86400_000).toISOString().slice(0, 10);

// Cash on delivery still owed by the couriers: delivered orders whose money is not marked as received (all dates)
export async function owedByCouriers(shopId: string) {
  const o = schema.orders;
  const sh = schema.shipments;
  return db
    .select({ id: o.id, number: o.number, total: o.total, customerName: o.customerName, createdAt: o.createdAt, carrier: sh.carrierName, tracking: sh.trackingNumber })
    .from(o)
    .leftJoin(sh, eq(sh.orderId, o.id))
    .where(and(eq(o.shopId, shopId), eq(o.status, "delivered"), isNull(o.paidAt)))
    .orderBy(sh.carrierName, o.number)
    .limit(500);
}
