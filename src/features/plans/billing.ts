import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import type { PaymentMethod } from "@/server/db/schema";
import { releaseLockedOrders } from "./locked";
import { settleReferral } from "@/features/referrals/referrals";
import { clients } from "@/features/payments/connectors";
import { chargeAmount, isOnlineMethod } from "@/features/payments/methods";
import { platformMethod, platformMethods } from "@/features/credits/purchases";

export { PERIODS, termDiscount, planAmount } from "./terms";
// Packs of orders a pay-as-you-go request can buy at once
export const PACKS = [1, 2, 3, 5, 10] as const;

// The platform's payment details, from the server's environment (.env). A method shows only when set.
export function paymentDetails(): { holder: string | null; methods: Partial<Record<PaymentMethod, string>> } {
  const env = (k: string) => process.env[k]?.trim() || undefined;
  const methods: Partial<Record<PaymentMethod, string>> = {};
  if (env("PAYMENT_CCP")) methods.ccp = env("PAYMENT_CCP");
  if (env("PAYMENT_RIB")) methods.rib = env("PAYMENT_RIB");
  if (env("PAYMENT_WHATSAPP")) methods.whatsapp = env("PAYMENT_WHATSAPP")!.replace(/[^\d]/g, "");
  return { holder: env("PAYMENT_HOLDER") ?? null, methods };
}

// The platform admin accepts a paid request and locked orders open. A monthly plan: the shop moves to it and its paid
// period is extended (from today, or from the end of the current period when renewing the same plan).
// A pay-as-you-go plan: the shop moves to it with no end date and its balance grows by the packs bought.
export async function approvePlanRequest(requestId: string, adminNote: string | null) {
  const result = await db.transaction(async (tx) => {
    const [req] = await tx.select().from(schema.planRequests).where(and(eq(schema.planRequests.id, requestId), eq(schema.planRequests.status, "pending"))).for("update");
    if (!req) return null;
    const [shop] = await tx.select({ planId: schema.shops.planId, expiresAt: schema.shops.planExpiresAt }).from(schema.shops).where(eq(schema.shops.id, req.shopId)).for("update");
    const now = new Date();
    const [plan] = await tx.select({ orderPack: schema.plans.orderPack }).from(schema.plans).where(eq(schema.plans.id, req.planId));
    // Refer a seller: the voucher used is spent; a referred store's first payment opens its referrer's voucher
    await settleReferral(tx, req);
    if (plan?.orderPack) {
      await tx
        .update(schema.shops)
        .set({ planId: req.planId, planExpiresAt: null, orderCredits: sql`${schema.shops.orderCredits} + ${req.months * plan.orderPack}` })
        .where(eq(schema.shops.id, req.shopId));
      await tx.update(schema.planRequests).set({ status: "approved", adminNote, decidedAt: now }).where(eq(schema.planRequests.id, requestId));
      return req.shopId;
    }
    const from = shop && shop.planId === req.planId && shop.expiresAt && shop.expiresAt > now ? shop.expiresAt : now;
    const until = new Date(from);
    until.setMonth(until.getMonth() + req.months);
    await tx.update(schema.shops).set({ planId: req.planId, planExpiresAt: until }).where(eq(schema.shops.id, req.shopId));
    await tx.update(schema.planRequests).set({ status: "approved", adminNote, decidedAt: now }).where(eq(schema.planRequests.id, requestId));
    return req.shopId;
  });
  if (result) await releaseLockedOrders(result);
  return Boolean(result);
}

export async function rejectPlanRequest(requestId: string, adminNote: string | null) {
  const [res] = await db
    .update(schema.planRequests)
    .set({ status: "rejected", adminNote, decidedAt: new Date() })
    .where(and(eq(schema.planRequests.id, requestId), eq(schema.planRequests.status, "pending")));
  return res.affectedRows > 0;
}

// Plans → payment method "Online payment": the platform's own payment accounts (the same as the balance's packs)
export const onlinePlanMethods = () => platformMethods().map((p) => p.method);

// Opens the payment page of a plan request paid online (plan_requests.provider_ref = "<method>:<gateway reference>")
export async function startPlanPayment(method: string, request: { id: string; amount: number; label: string }, back: string, language: "ar" | "fr" | "en") {
  const p = platformMethod(method);
  if (!p) return { ok: false as const };
  const started = await clients[p.connector]!.start(p.keys, p.mode, {
    amount: chargeAmount(request.amount, p.currency, p.rate),
    currency: p.currency,
    reference: request.id,
    orderNumber: Date.now() % 1_000_000_000,
    description: request.label,
    returnUrl: back,
    cancelUrl: back,
    language,
  });
  if (started.ok) await db.update(schema.planRequests).set({ providerRef: `${p.method}:${started.ref}`.slice(0, 80) }).where(eq(schema.planRequests.id, request.id));
  return started;
}

// Back from the payment page: the gateway says how it went (never the address bar); paid = the plan starts at once
export async function refreshPlanPayment(shopId: string, id: string) {
  const [r] = await db.select().from(schema.planRequests).where(and(eq(schema.planRequests.shopId, shopId), eq(schema.planRequests.id, id)));
  if (!r || r.status !== "pending" || r.method !== "online" || !r.providerRef) return r?.status ?? null;
  const [method, ...rest] = r.providerRef.split(":");
  const gateway = isOnlineMethod(method) ? platformMethod(method) : null;
  if (!gateway) return "pending";
  const status = await clients[gateway.connector]!.status(gateway.keys, gateway.mode, rest.join(":"), chargeAmount(r.amount, gateway.currency, gateway.rate));
  if (status === "paid") await approvePlanRequest(id, null);
  else if (status === "failed") await db.update(schema.planRequests).set({ status: "rejected", decidedAt: new Date() }).where(eq(schema.planRequests.id, id));
  return status === "paid" ? "approved" : status === "failed" ? "rejected" : "pending";
}
