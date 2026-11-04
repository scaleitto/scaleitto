"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { newId, requirePlatformAdmin, requireSection } from "@/server/auth/context";
import { safeAction } from "@/server/errors";
import { asLocale } from "@/i18n";
import { fieldErrorsFrom } from "@/lib/validation";
import type { ActionState } from "@/lib/action";
import { paymentMethods } from "@/server/db/schema";
import { FREE_PLAN } from "@/server/limits";
import { PACKS, PERIODS, approvePlanRequest, onlinePlanMethods, paymentDetails, planAmount, rejectPlanRequest, startPlanPayment } from "./billing";
import { findQuotaPack } from "./packs";
import { releaseLockedOrders } from "./locked";
import { spendCredits } from "@/features/credits/ledger";
import { packMonth } from "@/server/limits";
import { redirect } from "next/navigation";
import { sectionHref } from "@/lib/permissions";
import { referralDiscount } from "@/features/referrals/referrals";
import { pendingRequest } from "./queries";

const requestSchema = z.object({
  planId: z.string().uuid("e:invalid"),
  // Months of a monthly plan (PERIODS) or packs of a pay-as-you-go plan (PACKS), checked once the plan is known
  months: z.coerce.number().int("e:invalid"),
  method: z.enum(paymentMethods, { error: "e:paymentMethod" }),
  receiptUrl: z.string().trim().max(255),
  note: z.string().trim().max(500, "e:invalid"),
});

// The owner asks for a paid plan: transfer + receipt (or WhatsApp), then the platform admin approves.
export async function requestPlan(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("plans/request", async () => {
    const { shop, user } = await requireSection(asLocale(lang), "plans");
    const parsed = requestSchema.safeParse({
      planId: formData.get("planId"),
      months: formData.get("months"),
      method: formData.get("method"),
      receiptUrl: formData.get("receiptUrl") ?? "",
      note: formData.get("note") ?? "",
    });
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const d = parsed.data;
    if (!paymentDetails().methods[d.method]) return { ok: false, error: "checkFields", fieldErrors: { method: "paymentMethod" } };
    // The receipt must be an image this shop uploaded
    if (d.method !== "whatsapp" && !d.receiptUrl.startsWith(`/uploads/${shop.id}/`)) return { ok: false, error: "checkFields", fieldErrors: { receiptUrl: "receipt" } };
    const [plan] = await db.select().from(schema.plans).where(and(eq(schema.plans.id, d.planId), eq(schema.plans.isActive, true)));
    if (!plan || plan.code === FREE_PLAN || plan.priceMonthly <= 0) return { ok: false, error: "invalid" };
    if (!((plan.orderPack ? PACKS : PERIODS) as readonly number[]).includes(d.months)) return { ok: false, error: "invalid" };
    if (await pendingRequest(shop.id)) return { ok: false, error: "requestPending" };
    // Refer a seller: the referred store's first payment and the referrer's vouchers come off the amount
    const gross = planAmount(plan, d.months);
    const { discount, voucherId } = await referralDiscount(shop.id, plan, gross);
    await db.insert(schema.planRequests).values({
      id: newId(),
      shopId: shop.id,
      planId: plan.id,
      months: d.months,
      amount: gross - discount,
      discount,
      voucherId,
      method: d.method,
      receiptUrl: d.method === "whatsapp" ? null : d.receiptUrl,
      note: d.note || null,
      requestedBy: user.id,
    });
    refresh();
    return { ok: true };
  });
}

export async function cancelPlanRequest(lang: string, id: string): Promise<ActionState> {
  return safeAction("plans/cancel", async () => {
    const { shop } = await requireSection(asLocale(lang), "plans");
    await db
      .update(schema.planRequests)
      .set({ status: "cancelled", decidedAt: new Date() })
      .where(and(eq(schema.planRequests.shopId, shop.id), eq(schema.planRequests.id, id), eq(schema.planRequests.status, "pending")));
    refresh();
    return { ok: true };
  });
}

// Platform admin
export async function decidePlanRequest(lang: string, id: string, approve: boolean, note: string): Promise<ActionState> {
  return safeAction("admin/plan-request", async () => {
    await requirePlatformAdmin(asLocale(lang));
    const adminNote = note.trim().slice(0, 500) || null;
    const ok = approve ? await approvePlanRequest(id, adminNote) : await rejectPlanRequest(id, adminNote);
    refresh();
    return ok ? { ok: true } : { ok: false, error: "notFound" };
  });
}

// Plans → Feature packs: extra quota for this month, paid with credits (refused when the balance is short)
export async function buyQuotaPack(lang: string, key: string): Promise<ActionState> {
  return safeAction("plans/pack", async () => {
    const { shop } = await requireSection(asLocale(lang), "plans");
    const pack = findQuotaPack(key);
    if (!pack) return { ok: false, error: "invalid" };
    if (!(await spendCredits(shop.id, pack.credits, "subscription", `pack:${pack.key}`))) return { ok: false, error: "notEnoughCredits" };
    await db.insert(schema.quotaPacks).values({ id: newId(), shopId: shop.id, pack: pack.key, limitKey: pack.limit, amount: pack.amount, credits: pack.credits, month: packMonth() });
    await releaseLockedOrders(shop.id);
    refresh();
    return { ok: true };
  });
}

// Plans → "Online payment": the request is created and the buyer goes to the gateway's page (paid = the plan starts at once)
export async function requestPlanOnline(lang: string, input: { planId: string; months: number; method: string }): Promise<ActionState> {
  let url: string | null = null;
  const state = await safeAction("plans/online", async (): Promise<ActionState> => {
    const locale = asLocale(lang);
    const { shop, user } = await requireSection(locale, "plans");
    if (!onlinePlanMethods().includes(input.method as never)) return { ok: false, error: "paymentMethod" };
    const [plan] = await db.select().from(schema.plans).where(and(eq(schema.plans.id, String(input.planId)), eq(schema.plans.isActive, true)));
    if (!plan || plan.code === FREE_PLAN || plan.priceMonthly <= 0) return { ok: false, error: "invalid" };
    const months = Number(input.months);
    if (!((plan.orderPack ? PACKS : PERIODS) as readonly number[]).includes(months)) return { ok: false, error: "invalid" };
    if (await pendingRequest(shop.id)) return { ok: false, error: "requestPending" };
    const gross = planAmount(plan, months);
    const { discount, voucherId } = await referralDiscount(shop.id, plan, gross);
    const id = newId();
    await db.insert(schema.planRequests).values({ id, shopId: shop.id, planId: plan.id, months, amount: gross - discount, discount, voucherId, method: "online", requestedBy: user.id });
    const back = `${(process.env.APP_URL ?? "").replace(/\/+$/, "")}${sectionHref(locale, "plans")}?request=${id}`;
    const started = await startPlanPayment(input.method, { id, amount: gross - discount, label: `${plan.name} × ${months}` }, back, locale);
    if (!started.ok) {
      await db.update(schema.planRequests).set({ status: "cancelled", decidedAt: new Date() }).where(eq(schema.planRequests.id, id));
      return { ok: false, error: "paymentFailed" };
    }
    url = started.url;
    return { ok: true };
  });
  if (state.ok && url) redirect(url);
  return state;
}
