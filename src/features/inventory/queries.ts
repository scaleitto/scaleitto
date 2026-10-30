import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { stockRows, type StockRow } from "./stock";
import { PENDING_STATUSES } from "@/features/orders/statuses";

// Every stock line of the shop (a product without variants, or each variant), with the units held by open orders
// (not shipped yet: they already left the stock but can still come back if cancelled).
export async function inventory(shopId: string) {
  const p = schema.products;
  const v = schema.productVariants;
  const [products, variants, held, [shop]] = await Promise.all([
    db.select({ id: p.id, name: p.name, sku: p.sku, stock: p.stock, costPrice: p.costPrice, price: p.price, trackStock: p.trackStock, images: p.images, status: p.status }).from(p).where(eq(p.shopId, shopId)),
    db.select({ id: v.id, productId: v.productId, title: v.title, sku: v.sku, stock: v.stock, price: v.price }).from(v).where(eq(v.shopId, shopId)),
    db
      .select({ productId: schema.orderItems.productId, variantId: schema.orderItems.variantId, n: sql<number>`sum(${schema.orderItems.quantity})` })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
      .where(and(eq(schema.orders.shopId, shopId), eq(schema.orderItems.stockTracked, true), inArray(schema.orders.status, [...PENDING_STATUSES, "confirmed"])))
      .groupBy(schema.orderItems.productId, schema.orderItems.variantId),
    db.select({ lowStock: schema.shops.lowStock }).from(schema.shops).where(eq(schema.shops.id, shopId)),
  ]);
  const lowStock = shop?.lowStock ?? 5;
  const rows: StockRow[] = stockRows(products, variants, held.map((h) => ({ ...h, n: Number(h.n) })), lowStock);
  return { rows, lowStock, untracked: products.filter((x) => !x.trackStock).length };
}

// The latest stock movements (optionally of one product), newest first
export async function movements(shopId: string, productId?: string, limit = 100) {
  const m = schema.stockMovements;
  return db
    .select({
      id: m.id,
      delta: m.delta,
      reason: m.reason,
      note: m.note,
      createdAt: m.createdAt,
      orderId: m.orderId,
      orderNumber: schema.orders.number,
      productName: schema.products.name,
      variantTitle: schema.productVariants.title,
      userName: schema.users.name,
    })
    .from(m)
    .leftJoin(schema.products, eq(schema.products.id, m.productId))
    .leftJoin(schema.productVariants, eq(schema.productVariants.id, m.variantId))
    .leftJoin(schema.orders, eq(schema.orders.id, m.orderId))
    .leftJoin(schema.users, eq(schema.users.id, m.userId))
    .where(and(eq(m.shopId, shopId), productId ? eq(m.productId, productId) : undefined))
    .orderBy(desc(m.createdAt))
    .limit(limit);
}

// Stock lines at or under the shop's threshold (the overview's alert)
export async function lowStockCount(shopId: string) {
  const { rows } = await inventory(shopId);
  return rows.filter((r) => r.state !== "ok").length;
}
