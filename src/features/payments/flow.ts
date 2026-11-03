import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { newId } from "@/server/auth/context";
import { decryptJson } from "@/server/crypto";
import { logError } from "@/server/errors";
import { storeUrl } from "@/lib/urls";
import { clients } from "./connectors";
import type { Keys, PaymentState } from "./connectors/types";
import { chargeAmount, connectorOf, isOnlineMethod, onlineMethods, type ConnectorId, type OnlineMethod } from "./methods";

// What a connected method stores (encrypted): the connector's keys, and for Stripe / PayPal the charge currency + rate
export type MethodSettings = { keys: Keys; currency: "dzd" | "eur" | "usd"; rate: number };

export async function paymentMethods(shopId: string) {
  const rows = await db.select().from(schema.shopPaymentMethods).where(eq(schema.shopPaymentMethods.shopId, shopId));
  return rows
    .filter((r) => isOnlineMethod(r.method))
    .map((r) => ({ ...r, method: r.method as OnlineMethod, connector: r.connector as ConnectorId, settings: decryptJson<MethodSettings>(r.credentials) }));
}

// The methods buyers can choose: switched on, tested, and processed by an implemented connector
export async function liveMethods(shopId: string): Promise<OnlineMethod[]> {
  const rows = await paymentMethods(shopId);
  return onlineMethods.filter((m) => rows.some((r) => r.method === m && r.active && r.checkedAt && connectorOf(m, r.connector)?.ready && clients[r.connector]));
}

const language = (locale: string) => (locale === "fr" || locale === "en" ? locale : "ar");

// Opens the method's payment page for an order: the link to send the buyer to (null = pay on delivery instead)
export async function startOnlinePayment(shop: { id: string; slug: string; customDomain: string | null; domainVerifiedAt: Date | null; defaultLocale: string }, orderId: string, method: string): Promise<string | null> {
  try {
    if (!isOnlineMethod(method)) return null;
    const row = (await paymentMethods(shop.id)).find((r) => r.method === method && r.active && r.checkedAt);
    const client = row ? clients[row.connector] : undefined;
    if (!row || !client || !connectorOf(method, row.connector)?.ready) return null;
    const [order] = await db.select().from(schema.orders).where(and(eq(schema.orders.shopId, shop.id), eq(schema.orders.id, orderId)));
    if (!order) return null;
    const back = `${storeUrl(shop)}/thanks?o=${orderId}`;
    const { currency, rate } = row.settings;
    const started = await client.start(row.settings.keys, row.mode, {
      amount: chargeAmount(order.total, currency, rate),
      currency,
      reference: orderId,
      orderNumber: order.number,
      description: `#${order.number}`,
      returnUrl: `${back}&paid=1`,
      cancelUrl: `${back}&paid=0`,
      language: language(shop.defaultLocale),
    });
    if (!started.ok) {
      await db.update(schema.orders).set({ paymentMethod: method, paymentStatus: "failed", paymentProvider: row.connector }).where(eq(schema.orders.id, orderId));
      await note(shop.id, orderId, `💳 ${method}: ${started.detail}`);
      return null;
    }
    await db.update(schema.orders).set({ paymentMethod: method, paymentStatus: "pending", paymentProvider: row.connector, paymentRef: started.ref }).where(eq(schema.orders.id, orderId));
    return started.url;
  } catch (err) {
    await logError("payments/start", err);
    return null;
  }
}

async function note(shopId: string, orderId: string, text: string) {
  await db.insert(schema.orderEvents).values({ id: newId(), orderId, shopId, type: "note", note: text.slice(0, 500) });
}

// Records the payment once (the return page can be opened several times)
async function markPaid(shopId: string, orderId: string) {
  const [res] = await db
    .update(schema.orders)
    .set({ paymentStatus: "paid", paidAt: new Date() })
    .where(and(eq(schema.orders.shopId, shopId), eq(schema.orders.id, orderId), eq(schema.orders.paymentStatus, "pending")));
  if (res.affectedRows) {
    const [o] = await db.select({ method: schema.orders.paymentMethod, total: schema.orders.total }).from(schema.orders).where(eq(schema.orders.id, orderId));
    await note(shopId, orderId, `💳 ${o?.method ?? ""} ✓ ${o?.total ?? ""}`);
  }
}

// The buyer is back: ask the connector how the payment went (never trust the address bar alone)
export async function refreshPayment(shopId: string, orderId: string): Promise<PaymentState | "none"> {
  const [order] = await db.select().from(schema.orders).where(and(eq(schema.orders.shopId, shopId), eq(schema.orders.id, orderId)));
  if (!order || !isOnlineMethod(order.paymentMethod)) return "none";
  if (order.paymentStatus !== "pending" || !order.paymentRef) return order.paymentStatus === "paid" ? "paid" : order.paymentStatus === "failed" ? "failed" : "pending";
  const row = (await paymentMethods(shopId)).find((r) => r.method === order.paymentMethod);
  const client = row ? clients[row.connector] : undefined;
  if (!row || !client) return "pending";
  try {
    const status = await client.status(row.settings.keys, row.mode, order.paymentRef, chargeAmount(order.total, row.settings.currency, row.settings.rate));
    if (status === "paid") await markPaid(shopId, orderId);
    else if (status === "failed") await db.update(schema.orders).set({ paymentStatus: "failed" }).where(eq(schema.orders.id, orderId));
    return status;
  } catch (err) {
    await logError("payments/refresh", err);
    return "pending";
  }
}
