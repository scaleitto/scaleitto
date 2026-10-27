import "server-only";
import { createHmac } from "node:crypto";
import { after } from "next/server";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { newId } from "@/server/auth/context";
import { decryptJson } from "@/server/crypto";
import { logError } from "@/server/errors";
import { safePostJson } from "@/server/safe-fetch";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { wilayaName } from "@/lib/wilayas";
import type { AppKey } from "@/server/db/schema";

// Orders sent to the shop's apps: a Google Sheet (through the merchant's Apps Script) and/or a webhook.
// Every send is logged in app_events; a failing app never blocks an order.

type App = typeof schema.shopApps.$inferSelect;
type Order = typeof schema.orders.$inferSelect;

export const columnKeys = ["number", "date", "status", "name", "phone", "wilaya", "commune", "address", "delivery", "products", "quantity", "subtotal", "shipping", "total", "note", "extra", "source", "agent", "tracking", "id"] as const;

// Everything about the orders, in one query per table
async function loadOrders(shopId: string, orders: Order[]) {
  const ids = orders.map((o) => o.id);
  if (!ids.length) return [];
  const [items, shipments, pages, users] = await Promise.all([
    db.select().from(schema.orderItems).where(and(eq(schema.orderItems.shopId, shopId), inArray(schema.orderItems.orderId, ids))),
    db.select({ orderId: schema.shipments.orderId, carrierName: schema.shipments.carrierName, trackingNumber: schema.shipments.trackingNumber }).from(schema.shipments).where(and(eq(schema.shipments.shopId, shopId), inArray(schema.shipments.orderId, ids))),
    db.select({ id: schema.landingPages.id, title: schema.landingPages.title }).from(schema.landingPages).where(eq(schema.landingPages.shopId, shopId)),
    db.select({ id: schema.users.id, name: schema.users.name }).from(schema.shopMembers).innerJoin(schema.users, eq(schema.users.id, schema.shopMembers.userId)).where(eq(schema.shopMembers.shopId, shopId)),
  ]);
  return orders.map((o) => ({
    ...o,
    items: items.filter((i) => i.orderId === o.id),
    shipment: shipments.find((s) => s.orderId === o.id) ?? null,
    landingTitle: pages.find((p) => p.id === o.landingPageId)?.title ?? null,
    agentName: users.find((u) => u.id === o.assignedTo)?.name ?? null,
  }));
}
type FullOrder = Awaited<ReturnType<typeof loadOrders>>[number];

// The JSON a webhook receives
function orderPayload(o: FullOrder) {
  return {
    id: o.id,
    number: o.number,
    createdAt: o.createdAt.toISOString(),
    status: o.status,
    customer: { name: o.customerName, phone: o.phone, wilayaCode: o.wilayaCode, wilaya: wilayaName(o.wilayaCode, "fr"), commune: o.commune, address: o.address },
    deliveryType: o.deliveryType,
    items: o.items.map((i) => ({ productId: i.productId, variantId: i.variantId, name: i.name, variant: i.variantTitle, sku: i.sku, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total, offer: i.offerLabel })),
    subtotal: o.subtotal,
    shipping: o.shippingPrice,
    total: o.total,
    currency: "DZD",
    note: o.customerNote,
    extra: o.extra ?? [],
    landingPage: o.landingTitle,
    agent: o.agentName,
    shipment: o.shipment,
  };
}

// One sheet row, in the shop's language. The first column (order number) is the key the script updates by.
function sheetRow(o: FullOrder, locale: "ar" | "fr" | "en") {
  const t = getDictionary(locale);
  const date = o.createdAt.toLocaleString("fr-FR", { timeZone: "Africa/Algiers", dateStyle: "short", timeStyle: "short" });
  const values: Record<(typeof columnKeys)[number], string | number> = {
    number: o.number,
    date,
    status: t.orders.statuses[o.status],
    name: o.customerName,
    phone: o.phone,
    wilaya: wilayaName(o.wilayaCode, locale),
    commune: o.commune,
    address: o.address ?? "",
    delivery: t.orders.deliveryTypes[o.deliveryType],
    products: o.items.map((i) => `${i.name}${i.variantTitle ? ` (${i.variantTitle})` : ""} × ${i.quantity}`).join(" | "),
    quantity: o.items.reduce((s, i) => s + i.quantity, 0),
    subtotal: o.subtotal,
    shipping: o.shippingPrice,
    total: o.total,
    note: o.customerNote ?? "",
    extra: (o.extra ?? []).map((x) => `${x.label}: ${x.value}`).join(" | "),
    source: o.landingTitle ?? t.analytics.store,
    agent: o.agentName ?? "",
    tracking: o.shipment ? `${o.shipment.carrierName} ${o.shipment.trackingNumber}` : "",
    id: o.id,
  };
  return columnKeys.map((k) => values[k]);
}

export const sheetHeaders = (locale: "ar" | "fr" | "en") => columnKeys.map((k) => getDictionary(locale).apps.columns[k]);

type Result = { ok: boolean; detail: string };

async function post(app: App, payload: Record<string, unknown>, event: string): Promise<Result> {
  const secret = decryptJson<string>(app.secret);
  try {
    if (app.app === "google_sheets") {
      const r = await safePostJson(app.url, JSON.stringify({ ...payload, token: secret }), { timeoutMs: 25_000 });
      let json: { ok?: boolean; error?: string; count?: number } | null = null;
      try {
        json = JSON.parse(r.text);
      } catch {
        // Apps Script answers with an HTML page when the deployment is not public ("Anyone")
      }
      if (json?.ok) return { ok: true, detail: `OK (${json.count ?? 0})` };
      return { ok: false, detail: json?.error ? `Script: ${json.error}` : `HTTP ${r.status} — ${r.contentType.includes("html") ? "HTML (deploy the script as a web app with access: Anyone)" : r.text.slice(0, 200)}` };
    }
    const body = JSON.stringify({ event, ...payload });
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    const r = await safePostJson(app.url, body, { headers: { "X-Scaleitto-Event": event, "X-Scaleitto-Signature": `sha256=${signature}` }, timeoutMs: 15_000 });
    return r.status >= 200 && r.status < 300 ? { ok: true, detail: `HTTP ${r.status}` } : { ok: false, detail: `HTTP ${r.status} ${r.text.slice(0, 200)}` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

async function log(shopId: string, app: AppKey, kind: string, orderId: string | null, r: Result) {
  await db.insert(schema.appEvents).values({ id: newId(), shopId, app, orderId, kind, ok: r.ok, detail: r.detail.slice(0, 500) });
}

async function shopLocaleOf(shopId: string) {
  const [shop] = await db.select({ locale: schema.shops.defaultLocale }).from(schema.shops).where(eq(schema.shops.id, shopId));
  return shop && isLocale(shop.locale) ? shop.locale : "ar";
}

// Sends one order (new or changed) to every active app of the shop.
export async function syncOrder(shopId: string, orderId: string, event: "order.created" | "order.updated") {
  try {
    const apps = await db.select().from(schema.shopApps).where(and(eq(schema.shopApps.shopId, shopId), eq(schema.shopApps.active, true)));
    if (!apps.length) return;
    const [order] = await db.select().from(schema.orders).where(and(eq(schema.orders.shopId, shopId), eq(schema.orders.id, orderId)));
    // A locked order (over the plan's limit) is sent once it is unlocked
    if (!order || order.locked) return;
    const [full] = await loadOrders(shopId, [order]);
    const locale = await shopLocaleOf(shopId);
    for (const app of apps) {
      const payload = app.app === "google_sheets" ? { headers: sheetHeaders(locale), rows: [sheetRow(full, locale)] } : { order: orderPayload(full) };
      await log(shopId, app.app, "order", orderId, await post(app, payload, event));
    }
  } catch (err) {
    await logError("apps/sync", err);
  }
}

// After the response, so customers and agents never wait for an app.
export function scheduleOrderSync(shopId: string, orderId: string, event: "order.created" | "order.updated" = "order.updated") {
  try {
    after(() => syncOrder(shopId, orderId, event));
  } catch {
    void syncOrder(shopId, orderId, event);
  }
}

export const BACKFILL_DAYS = 30;
const BACKFILL_MAX = 500;

// Fills a newly connected sheet with the last 30 days of orders (oldest first, 100 rows per request).
export async function backfillSheet(app: App): Promise<Result> {
  const since = new Date(Date.now() - BACKFILL_DAYS * 86400_000);
  const orders = (await db.select().from(schema.orders).where(and(eq(schema.orders.shopId, app.shopId), eq(schema.orders.locked, false), gte(schema.orders.createdAt, since))).orderBy(desc(schema.orders.createdAt)).limit(BACKFILL_MAX)).reverse();
  const locale = await shopLocaleOf(app.shopId);
  let sent = 0;
  for (let i = 0; i < orders.length; i += 100) {
    const full = await loadOrders(app.shopId, orders.slice(i, i + 100));
    const r = await post(app, { headers: sheetHeaders(locale), rows: full.map((o) => sheetRow(o, locale)) }, "backfill");
    if (!r.ok) {
      await log(app.shopId, app.app, "backfill", null, r);
      return r;
    }
    sent += full.length;
  }
  const r = { ok: true, detail: `${sent}` };
  await log(app.shopId, app.app, "backfill", null, r);
  return r;
}

// "Test" button: the sheet gets its header row, the webhook a test event.
export async function testApp(app: App): Promise<Result> {
  const locale = await shopLocaleOf(app.shopId);
  const r = await post(app, app.app === "google_sheets" ? { headers: sheetHeaders(locale), rows: [] } : { order: null }, "test");
  await log(app.shopId, app.app, "test", null, r);
  return r;
}
