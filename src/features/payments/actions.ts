"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, schema } from "@/server/db";
import { newId, requireSection } from "@/server/auth/context";
import { encryptJson } from "@/server/crypto";
import { safeAction } from "@/server/errors";
import { asLocale } from "@/i18n";
import type { ActionState } from "@/lib/action";
import type { PaymentProvider } from "@/server/db/schema";
import { chargily, slickpay } from "./providers";

const shopOf = async (lang: string) => (await requireSection(asLocale(lang), "apps")).shop;
const text = (fd: FormData, name: string) => String(fd.get(name) ?? "").trim();

// "Save and test": the keys are kept only once the gateway accepts them
export async function savePaymentAccount(lang: string, provider: PaymentProvider, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("payments/save", async () => {
    const shop = await shopOf(lang);
    const mode = text(formData, "mode") === "live" ? "live" : "test";
    let keys: Record<string, string>;
    const fieldErrors: Record<string, string> = {};
    if (provider === "chargily") {
      const secretKey = text(formData, "secretKey");
      if (!/^(test|live)_sk_[A-Za-z0-9]{10,200}$/.test(secretKey)) fieldErrors.secretKey = "paymentKey";
      keys = { secretKey };
    } else if (provider === "slickpay") {
      const publicKey = text(formData, "publicKey");
      const contactId = text(formData, "contactId");
      if (!/^[\w|.-]{10,300}$/.test(publicKey)) fieldErrors.publicKey = "paymentKey";
      if (!/^[0-9a-f-]{36}$/i.test(contactId)) fieldErrors.contactId = "invalid";
      keys = { publicKey, contactId };
    } else return { ok: false, error: "invalid" };
    if (Object.keys(fieldErrors).length) return { ok: false, error: "checkFields", fieldErrors };
    const tested = provider === "chargily" ? await chargily.test({ secretKey: keys.secretKey }, mode) : await slickpay.test({ publicKey: keys.publicKey, contactId: keys.contactId }, mode);
    if (!tested.ok) return { ok: false, error: "paymentTest", message: tested.detail };
    const values = { credentials: encryptJson(keys), mode: mode as "test" | "live", feesOnBuyer: text(formData, "fees") === "buyer", active: true, checkedAt: new Date() };
    const [existing] = await db.select({ id: schema.shopPayments.id }).from(schema.shopPayments).where(and(eq(schema.shopPayments.shopId, shop.id), eq(schema.shopPayments.provider, provider)));
    if (existing) await db.update(schema.shopPayments).set(values).where(eq(schema.shopPayments.id, existing.id));
    else await db.insert(schema.shopPayments).values({ id: newId(), shopId: shop.id, provider, ...values });
    refresh();
    return { ok: true };
  });
}

export async function removePaymentAccount(lang: string, provider: PaymentProvider): Promise<ActionState> {
  return safeAction("payments/remove", async () => {
    const shop = await shopOf(lang);
    await db.delete(schema.shopPayments).where(and(eq(schema.shopPayments.shopId, shop.id), eq(schema.shopPayments.provider, provider)));
    refresh();
    return { ok: true };
  });
}
