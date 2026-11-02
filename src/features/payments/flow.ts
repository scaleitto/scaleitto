import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { newId } from "@/server/auth/context";
import { decryptJson } from "@/server/crypto";
import { logError } from "@/server/errors";
import { storeUrl } from "@/lib/urls";
import type { PaymentProvider } from "@/server/db/schema";
import { chargily, slickpay, type ChargilyKeys, type SlickpayKeys } from "./providers";

// Apps → Online payments: from a placed order to the gateway's page and back.
export async function paymentAccounts(shopId: string) {
  const rows = await db.select().from(schema.shopPayments).where(eq(schema.shopPayments.shopId, shopId));
  return rows.map((r) => ({ ...r, keys: decryptJson<ChargilyKeys & SlickpayKeys>(r.credentials) }));
}

// The gateway the store's buyers pay with: a working, active account (Chargily first)
export async function cardGateway(shopId: string) {
  const accounts = (await paymentAccounts(shopId)).filter((a) => a.active && a.checkedAt);
  return accounts.find((a) => a.provider === "chargily") ?? accounts.find((a) => a.provider === "slickpay") ?? null;
}

const appUrl = () => (process.env.APP_URL ?? "").replace(/\/$/, "");

// Opens the gateway's payment page for an order: the link to send the buyer to (null = pay on delivery instead)
export async function startCardPayment(shop: { id: string; slug: string; customDomain: string | null; domainVerifiedAt: Date | null; defaultLocale: string }, orderId: string): Promise<string | null> {
  try {
    const gateway = await cardGateway(shop.id);
    if (!gateway) return null;
    const [order] = await db.select().from(schema.orders).where(and(eq(schema.orders.shopId, shop.id), eq(schema.orders.id, orderId)));
    if (!order) return null;
    const items = await db.select({ name: schema.orderItems.name, quantity: schema.orderItems.quantity, total: schema.orderItems.total }).from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
    const back = `${storeUrl(shop)}/thanks?o=${orderId}`;
    const started =
      gateway.provider === "chargily"
        ? await chargily.checkout(gateway.keys, gateway.mode, { amount: order.total, successUrl: `${back}&paid=1`, failureUrl: `${back}&paid=0`, webhookUrl: `${appUrl()}/api/payments/chargily/${shop.id}`, locale: shop.defaultLocale, feesOnBuyer: gateway.feesOnBuyer, description: `#${order.number}`, orderId })
        : await slickpay.checkout(gateway.keys, gateway.mode, {
            amount: order.total,
            returnUrl: `${back}&paid=1`,
            firstname: order.customerName.split(/\s+/)[0] ?? order.customerName,
            lastname: order.customerName.split(/\s+/).slice(1).join(" "),
            phone: order.phone,
            address: [order.address, order.commune].filter(Boolean).join(", "),
            items: items.map((i) => ({ name: i.name, price: Math.round(i.total / Math.max(1, i.quantity)), quantity: i.quantity })),
          });
    if (!started.ok) {
      await db.update(schema.orders).set({ paymentMethod: "card", paymentStatus: "failed", paymentProvider: gateway.provider }).where(eq(schema.orders.id, orderId));
      await note(shop.id, orderId, `💳 ${gateway.provider}: ${started.detail}`);
      return null;
    }
    await db.update(schema.orders).set({ paymentMethod: "card", paymentStatus: "pending", paymentProvider: gateway.provider, paymentRef: started.id }).where(eq(schema.orders.id, orderId));
    return started.url;
  } catch (err) {
    await logError("payments/start", err);
    return null;
  }
}

async function note(shopId: string, orderId: string, text: string) {
  await db.insert(schema.orderEvents).values({ id: newId(), orderId, shopId, type: "note", note: text.slice(0, 500) });
}

// Records the payment once (the webhook and the buyer's return can both report it)
export async function markPaid(shopId: string, orderId: string) {
  const [res] = await db
    .update(schema.orders)
    .set({ paymentStatus: "paid", paidAt: new Date() })
    .where(and(eq(schema.orders.shopId, shopId), eq(schema.orders.id, orderId), eq(schema.orders.paymentMethod, "card")));
  if (res.affectedRows) {
    const [o] = await db.select({ provider: schema.orders.paymentProvider, total: schema.orders.total }).from(schema.orders).where(eq(schema.orders.id, orderId));
    await note(shopId, orderId, `💳 ${o?.provider ?? ""} ✓ ${o?.total ?? ""}`);
  }
}

// The buyer is back from the gateway: ask it how the payment went (never trust the address bar alone)
export async function refreshPayment(shopId: string, orderId: string) {
  const [order] = await db.select().from(schema.orders).where(and(eq(schema.orders.shopId, shopId), eq(schema.orders.id, orderId)));
  if (!order || order.paymentMethod !== "card" || order.paymentStatus !== "pending" || !order.paymentRef) return order?.paymentStatus ?? "none";
  const account = (await paymentAccounts(shopId)).find((a) => a.provider === (order.paymentProvider as PaymentProvider));
  if (!account) return "pending";
  try {
    const status = account.provider === "chargily" ? await chargily.status(account.keys, account.mode, order.paymentRef) : await slickpay.status(account.keys, account.mode, order.paymentRef);
    if (status === "paid") await markPaid(shopId, orderId);
    else if (status === "failed") await db.update(schema.orders).set({ paymentStatus: "failed" }).where(eq(schema.orders.id, orderId));
    return status;
  } catch (err) {
    await logError("payments/refresh", err);
    return "pending";
  }
}
