import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { decryptJson } from "@/server/crypto";
import type { AppKey } from "@/server/db/schema";
import { appsScriptCode } from "./apps-script";
import { queueStatus } from "./sync";
import type { AppView } from "./AppCards";

// The shop's apps for the dashboard (owners and managers only: they see the secret to paste in their
// script or to verify webhook signatures).
export async function appViews(shopId: string): Promise<Record<AppKey, AppView>> {
  const [rows, events, queue] = await Promise.all([
    db.select().from(schema.shopApps).where(eq(schema.shopApps.shopId, shopId)),
    // The latest order sends: when the newest one failed, its reason is shown on the card
    db.select({ app: schema.appEvents.app, ok: schema.appEvents.ok, detail: schema.appEvents.detail }).from(schema.appEvents).where(and(eq(schema.appEvents.shopId, shopId), inArray(schema.appEvents.kind, ["order", "backfill"]))).orderBy(desc(schema.appEvents.createdAt)).limit(20),
    queueStatus(shopId),
  ]);
  const view = (key: AppKey): AppView => {
    const row = rows.find((r) => r.app === key);
    if (!row) return null;
    const secret = decryptJson<string>(row.secret);
    const last = events.find((e) => e.app === key);
    return { app: key, url: row.url, active: row.active, secret, sheetUrl: row.sheetUrl, lastError: last && !last.ok ? last.detail : null, waiting: queue.waiting, queueError: queue.lastError, script: key === "google_sheets" ? appsScriptCode(secret) : null };
  };
  return { google_sheets: view("google_sheets"), webhook: view("webhook") };
}

export async function appLog(shopId: string, limit = 20) {
  return db
    .select({ id: schema.appEvents.id, app: schema.appEvents.app, kind: schema.appEvents.kind, ok: schema.appEvents.ok, detail: schema.appEvents.detail, createdAt: schema.appEvents.createdAt, orderNumber: schema.orders.number })
    .from(schema.appEvents)
    .leftJoin(schema.orders, eq(schema.orders.id, schema.appEvents.orderId))
    .where(eq(schema.appEvents.shopId, shopId))
    .orderBy(desc(schema.appEvents.createdAt))
    .limit(limit);
}
