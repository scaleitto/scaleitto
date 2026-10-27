import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { newId } from "@/server/auth/context";
import { holdsStock, type OrderStatus } from "./statuses";
import { scheduleOrderEvents } from "@/features/pixels/server";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Moves an order to a new status inside a transaction: gives stock back when it is cancelled
// or returned (takes it again when reopened) and records who did it in the history.
// Returns false when the order does not exist or already has that status.
export async function applyOrderStatus(tx: Tx, shopId: string, orderId: string, status: OrderStatus, userId: string | null, note?: string) {
  const [order] = await tx
    .select({ status: schema.orders.status })
    .from(schema.orders)
    .where(and(eq(schema.orders.shopId, shopId), eq(schema.orders.id, orderId)))
    .for("update");
  if (!order || order.status === status) return false;
  const before = holdsStock(order.status);
  const after = holdsStock(status);
  if (before !== after) {
    const items = await tx.select().from(schema.orderItems).where(and(eq(schema.orderItems.orderId, orderId), eq(schema.orderItems.stockTracked, true)));
    for (const item of items) {
      const delta = after ? -item.quantity : item.quantity;
      if (item.variantId) {
        await tx
          .update(schema.productVariants)
          .set({ stock: sql`GREATEST(${schema.productVariants.stock} + ${delta}, 0)` })
          .where(and(eq(schema.productVariants.shopId, shopId), eq(schema.productVariants.id, item.variantId)));
      } else if (item.productId) {
        await tx
          .update(schema.products)
          .set({ stock: sql`GREATEST(${schema.products.stock} + ${delta}, 0)` })
          .where(and(eq(schema.products.shopId, shopId), eq(schema.products.id, item.productId)));
      }
    }
  }
  await tx.update(schema.orders).set({ status }).where(eq(schema.orders.id, orderId));
  await tx.insert(schema.orderEvents).values({ id: newId(), orderId, shopId, userId, type: "status", fromStatus: order.status, toStatus: status, note: note ?? null });
  // Pixels that count the purchase at confirmation or delivery (sent after the response, once the transaction is committed)
  if (status === "confirmed" || status === "delivered") scheduleOrderEvents(shopId, orderId, status);
  return true;
}
