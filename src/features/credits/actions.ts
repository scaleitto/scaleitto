"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { newId, requirePlatformAdmin, requireSection } from "@/server/auth/context";
import { safeAction } from "@/server/errors";
import { asLocale } from "@/i18n";
import type { ActionState } from "@/lib/action";
import { fieldErrorsFrom } from "@/lib/validation";
import { sectionHref } from "@/lib/permissions";
import { paymentMethods } from "@/lib/enums";
import { paymentDetails } from "@/features/plans/billing";
import { findPack } from "./packs";
import { approveCreditPurchase, platformMethod, startCreditPayment } from "./purchases";

// Online: one of the platform's own payment methods (server settings); the credits arrive when the buyer is back and
// the method's connector says the payment went through
export async function buyCreditsOnline(lang: string, packKey: string, method: string): Promise<ActionState> {
  const locale = asLocale(lang);
  let target: string | null = null;
  const result = await safeAction("credits/online", async () => {
    const { shop, user } = await requireSection(locale, "balance");
    const pack = findPack(packKey);
    const gateway = platformMethod(method);
    if (!pack) return { ok: false, error: "invalid" };
    if (!gateway) return { ok: false, error: "cardUnavailable" };
    const id = newId();
    await db.insert(schema.creditPurchases).values({ id, shopId: shop.id, pack: pack.key, credits: pack.credits, amount: pack.price, method: "card", requestedBy: user.id });
    const app = (process.env.APP_URL ?? "").replace(/\/$/, "");
    const started = await startCreditPayment(gateway, { id, amount: pack.price, credits: pack.credits }, `${app}${sectionHref(locale, "balance")}?purchase=${id}`, locale);
    if (!started.ok) {
      await db.delete(schema.creditPurchases).where(eq(schema.creditPurchases.id, id));
      return { ok: false, error: "paymentTest", message: started.detail };
    }
    target = started.url;
    return { ok: true };
  });
  if (target) redirect(target);
  return result;
}

const localSchema = z.object({
  pack: z.string(),
  method: z.enum(paymentMethods, { error: "e:paymentMethod" }),
  receiptUrl: z.string().trim().max(255),
  note: z.string().trim().max(500, "e:invalid"),
});

// Local payment: a transfer (with its receipt) or WhatsApp, approved by the platform admin
export async function requestCredits(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("credits/request", async () => {
    const { shop, user } = await requireSection(asLocale(lang), "balance");
    const parsed = localSchema.safeParse({ pack: formData.get("pack"), method: formData.get("method"), receiptUrl: formData.get("receiptUrl") ?? "", note: formData.get("note") ?? "" });
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const d = parsed.data;
    const pack = findPack(d.pack);
    if (!pack) return { ok: false, error: "invalid" };
    if (!paymentDetails().methods[d.method]) return { ok: false, error: "checkFields", fieldErrors: { method: "paymentMethod" } };
    if (d.method !== "whatsapp" && !d.receiptUrl.startsWith(`/uploads/${shop.id}/`)) return { ok: false, error: "checkFields", fieldErrors: { receiptUrl: "receipt" } };
    const [pending] = await db.select({ id: schema.creditPurchases.id }).from(schema.creditPurchases).where(and(eq(schema.creditPurchases.shopId, shop.id), eq(schema.creditPurchases.status, "pending"), eq(schema.creditPurchases.method, d.method)));
    if (pending) return { ok: false, error: "requestPending" };
    await db.insert(schema.creditPurchases).values({ id: newId(), shopId: shop.id, pack: pack.key, credits: pack.credits, amount: pack.price, method: d.method, receiptUrl: d.method === "whatsapp" ? null : d.receiptUrl, note: d.note || null, requestedBy: user.id });
    refresh();
    return { ok: true };
  });
}

export async function cancelCreditRequest(lang: string, id: string): Promise<ActionState> {
  return safeAction("credits/cancel", async () => {
    const { shop } = await requireSection(asLocale(lang), "balance");
    await db.delete(schema.creditPurchases).where(and(eq(schema.creditPurchases.shopId, shop.id), eq(schema.creditPurchases.id, id), eq(schema.creditPurchases.status, "pending")));
    refresh();
    return { ok: true };
  });
}

// Platform admin: approve (credits added once) or refuse a local payment
export async function decideCreditPurchase(lang: string, id: string, approve: boolean, note: string): Promise<ActionState> {
  return safeAction("credits/decide", async () => {
    await requirePlatformAdmin(asLocale(lang));
    if (approve) await approveCreditPurchase(id, note || null);
    else await db.update(schema.creditPurchases).set({ status: "rejected", adminNote: note.slice(0, 500) || null, decidedAt: new Date() }).where(and(eq(schema.creditPurchases.id, id), eq(schema.creditPurchases.status, "pending")));
    refresh();
    return { ok: true };
  });
}
