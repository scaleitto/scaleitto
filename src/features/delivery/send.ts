import "server-only";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { newId } from "@/server/auth/context";
import { decryptJson } from "@/server/crypto";
import { logError } from "@/server/errors";
import type { ActionState } from "@/lib/action";
import { applyOrderStatus } from "@/features/orders/transition";
import { carrierClient, CarrierError } from "./platforms";
import type { Credentials } from "./platforms/types";
import { findCarrier } from "./carriers";
import { buildParcel, parseParcelOptions } from "./parcel";
import { resolveDelivery } from "./settings";

// Sends one confirmed order to a connected delivery company: the parcel is created there, the shipment saved and the
// order moves to "in transit". Used by the order page, the bulk send and the automatic send on confirmation.
export async function sendParcel(shopId: string, orderId: string, accountId: string, options: unknown, userId: string | null): Promise<ActionState> {
  const [order] = await db.select().from(schema.orders).where(and(eq(schema.orders.shopId, shopId), eq(schema.orders.id, orderId)));
  if (!order) return { ok: false, error: "notFound" };
  if (order.status !== "confirmed") return { ok: false, error: "confirmFirst" };
  if (await db.$count(schema.shipments, eq(schema.shipments.orderId, orderId))) return { ok: false, error: "alreadyShipped" };
  const [account] = await db.select().from(schema.carrierAccounts).where(and(eq(schema.carrierAccounts.shopId, shopId), eq(schema.carrierAccounts.id, accountId)));
  if (!account) return { ok: false, error: "notFound" };

  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
  const parcel = buildParcel(order, items, account.originWilaya, parseParcelOptions(options, account.options));

  let created;
  try {
    created = await carrierClient(account.platform, account.baseUrl, decryptJson<Credentials>(account.credentials)).createParcel(parcel);
  } catch (err) {
    if (err instanceof CarrierError || (err instanceof Error && /fetch|timeout|abort/i.test(err.message))) return { ok: false, error: "carrierRefused", message: err.message };
    throw err;
  }

  const carrierName = findCarrier(account.carrier)?.name ?? account.carrier;
  await db.transaction(async (tx) => {
    await tx.insert(schema.shipments).values({
      id: newId(),
      shopId,
      orderId,
      carrierAccountId: account.id,
      carrierName,
      trackingNumber: created.trackingNumber,
      labelUrl: created.labelUrl ?? null,
    });
    await applyOrderStatus(tx, shopId, orderId, "in_transit", userId, `${carrierName}: ${created.trackingNumber}`);
  });
  return { ok: true, message: created.trackingNumber };
}

// Zimam's "send confirmed orders automatically": right after the response, a confirmed order that has a delivery company
// is sent to it. A refusal is written in the order's history so the team sees it and sends by hand.
async function autoSend(shopId: string, orderId: string) {
  try {
    const [row] = await db
      .select({ delivery: schema.shops.delivery, accountId: schema.orders.carrierAccountId, locked: schema.orders.locked })
      .from(schema.orders)
      .innerJoin(schema.shops, eq(schema.shops.id, schema.orders.shopId))
      .where(and(eq(schema.orders.shopId, shopId), eq(schema.orders.id, orderId)));
    if (!row?.accountId || row.locked || !resolveDelivery(row.delivery).autoSend) return;
    const result = await sendParcel(shopId, orderId, row.accountId, undefined, null);
    if (!result.ok && result.error !== "alreadyShipped" && result.error !== "confirmFirst")
      await db.insert(schema.orderEvents).values({ id: newId(), orderId, shopId, type: "note", note: `⚠ ${result.message ?? result.error}` });
  } catch (err) {
    await logError("delivery/auto-send", err);
  }
}

export function scheduleAutoSend(shopId: string, orderId: string) {
  try {
    after(() => autoSend(shopId, orderId));
  } catch {
    void autoSend(shopId, orderId);
  }
}
