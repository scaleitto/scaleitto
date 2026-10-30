"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, schema } from "@/server/db";
import { newId, requireSection } from "@/server/auth/context";
import { safeAction } from "@/server/errors";
import { asLocale } from "@/i18n";
import type { ActionState } from "@/lib/action";
import { deliveryFaults, deliveryStates, processingStates } from "@/server/db/schema";
import { PARCEL_STATUSES } from "./statuses";
import { applyOrderStatus } from "./transition";
import { canTouchOrder, viewerOf } from "./access";
import { scheduleOrderSync } from "@/features/apps/sync";

// The delivery follow-up of a sent order (the order page's "Delivery follow-up" card):
// state = Livraison (delivered / returned close the order like the courier would; shipped / postponed / no answer reopen
// a closed one), fault = Remarque sur la livraison, processing = Traitement. Empty value = cleared.
export type FollowUpField = "state" | "fault" | "processing";
const allowed: Record<FollowUpField, readonly string[]> = { state: deliveryStates, fault: deliveryFaults, processing: processingStates };

export async function setFollowUp(lang: string, orderId: string, field: FollowUpField, value: string): Promise<ActionState> {
  return safeAction("orders/followup", async () => {
    const ctx = await requireSection(asLocale(lang), "orders");
    const { shop, user } = ctx;
    if (!(field in allowed) || (value !== "" && !allowed[field].includes(value)) || (field === "state" && !value)) return { ok: false, error: "invalid" };
    if (!(await canTouchOrder(viewerOf(ctx), orderId))) return { ok: false, error: "notFound" };
    const where = and(eq(schema.orders.shopId, shop.id), eq(schema.orders.id, orderId));
    const [order] = await db.select({ status: schema.orders.status }).from(schema.orders).where(where);
    if (!order) return { ok: false, error: "notFound" };
    // Only a sent parcel has a delivery to follow
    if (!(PARCEL_STATUSES as readonly string[]).includes(order.status)) return { ok: false, error: "notShipped" };
    await db.transaction(async (tx) => {
      if (field === "state") {
        const v = value as (typeof deliveryStates)[number];
        if (v === "delivered" || v === "returned") await applyOrderStatus(tx, shop.id, orderId, v, user.id);
        else {
          if (order.status !== "shipped") await applyOrderStatus(tx, shop.id, orderId, "shipped", user.id);
          await tx.update(schema.orders).set({ deliveryState: v }).where(where);
        }
      } else if (field === "fault") {
        await tx.update(schema.orders).set({ deliveryFault: (value || null) as (typeof deliveryFaults)[number] | null }).where(where);
      } else {
        await tx.update(schema.orders).set({ processing: (value || null) as (typeof processingStates)[number] | null }).where(where);
      }
      await tx.insert(schema.orderEvents).values({ id: newId(), orderId, shopId: shop.id, userId: user.id, type: "followup", note: `${field}:${value}` });
    });
    await scheduleOrderSync(shop.id, orderId);
    refresh();
    return { ok: true };
  });
}
