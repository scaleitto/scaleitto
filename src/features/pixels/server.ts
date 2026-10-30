import "server-only";
import { createHash } from "node:crypto";
import { after } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { newId } from "@/server/auth/context";
import { decryptJson } from "@/server/crypto";
import { logError } from "@/server/errors";
import type { OrderTracking, PurchaseTrigger } from "@/server/db/schema";
import { metaGraph } from "@/server/meta";
import { intlPhone } from "@/lib/phone";
import { serverPlatforms } from "./ids";
import { PENDING_STATUSES } from "@/features/orders/statuses";

// Server-side purchase events: Meta Conversions API, TikTok Events API, GA4 Measurement Protocol.
// The event id is the order id, the same as the browser's, so each platform counts the order once.
// E2E_PIXEL_URL points every platform at a local fake server during the automated tests.
const hosts = () => {
  const fake = process.env.E2E_PIXEL_URL;
  return {
    tiktok: fake ? `${fake}/tiktok` : "https://business-api.tiktok.com",
    ga4: fake ? `${fake}/ga4` : "https://www.google-analytics.com",
  };
};
const CURRENCY = "DZD";
const sha = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

type Pixel = typeof schema.pixels.$inferSelect;
type OrderData = {
  id: string;
  number: number;
  total: number;
  phone: string;
  customerName: string;
  ip: string | null;
  userAgent: string | null;
  tracking: OrderTracking | null;
  createdAt: Date;
  items: { productId: string | null; name: string; quantity: number; unitPrice: number }[];
};
type Result = { ok: boolean; detail: string };

async function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    // not JSON
  }
  return { status: res.status, ok: res.ok, json, text: text.slice(0, 300) };
}

const secretOf = (pixel: Pixel) => (pixel.secret ? decryptJson<string>(pixel.secret) : null);

async function sendMeta(pixel: Pixel, secret: string, order: OrderData): Promise<Result> {
  const t = order.tracking ?? {};
  const [first, ...rest] = order.customerName.trim().split(/\s+/);
  const event = {
    event_name: "Purchase",
    event_time: Math.floor(Date.now() / 1000),
    event_id: order.id,
    action_source: "website",
    event_source_url: t.url,
    user_data: {
      ph: [sha(intlPhone(order.phone))],
      external_id: [sha(order.phone)],
      fn: first ? [sha(first)] : undefined,
      ln: rest.length ? [sha(rest.join(" "))] : undefined,
      country: [sha("dz")],
      client_ip_address: order.ip ?? undefined,
      client_user_agent: order.userAgent ?? undefined,
      fbp: t.fbp,
      fbc: t.fbc,
    },
    custom_data: {
      currency: CURRENCY,
      value: order.total,
      order_id: order.id,
      content_type: "product",
      content_ids: order.items.map((i) => i.productId ?? i.name),
      contents: order.items.map((i) => ({ id: i.productId ?? i.name, quantity: i.quantity, item_price: i.unitPrice })),
      num_items: order.items.reduce((s, i) => s + i.quantity, 0),
    },
  };
  const r = await post(`${metaGraph()}/${pixel.tagId}/events?access_token=${encodeURIComponent(secret)}`, { data: [event], ...(pixel.testCode ? { test_event_code: pixel.testCode } : {}) });
  const error = (r.json?.error as { message?: string } | undefined)?.message;
  return r.ok && !error ? { ok: true, detail: `events_received: ${String(r.json?.events_received ?? "?")}` } : { ok: false, detail: error ?? `HTTP ${r.status} ${r.text}` };
}

async function sendTiktok(pixel: Pixel, secret: string, order: OrderData): Promise<Result> {
  const t = order.tracking ?? {};
  const body = {
    event_source: "web",
    event_source_id: pixel.tagId,
    ...(pixel.testCode ? { test_event_code: pixel.testCode } : {}),
    data: [
      {
        event: "CompletePayment",
        event_time: Math.floor(Date.now() / 1000),
        event_id: order.id,
        user: { phone: sha(`+${intlPhone(order.phone)}`), external_id: sha(order.phone), ip: order.ip ?? undefined, user_agent: order.userAgent ?? undefined, ttclid: t.ttclid, ttp: t.ttp },
        page: t.url ? { url: t.url } : undefined,
        properties: {
          currency: CURRENCY,
          value: order.total,
          order_id: order.id,
          content_type: "product",
          contents: order.items.map((i) => ({ content_id: i.productId ?? i.name, content_name: i.name, quantity: i.quantity, price: i.unitPrice })),
        },
      },
    ],
  };
  const r = await post(`${hosts().tiktok}/open_api/v1.3/event/track/`, body, { "Access-Token": secret });
  return r.ok && r.json?.code === 0 ? { ok: true, detail: String(r.json?.message ?? "OK") } : { ok: false, detail: String(r.json?.message ?? `HTTP ${r.status} ${r.text}`) };
}

// GA4 accepts anything with 204; the debug endpoint returns validation messages (used for tests).
async function sendGa4(pixel: Pixel, secret: string, order: OrderData, test: boolean): Promise<Result> {
  const body = {
    client_id: order.tracking?.gaClientId ?? `${order.number}.${Math.floor(order.createdAt.getTime() / 1000)}`,
    events: [
      {
        name: "purchase",
        params: { transaction_id: order.id, currency: CURRENCY, value: order.total, items: order.items.map((i) => ({ item_id: i.productId ?? i.name, item_name: i.name, price: i.unitPrice, quantity: i.quantity })) },
      },
    ],
  };
  const r = await post(`${hosts().ga4}/${test ? "debug/mp" : "mp"}/collect?measurement_id=${pixel.tagId}&api_secret=${encodeURIComponent(secret)}`, body);
  const problems = (r.json?.validationMessages as { description?: string }[] | undefined) ?? [];
  if (!r.ok) return { ok: false, detail: `HTTP ${r.status} ${r.text}` };
  return problems.length ? { ok: false, detail: problems.map((p) => p.description).join(" · ") } : { ok: true, detail: `HTTP ${r.status}` };
}

function sendTo(pixel: Pixel, secret: string, order: OrderData, test = false): Promise<Result> {
  if (pixel.platform === "meta") return sendMeta(pixel, secret, order);
  if (pixel.platform === "tiktok") return sendTiktok(pixel, secret, order);
  return sendGa4(pixel, secret, order, test);
}

async function loadOrder(shopId: string, orderId: string): Promise<(OrderData & { status: string }) | null> {
  const [order] = await db.select().from(schema.orders).where(and(eq(schema.orders.shopId, shopId), eq(schema.orders.id, orderId)));
  if (!order) return null;
  const items = await db
    .select({ productId: schema.orderItems.productId, name: schema.orderItems.name, quantity: schema.orderItems.quantity, unitPrice: schema.orderItems.unitPrice })
    .from(schema.orderItems)
    .where(and(eq(schema.orderItems.shopId, shopId), eq(schema.orderItems.orderId, orderId)));
  return { ...order, items };
}

// Statuses that mean the trigger was reached (and not undone since)
const reached: Record<PurchaseTrigger, string[]> = { placed: [...PENDING_STATUSES, "confirmed", "in_transit", "delivered"], confirmed: ["confirmed", "in_transit", "delivered"], delivered: ["delivered"] };

// Sends the order's purchase to every active pixel of the shop that reports purchases at this trigger,
// has a server secret and covers one of the order's products. Each (pixel, order) is sent at most once.
export async function sendOrderEvents(shopId: string, orderId: string, trigger: PurchaseTrigger) {
  try {
    const order = await loadOrder(shopId, orderId);
    if (!order || !reached[trigger].includes(order.status)) return;
    const pixels = await db
      .select()
      .from(schema.pixels)
      .where(and(eq(schema.pixels.shopId, shopId), eq(schema.pixels.active, true), eq(schema.pixels.purchaseOn, trigger), inArray(schema.pixels.platform, serverPlatforms)));
    const products = new Set(order.items.map((i) => i.productId));
    for (const pixel of pixels) {
      const secret = secretOf(pixel);
      if (!secret || (pixel.productIds && !pixel.productIds.some((id) => products.has(id)))) continue;
      const rowId = newId();
      // The unique index makes a second attempt for the same order fail here, before anything is sent
      const claimed = await db
        .insert(schema.pixelEvents)
        .values({ id: rowId, shopId, pixelId: pixel.id, orderId, event: "purchase", status: "sending" })
        .then(() => true)
        .catch(() => false);
      if (!claimed) continue;
      const result = await sendTo(pixel, secret, order).catch((err: unknown) => ({ ok: false, detail: err instanceof Error ? err.message : String(err) }));
      await db
        .update(schema.pixelEvents)
        .set({ status: result.ok ? "sent" : "failed", detail: result.detail.slice(0, 500) })
        .where(eq(schema.pixelEvents.id, rowId));
    }
  } catch (err) {
    await logError("pixels/server-events", err);
  }
}

// Runs after the response (the customer or the agent does not wait for the ad platforms).
export function scheduleOrderEvents(shopId: string, orderId: string, trigger: PurchaseTrigger) {
  try {
    after(() => sendOrderEvents(shopId, orderId, trigger));
  } catch {
    // outside a request (scripts): send now, in the background
    void sendOrderEvents(shopId, orderId, trigger);
  }
}

// "Send a test event" from the dashboard. Meta/TikTok only receive a purchase when a test event code is set
// (it then appears in their Test Events tab, not in the ad reports); otherwise Meta's token is only checked.
export async function testPixel(pixel: Pixel): Promise<Result & { needsTestCode?: boolean }> {
  const secret = secretOf(pixel);
  if (!secret) return { ok: false, detail: "no secret" };
  const sample: OrderData = {
    id: `test-${Date.now()}`,
    number: 1000,
    total: 3500,
    phone: "0555000000",
    customerName: "Test Scaleitto",
    ip: null,
    userAgent: "Scaleitto test",
    tracking: null,
    createdAt: new Date(),
    items: [{ productId: "test-product", name: "Test", quantity: 1, unitPrice: 3000 }],
  };
  let result: Result & { needsTestCode?: boolean };
  if ((pixel.platform === "meta" || pixel.platform === "tiktok") && !pixel.testCode) {
    if (pixel.platform === "tiktok") return { ok: false, detail: "test code", needsTestCode: true };
    const res = await fetch(`${metaGraph()}/${pixel.tagId}?fields=name&access_token=${encodeURIComponent(secret)}`, { signal: AbortSignal.timeout(8000) }).catch((err: unknown) => ({ ok: false, status: 0, json: async () => ({ error: { message: String(err) } }) }));
    const json = (await res.json().catch(() => null)) as { name?: string; error?: { message?: string } } | null;
    result = res.ok && !json?.error ? { ok: true, detail: `Pixel: ${json?.name ?? pixel.tagId}` } : { ok: false, detail: json?.error?.message ?? `HTTP ${res.status}` };
  } else {
    result = await sendTo(pixel, secret, sample, true).catch((err: unknown) => ({ ok: false, detail: err instanceof Error ? err.message : String(err) }));
  }
  await db.insert(schema.pixelEvents).values({ id: newId(), shopId: pixel.shopId, pixelId: pixel.id, orderId: null, event: "test", status: result.ok ? "sent" : "failed", detail: result.detail.slice(0, 500) });
  return result;
}
