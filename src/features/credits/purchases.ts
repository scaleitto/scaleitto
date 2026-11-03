import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { clients } from "@/features/payments/connectors";
import type { Keys, Mode } from "@/features/payments/connectors/types";
import { chargeAmount, isOnlineMethod, onlineMethods, type ConnectorId, type OnlineMethod } from "@/features/payments/methods";
import { grantCredits } from "./ledger";

type PlatformMethod = { method: OnlineMethod; connector: ConnectorId; keys: Keys; mode: Mode; currency: "dzd" | "eur" | "usd"; rate: number };
const env = (name: string) => process.env[name]?.trim() || "";

// The platform's own payment accounts, for credit packs paid online (server settings; none = only local payment).
// Each method is separate, like the merchants' ones: Stripe, PayPal, and CIB / Edahabia through SATIM.
export function platformMethods(): PlatformMethod[] {
  const mode: Mode = env("PLATFORM_PAYMENT_MODE") === "live" ? "live" : "test";
  const list: PlatformMethod[] = [];
  if (env("PLATFORM_STRIPE_SECRET")) list.push({ method: "stripe", connector: "stripe", keys: { secretKey: env("PLATFORM_STRIPE_SECRET") }, mode, currency: "dzd", rate: 1 });
  const rate = Number(env("PLATFORM_PAYPAL_RATE"));
  if (env("PLATFORM_PAYPAL_CLIENT_ID") && env("PLATFORM_PAYPAL_SECRET") && rate >= 1)
    list.push({ method: "paypal", connector: "paypal", keys: { clientId: env("PLATFORM_PAYPAL_CLIENT_ID"), clientSecret: env("PLATFORM_PAYPAL_SECRET") }, mode, currency: "eur", rate });
  if (env("PLATFORM_SATIM_USER") && env("PLATFORM_SATIM_PASSWORD") && env("PLATFORM_SATIM_TERMINAL")) {
    const keys = { userName: env("PLATFORM_SATIM_USER"), password: env("PLATFORM_SATIM_PASSWORD"), terminalId: env("PLATFORM_SATIM_TERMINAL") };
    for (const method of ["cib", "edahabia"] as const) list.push({ method, connector: "satim", keys, mode, currency: "dzd", rate: 1 });
  }
  return onlineMethods.flatMap((m) => list.filter((p) => p.method === m));
}

export const platformMethod = (method: string) => platformMethods().find((p) => p.method === method) ?? null;

// Opens the payment page of a pack bought online (credit_purchases.provider_ref = "<method>:<connector's reference>")
export async function startCreditPayment(p: PlatformMethod, purchase: { id: string; amount: number; credits: number }, back: string, language: "ar" | "fr" | "en") {
  const started = await clients[p.connector]!.start(p.keys, p.mode, {
    amount: chargeAmount(purchase.amount, p.currency, p.rate),
    currency: p.currency,
    reference: purchase.id,
    orderNumber: Date.now() % 1_000_000_000,
    description: `${purchase.credits} credits`,
    returnUrl: back,
    cancelUrl: back,
    language,
  });
  if (started.ok) await db.update(schema.creditPurchases).set({ providerRef: `${p.method}:${started.ref}`.slice(0, 80) }).where(eq(schema.creditPurchases.id, purchase.id));
  return started;
}

// A purchase becomes credits exactly once (return page and admin can both report it)
export async function approveCreditPurchase(id: string, adminNote: string | null) {
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(schema.creditPurchases).where(and(eq(schema.creditPurchases.id, id), eq(schema.creditPurchases.status, "pending"))).for("update");
    if (!p) return;
    await tx.update(schema.creditPurchases).set({ status: "paid", adminNote: adminNote?.slice(0, 500) ?? null, decidedAt: new Date() }).where(eq(schema.creditPurchases.id, id));
    await grantCredits(p.shopId, p.credits, "purchase", p.pack, tx);
  });
}

// Back from the payment page: ask the method's connector how it went (never trust the address bar)
export async function refreshCreditPurchase(shopId: string, id: string) {
  const [p] = await db.select().from(schema.creditPurchases).where(and(eq(schema.creditPurchases.shopId, shopId), eq(schema.creditPurchases.id, id)));
  if (!p || p.status !== "pending" || p.method !== "card" || !p.providerRef) return p?.status ?? null;
  const [method, ...rest] = p.providerRef.split(":");
  const gateway = isOnlineMethod(method) ? platformMethod(method) : null;
  if (!gateway) return "pending";
  const status = await clients[gateway.connector]!.status(gateway.keys, gateway.mode, rest.join(":"), chargeAmount(p.amount, gateway.currency, gateway.rate));
  if (status === "paid") await approveCreditPurchase(id, null);
  else if (status === "failed") await db.update(schema.creditPurchases).set({ status: "rejected", decidedAt: new Date() }).where(eq(schema.creditPurchases.id, id));
  return status === "paid" ? "paid" : status === "failed" ? "rejected" : "pending";
}
