import "server-only";
import { createHmac } from "node:crypto";
import { after } from "next/server";
import { and, asc, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { newId } from "@/server/auth/context";
import { decryptJson } from "@/server/crypto";
import { logError } from "@/server/errors";
import { safePostJson } from "@/server/safe-fetch";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { wilayaName } from "@/lib/wilayas";
import type { AppKey } from "@/server/db/schema";
import { SCRIPT_VERSION } from "./apps-script";

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

type ScriptAnswer = { ok?: boolean; error?: string; version?: number; sheet?: string; gid?: number; url?: string; count?: number; written?: { key: string; row: number }[] };

// The script's JSON answer (null when Google answered with an HTML page, e.g. a deployment that is not public)
function readScriptAnswer(text: string): ScriptAnswer | null {
  try {
    const json = JSON.parse(text);
    return json && typeof json === "object" ? (json as ScriptAnswer) : null;
  } catch {
    return null;
  }
}

async function post(app: App, payload: Record<string, unknown>, event: string): Promise<Result> {
  const secret = decryptJson<string>(app.secret);
  try {
    if (app.app === "google_sheets") {
      const r = await safePostJson(app.url, JSON.stringify({ ...payload, token: secret }), { timeoutMs: 25_000 });
      const answer = readScriptAnswer(r.text);
      if (!answer?.ok) {
        return { ok: false, detail: answer?.error ? `Script: ${answer.error}` : `HTTP ${r.status} — ${r.contentType.includes("html") ? "HTML (deploy the script as a web app with access: Anyone)" : r.text.slice(0, 200)}` };
      }
      // A test with a copy of the script older than the one shown in the dashboard
      if (event === "test" && (answer.version ?? 1) < SCRIPT_VERSION) return { ok: false, detail: OLD_SCRIPT };
      // The "Open the sheet" button opens the very tab the orders are written to
      if (answer.url && /^https:\/\/docs\.google\.com\/spreadsheets\//.test(answer.url)) {
        const link = (answer.gid === undefined ? answer.url : `${answer.url.split("#")[0]}#gid=${answer.gid}`).slice(0, 500);
        if (link !== app.sheetUrl) await db.update(schema.shopApps).set({ sheetUrl: link }).where(eq(schema.shopApps.id, app.id));
      }
      // Where the rows went, e.g. "Orders: 1043 → row 12" (older scripts only say how many)
      const tab = answer.sheet ?? "Orders";
      const where = answer.written?.length ? answer.written.map((w) => `${w.key} → ${w.row}`).join(", ") : `${answer.count ?? (payload.rows as unknown[] | undefined)?.length ?? 0}`;
      return { ok: true, detail: event === "test" ? tab : `${tab}: ${where}`.slice(0, 500) };
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

type SyncEvent = "order.created" | "order.updated";

// Sends one order (new or changed) to every active app of the shop. Returns the first failure, or null
// when every app accepted it (or there is nothing to send).
export async function syncOrder(shopId: string, orderId: string, event: SyncEvent): Promise<string | null> {
  try {
    const apps = await db.select().from(schema.shopApps).where(and(eq(schema.shopApps.shopId, shopId), eq(schema.shopApps.active, true)));
    if (!apps.length) return null;
    const [order] = await db.select().from(schema.orders).where(and(eq(schema.orders.shopId, shopId), eq(schema.orders.id, orderId)));
    if (!order) return null;
    // A locked order (over the plan's limit) is sent once it is unlocked; the log says why it waits
    if (order.locked) {
      for (const app of apps) await log(shopId, app.app, "order", orderId, { ok: false, detail: LOCKED });
      return null;
    }
    const [full] = await loadOrders(shopId, [order]);
    const locale = await shopLocaleOf(shopId);
    let failure: string | null = null;
    for (const app of apps) {
      const payload = app.app === "google_sheets" ? { headers: sheetHeaders(locale), rows: [sheetRow(full, locale)] } : { order: orderPayload(full) };
      const r = await post(app, payload, event);
      await log(shopId, app.app, "order", orderId, r);
      if (!r.ok) failure ??= r.detail;
    }
    return failure;
  } catch (err) {
    await logError("apps/sync", err);
    return err instanceof Error ? err.message : String(err);
  }
}

// Minutes to wait before the next try (then the order is dropped from the queue; the failures stay in the log)
const RETRY_MINUTES = [1, 2, 5, 10, 30, 60, 120, 240, 480, 720];

// Puts an order in the queue (once: a newer change only makes it due now). Nothing when the shop has no app.
async function queueOrderSync(shopId: string, orderId: string, event: SyncEvent) {
  const [app] = await db.select({ id: schema.shopApps.id }).from(schema.shopApps).where(and(eq(schema.shopApps.shopId, shopId), eq(schema.shopApps.active, true))).limit(1);
  if (!app) return false;
  const q = schema.appQueue;
  await db
    .insert(q)
    .values({ id: newId(), shopId, orderId, event })
    .onDuplicateKeyUpdate({ set: { nextAt: sql`CURRENT_TIMESTAMP(3)`, attempts: 0, event: sql.raw("IF(`event` = 'order.created', `event`, VALUES(`event`))") } });
  return true;
}

// Sends what is due in the queue (one shop, or every shop for the cron URL), within a time budget.
export async function processQueue(shopId: string | null, { limit = 20, budgetMs = 20_000, now = false } = {}) {
  const q = schema.appQueue;
  const started = Date.now();
  // "Send now" from the dashboard: the shop's waiting orders are due at once, whatever their retry time
  if (now && shopId) await db.update(q).set({ nextAt: sql`CURRENT_TIMESTAMP(3)` }).where(eq(q.shopId, shopId));
  const due = await db
    .select()
    .from(q)
    .where(and(lte(q.nextAt, sql`CURRENT_TIMESTAMP(3)`), shopId ? eq(q.shopId, shopId) : undefined))
    .orderBy(asc(q.createdAt))
    .limit(limit);
  let sent = 0;
  let failed = 0;
  for (const row of due) {
    if (Date.now() - started > budgetMs) break;
    // Claimed for 3 minutes, so two processes never send the same order at once
    const [claim] = await db.update(q).set({ nextAt: sql`CURRENT_TIMESTAMP(3) + INTERVAL 3 MINUTE` }).where(and(eq(q.id, row.id), lte(q.nextAt, sql`CURRENT_TIMESTAMP(3)`)));
    if (!claim.affectedRows) continue;
    const failure = await syncOrder(row.shopId, row.orderId, row.event as SyncEvent);
    if (!failure) {
      sent++;
      await db.delete(q).where(eq(q.id, row.id));
    } else {
      failed++;
      const attempts = row.attempts + 1;
      if (attempts >= RETRY_MINUTES.length) await db.delete(q).where(eq(q.id, row.id));
      else await db.update(q).set({ attempts, lastError: failure.slice(0, 500), nextAt: sql`CURRENT_TIMESTAMP(3) + INTERVAL ${RETRY_MINUTES[attempts - 1]} MINUTE` }).where(eq(q.id, row.id));
    }
  }
  const [{ n: left }] = await db.select({ n: count() }).from(q).where(shopId ? eq(q.shopId, shopId) : undefined);
  return { sent, failed, left };
}

// Queued now (so it is never lost), sent right after the response (customers and agents never wait for an
// app); what could not be sent is retried by the next orders, the dashboard's "send now" or the cron URL.
export async function scheduleOrderSync(shopId: string, orderId: string, event: SyncEvent = "order.updated") {
  try {
    if (!(await queueOrderSync(shopId, orderId, event))) return;
  } catch (err) {
    await logError("apps/queue", err);
    return;
  }
  const run = () => processQueue(shopId).catch((err) => logError("apps/queue-run", err));
  try {
    after(run);
  } catch {
    void run();
  }
}

// What the dashboard shows: orders waiting and the reason of the oldest failure
export async function queueStatus(shopId: string) {
  const q = schema.appQueue;
  const [[{ n }], [oldest]] = await Promise.all([
    db.select({ n: count() }).from(q).where(eq(q.shopId, shopId)),
    db.select({ lastError: q.lastError, attempts: q.attempts }).from(q).where(eq(q.shopId, shopId)).orderBy(asc(q.createdAt)).limit(1),
  ]);
  return { waiting: n, lastError: oldest?.lastError ?? null };
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

export const OLD_SCRIPT = "OLD_SCRIPT";
export const LOCKED = "LOCKED";

// "Test" button: the sheet gets its header row and a visible test row (key "TEST", updated by every test),
// the webhook a test event. For the sheet, the detail is the tab the script writes to.
export async function testApp(app: App): Promise<Result> {
  const locale = await shopLocaleOf(app.shopId);
  const headers = sheetHeaders(locale);
  const testRow = headers.map((_, i) => (i === 0 ? "TEST" : i === 1 ? getDictionary(locale).apps.sheets.testRow : i === 2 ? new Date().toISOString().slice(0, 16).replace("T", " ") : ""));
  const r = await post(app, app.app === "google_sheets" ? { headers, rows: [testRow] } : { order: null }, "test");
  await log(app.shopId, app.app, "test", null, r);
  return r;
}
