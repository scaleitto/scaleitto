import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { schema } from "@/db";
import type { db as Db } from "@/db";

type Tx = Parameters<Parameters<typeof Db.transaction>[0]>[0];

export const STOCK_RELEASED_STATUSES = new Set(["cancelled", "returned"]);

// Moves an order's quantities out of (-1) or back into (+1) stock.
export async function adjustStockForOrder(tx: Tx, orderId: string, direction: 1 | -1) {
  const items = await tx.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
  for (const item of items) {
    const delta = direction * item.quantity;
    if (item.variantId) {
      await tx
        .update(schema.productVariants)
        .set({ stock: sql`GREATEST(${schema.productVariants.stock} + ${delta}, 0)` })
        .where(eq(schema.productVariants.id, item.variantId));
    } else if (item.productId) {
      await tx
        .update(schema.products)
        .set({ stock: sql`GREATEST(${schema.products.stock} + ${delta}, 0)` })
        .where(and(eq(schema.products.id, item.productId), eq(schema.products.trackStock, true)));
    }
  }
}
