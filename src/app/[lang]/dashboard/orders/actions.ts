"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { orderStatuses, type OrderStatus } from "@/db/schema";
import { requireShop } from "@/lib/auth";
import { adjustStockForOrder, STOCK_RELEASED_STATUSES } from "@/lib/stock";
import { asLocale } from "@/i18n";

export async function setOrderStatus(lang: string, orderId: string, formData: FormData) {
  const locale = asLocale(lang);
  const { shop } = await requireShop(locale);
  const next = String(formData.get("status")) as OrderStatus;
  if (!orderStatuses.includes(next)) return;

  await db.transaction(async (tx) => {
    const [order] = await tx
      .select({ status: schema.orders.status })
      .from(schema.orders)
      .where(and(eq(schema.orders.id, orderId), eq(schema.orders.shopId, shop.id)))
      .for("update");
    if (!order || order.status === next) return;

    const wasReleased = STOCK_RELEASED_STATUSES.has(order.status);
    const isReleased = STOCK_RELEASED_STATUSES.has(next);
    if (!wasReleased && isReleased) await adjustStockForOrder(tx, orderId, 1);
    if (wasReleased && !isReleased) await adjustStockForOrder(tx, orderId, -1);

    await tx.update(schema.orders).set({ status: next }).where(eq(schema.orders.id, orderId));
  });
  redirect(`/${locale}/dashboard/orders/${orderId}`);
}
