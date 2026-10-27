import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { decryptJson } from "@/server/crypto";
import type { AppKey } from "@/server/db/schema";
import { appsScriptCode } from "./apps-script";
import type { AppView } from "./AppCards";

// The shop's apps for the dashboard (owners and managers only: they see the secret to paste in their
// script or to verify webhook signatures).
export async function appViews(shopId: string): Promise<Record<AppKey, AppView>> {
  const rows = await db.select().from(schema.shopApps).where(eq(schema.shopApps.shopId, shopId));
  const view = (key: AppKey): AppView => {
    const row = rows.find((r) => r.app === key);
    if (!row) return null;
    const secret = decryptJson<string>(row.secret);
    return { app: key, url: row.url, active: row.active, secret, script: key === "google_sheets" ? appsScriptCode(secret) : null };
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
