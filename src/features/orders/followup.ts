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

// Sections 2–5 of the order page's status card (section 1, the call, is changeOrderStatus):
// injection = Injectée (a confirmed order sent outside the platform's couriers) / Pas encore injectée (back to sending; only
// without a parcel), state = Livraison (delivered / returned close the order like the courier would; shipped / postponed /
// no answer reopen a closed one), fault = Remarque sur la livraison, processing = Traitement, final = Livraison finale
// (delivered / returned, the same as Livraison's). Empty value = cleared.
export type FollowUpField = "injection" | "state" | "fault" | "processing" | "final";
const allowed: Record<FollowUpField, readonly string[]> = { injection: ["done", "pending"], state: deliveryStates, fault: deliveryFaults, processing: processingStates, final: ["delivered", "returned"] };

export async function setFollowUp(lang: string, orderId: string, field: FollowUpField, value: string): Promise<ActionState> {
  return safeAction("orders/followup", async () => {
    const ctx = await requireSection(asLocale(lang), "orders");
    const { shop, user } = ctx;
    if (!(field in allowed) || (value !== "" && !allowed[field].includes(value)) || ((field === "state" || field === "final" || field === "injection") && !value)) return { ok: false, error: "invalid" };
    if (!(await canTouchOrder(viewerOf(ctx), orderId))) return { ok: false, error: "notFound" };
    const where = and(eq(schema.orders.shopId, shop.id), eq(schema.orders.id, orderId));
    const [order] = await db.select({ status: schema.orders.status }).from(schema.orders).where(where);
    if (!order) return { ok: false, error: "notFound" };
    if (field === "injection") {
      if (value === "done" && order.status === "confirmed") await db.transaction((tx) => applyOrderStatus(tx, shop.id, orderId, "shipped", user.id));
      else if (value === "pending" && order.status === "shipped") {
        const [parcel] = await db.select({ id: schema.shipments.id }).from(schema.shipments).where(and(eq(schema.shipments.shopId, shop.id), eq(schema.shipments.orderId, orderId)));
        if (parcel) return { ok: false, error: "parcelExists" };
        await db.transaction((tx) => applyOrderStatus(tx, shop.id, orderId, "confirmed", user.id));
      } else if (!(value === "done" && order.status !== "confirmed" && (PARCEL_STATUSES as readonly string[]).includes(order.status))) return { ok: false, error: "notConfirmed" };
      await scheduleOrderSync(shop.id, orderId);
      refresh();
      return { ok: true };
    }
    if (field === "final") field = "state";
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
