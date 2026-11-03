import "server-only";
import { createHmac } from "node:crypto";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { decryptJson } from "@/server/crypto";
import { logError } from "@/server/errors";
import { safePostJson } from "@/server/safe-fetch";
import { asLocale, getDictionary } from "@/i18n";
import { resolveSheetImport } from "./sheets";

// An order imported from a Google Sheet changed status: write "#1042 · Confirmed" back into the row it came from, through
// the merchant's deployed script (doPost). Nothing happens when the sheet has no status column or no script address.
export async function writeSheetStatus(shopId: string, orderId: string) {
  const [order] = await db
    .select({ number: schema.orders.number, status: schema.orders.status, ref: schema.orders.externalRef, channel: schema.orders.channel, locale: schema.shops.defaultLocale })
    .from(schema.orders)
    .innerJoin(schema.shops, eq(schema.shops.id, schema.orders.shopId))
    .where(and(eq(schema.orders.shopId, shopId), eq(schema.orders.id, orderId)));
  const row = order?.channel === "google_sheets" ? Number(order.ref?.split(":")[2]) : NaN;
  if (!order || !Number.isInteger(row)) return;
  const [channel] = await db.select().from(schema.shopChannels).where(and(eq(schema.shopChannels.shopId, shopId), eq(schema.shopChannels.kind, "google_sheets")));
  const settings = resolveSheetImport(channel?.settings);
  if (!channel?.active || !settings?.scriptUrl || settings.columns.status === null) return;
  const secret = decryptJson<{ secret: string }>(channel.secret).secret;
  const label = (getDictionary(asLocale(order.locale)).orders.statuses as Record<string, string>)[order.status] ?? order.status;
  const body = JSON.stringify({ row, status: `#${order.number} · ${label}` });
  const signature = createHmac("sha256", secret).update(body, "utf8").digest("base64");
  const url = `${settings.scriptUrl}${settings.scriptUrl.includes("?") ? "&" : "?"}signature=${encodeURIComponent(signature)}`;
  const r = await safePostJson(url, body, { timeoutMs: 15_000 });
  if (r.status >= 400) throw new Error(`Sheet status ${r.status}: ${r.text.slice(0, 120)}`);
}

export function scheduleSheetStatus(shopId: string, orderId: string) {
  const run = () => writeSheetStatus(shopId, orderId).catch((err) => logError("channels/sheet-status", err));
  try {
    after(run);
  } catch {
    void run();
  }
}
