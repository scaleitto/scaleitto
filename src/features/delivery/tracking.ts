import "server-only";
import { and, asc, eq, isNotNull, isNull, lt, notInArray, or } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { decryptJson } from "@/server/crypto";
import { logError } from "@/server/errors";
import { applyOrderStatus } from "@/features/orders/transition";
import { carrierClient } from "./platforms";
import type { Credentials } from "./platforms/types";
import { finalShipmentStatuses, normalizeShipmentStatus, orderStatusFor } from "./status";

type Shipment = typeof schema.shipments.$inferSelect;

// Asks the delivery company where one parcel is, saves its stage, and closes the order when the parcel is
// delivered or returned. Throws when the company cannot be reached. userId null = the automatic check.
export async function trackShipment(shipment: Shipment, userId: string | null) {
  if (!shipment.carrierAccountId) return null;
  const [account] = await db.select().from(schema.carrierAccounts).where(and(eq(schema.carrierAccounts.shopId, shipment.shopId), eq(schema.carrierAccounts.id, shipment.carrierAccountId)));
  if (!account) return null;
  const raw = await carrierClient(account.platform, account.baseUrl, decryptJson<Credentials>(account.credentials)).trackingStatus(shipment.trackingNumber);
  const status = normalizeShipmentStatus(raw);
  await db.transaction(async (tx) => {
    await tx.update(schema.shipments).set({ status, rawStatus: raw?.slice(0, 120) ?? null, checkedAt: new Date() }).where(eq(schema.shipments.id, shipment.id));
    const next = orderStatusFor(status);
    if (next) await applyOrderStatus(tx, shipment.shopId, shipment.orderId, next, userId, `${shipment.carrierName}: ${raw}`);
  });
  return status;
}

// Hours between two automatic checks of the same parcel
const RECHECK_HOURS = 3;

// The automatic check (cron): parcels still on their way, least recently checked first, within a time budget.
export async function trackDueShipments({ limit = 60, budgetMs = 40_000 } = {}) {
  const started = Date.now();
  const s = schema.shipments;
  const due = await db
    .select()
    .from(s)
    .where(and(isNotNull(s.carrierAccountId), notInArray(s.status, finalShipmentStatuses), or(isNull(s.checkedAt), lt(s.checkedAt, new Date(Date.now() - RECHECK_HOURS * 3600_000)))))
    .orderBy(asc(s.checkedAt))
    .limit(limit);
  let checked = 0;
  let failed = 0;
  for (const shipment of due) {
    if (Date.now() - started > budgetMs) break;
    try {
      await trackShipment(shipment, null);
      checked++;
    } catch (err) {
      failed++;
      // A company that does not answer is retried on the next run; the parcel is marked as checked so others get their turn
      await db.update(s).set({ checkedAt: new Date() }).where(eq(s.id, shipment.id));
      if (failed <= 3) await logError("cron/tracking", err);
    }
  }
  return { due: due.length, checked, failed };
}
