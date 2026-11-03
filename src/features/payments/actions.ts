"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, schema } from "@/server/db";
import { newId, requireSection } from "@/server/auth/context";
import { encryptJson } from "@/server/crypto";
import { safeAction } from "@/server/errors";
import { asLocale } from "@/i18n";
import type { ActionState } from "@/lib/action";
import { clients } from "./connectors";
import { connectorOf, isOnlineMethod } from "./methods";
import { paymentMethods, type MethodSettings } from "./flow";

const shopOf = async (lang: string) => (await requireSection(asLocale(lang), "apps")).shop;
const text = (fd: FormData, name: string) => String(fd.get(name) ?? "").trim();

// "Save and test": a method is kept (and offered to buyers) only once its connector accepts the keys. A secret left
// empty keeps the one saved before.
export async function savePaymentMethod(lang: string, method: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("payments/save", async () => {
    const shop = await shopOf(lang);
    if (!isOnlineMethod(method)) return { ok: false, error: "invalid" };
    const connector = connectorOf(method, text(formData, "connector"));
    const client = connector ? clients[connector.id] : undefined;
    if (!connector || !connector.ready || !client) return { ok: false, error: "paymentUnavailable" };
    const before = (await paymentMethods(shop.id)).find((r) => r.method === method && r.connector === connector.id);
    const keys: Record<string, string> = {};
    const fieldErrors: Record<string, string> = {};
    for (const f of connector.fields) {
      const value = text(formData, f.key) || (f.secret ? (before?.settings.keys[f.key] ?? "") : "");
      if (!f.pattern.test(value)) fieldErrors[f.key] = "paymentKey";
      keys[f.key] = value;
    }
    const currency = connector.currencies.find((c) => c === text(formData, "currency")) ?? connector.currencies[0];
    const rate = currency === "dzd" ? 1 : Number(text(formData, "rate").replace(",", "."));
    if (currency !== "dzd" && !(rate >= 1 && rate <= 100_000)) fieldErrors.rate = "paymentRate";
    if (Object.keys(fieldErrors).length) return { ok: false, error: "checkFields", fieldErrors };
    const mode = text(formData, "mode") === "live" ? "live" : "test";
    const tested = await client.test(keys, mode);
    if (!tested.ok) return { ok: false, error: "paymentTest", message: tested.detail };
    const settings: MethodSettings = { keys, currency, rate };
    const values = { connector: connector.id, credentials: encryptJson(settings), mode: mode as "test" | "live", active: true, checkedAt: new Date() };
    const [existing] = await db.select({ id: schema.shopPaymentMethods.id }).from(schema.shopPaymentMethods).where(and(eq(schema.shopPaymentMethods.shopId, shop.id), eq(schema.shopPaymentMethods.method, method)));
    if (existing) await db.update(schema.shopPaymentMethods).set(values).where(eq(schema.shopPaymentMethods.id, existing.id));
    else await db.insert(schema.shopPaymentMethods).values({ id: newId(), shopId: shop.id, method, ...values });
    refresh();
    return { ok: true };
  });
}

export async function removePaymentMethod(lang: string, method: string): Promise<ActionState> {
  return safeAction("payments/remove", async () => {
    const shop = await shopOf(lang);
    await db.delete(schema.shopPaymentMethods).where(and(eq(schema.shopPaymentMethods.shopId, shop.id), eq(schema.shopPaymentMethods.method, method)));
    refresh();
    return { ok: true };
  });
}
