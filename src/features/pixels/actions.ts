"use server";

import { and, eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, schema } from "@/server/db";
import { newId, requireSection } from "@/server/auth/context";
import { encryptJson } from "@/server/crypto";
import { safeAction } from "@/server/errors";
import { asLocale } from "@/i18n";
import { fieldErrorsFrom } from "@/lib/validation";
import type { ActionState } from "@/lib/action";
import { serverPlatforms } from "./ids";
import { testPixel } from "./server";
import { parsePixel } from "./validators";

const shopOf = async (lang: string) => (await requireSection(asLocale(lang), "pixels")).shop;

async function pixelOf(shopId: string, id: string) {
  const [p] = await db.select().from(schema.pixels).where(and(eq(schema.pixels.shopId, shopId), eq(schema.pixels.id, id)));
  return p ?? null;
}

// Creates (id null) or updates a pixel. An empty secret field keeps the saved one.
export async function savePixel(lang: string, id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("pixels/save", async () => {
    const shop = await shopOf(lang);
    const parsed = parsePixel(formData);
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const d = parsed.data;
    const existing = id ? await pixelOf(shop.id, id) : null;
    if (id && !existing) return { ok: false, error: "notFound" };
    // Only the shop's own products can be chosen
    const productIds = d.scope === "products" ? (await db.select({ id: schema.products.id }).from(schema.products).where(and(eq(schema.products.shopId, shop.id), inArray(schema.products.id, d.productIds)))).map((p) => p.id) : null;
    if (productIds && !productIds.length) return { ok: false, error: "checkFields", fieldErrors: { productIds: "pixelProducts" } };
    const hasServer = serverPlatforms.includes(d.platform);
    const secret = !hasServer || d.clearSecret ? null : d.secret ? encryptJson(d.secret) : (existing?.secret ?? null);
    const values = { platform: d.platform, name: d.name, tagId: d.tagId, secret, testCode: hasServer && d.platform !== "ga4" ? d.testCode || null : null, purchaseOn: d.purchaseOn, productIds };
    if (existing) await db.update(schema.pixels).set(values).where(eq(schema.pixels.id, existing.id));
    else await db.insert(schema.pixels).values({ id: newId(), shopId: shop.id, ...values });
    refresh();
    return { ok: true };
  });
}

export async function setPixelActive(lang: string, id: string, active: boolean): Promise<ActionState> {
  return safeAction("pixels/active", async () => {
    const shop = await shopOf(lang);
    await db.update(schema.pixels).set({ active }).where(and(eq(schema.pixels.shopId, shop.id), eq(schema.pixels.id, id)));
    refresh();
    return { ok: true };
  });
}

export async function deletePixel(lang: string, id: string): Promise<ActionState> {
  return safeAction("pixels/delete", async () => {
    const shop = await shopOf(lang);
    await db.delete(schema.pixelEvents).where(and(eq(schema.pixelEvents.shopId, shop.id), eq(schema.pixelEvents.pixelId, id)));
    await db.delete(schema.pixels).where(and(eq(schema.pixels.shopId, shop.id), eq(schema.pixels.id, id)));
    refresh();
    return { ok: true };
  });
}

// Sends a test event from the server; the platform's answer is shown as is.
export async function sendTestEvent(lang: string, id: string): Promise<ActionState> {
  return safeAction("pixels/test", async () => {
    const shop = await shopOf(lang);
    const pixel = await pixelOf(shop.id, id);
    if (!pixel) return { ok: false, error: "notFound" };
    if (!pixel.secret) return { ok: false, error: "pixelNoSecret" };
    const r = await testPixel(pixel);
    refresh();
    if (r.needsTestCode) return { ok: false, error: "pixelNeedsTestCode" };
    return r.ok ? { ok: true, message: r.detail } : { ok: false, error: "pixelTestFailed", message: r.detail };
  });
}
