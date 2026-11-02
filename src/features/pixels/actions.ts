"use server";

import { and, eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, schema } from "@/server/db";
import { newId, requireSection } from "@/server/auth/context";
import { encryptJson } from "@/server/crypto";
import { safeAction } from "@/server/errors";
import { asLocale } from "@/i18n";
import type { ActionState } from "@/lib/action";
import { pixelPlatforms, type PixelPlatform } from "@/server/db/schema";
import { serverPlatforms } from "./ids";
import { testPixel } from "./server";
import { parseAccounts } from "./validators";

const shopOf = async (lang: string) => (await requireSection(asLocale(lang), "pixels")).shop;

// Saves one app page: every ad account of the platform. Accounts removed from the page are deleted with their log.
export async function savePlatformPixels(lang: string, platform: PixelPlatform, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("pixels/save", async () => {
    const shop = await shopOf(lang);
    if (!pixelPlatforms.includes(platform)) return { ok: false, error: "notFound" };
    const parsed = parseAccounts(platform, formData.get("accounts"));
    if (!parsed.ok) return { ok: false, error: "checkFields", fieldErrors: parsed.fieldErrors };
    const existing = await db.select().from(schema.pixels).where(and(eq(schema.pixels.shopId, shop.id), eq(schema.pixels.platform, platform)));
    const byId = new Map(existing.map((p) => [p.id, p]));
    // Only the shop's own products can be chosen
    const wanted = [...new Set(parsed.accounts.flatMap((a) => a.productIds ?? []))];
    const own = new Set(wanted.length ? (await db.select({ id: schema.products.id }).from(schema.products).where(and(eq(schema.products.shopId, shop.id), inArray(schema.products.id, wanted)))).map((p) => p.id) : []);
    const hasServer = serverPlatforms.includes(platform);
    const kept: string[] = [];
    for (const [i, a] of parsed.accounts.entries()) {
      const row = a.id ? byId.get(a.id) : undefined;
      if (a.id && !row) return { ok: false, error: "notFound" };
      const productIds = a.productIds ? a.productIds.filter((id) => own.has(id)) : null;
      if (productIds && !productIds.length) return { ok: false, error: "checkFields", fieldErrors: { [`productIds.${i}`]: "pixelProducts" } };
      const secret = !hasServer || a.clearSecret ? null : a.secret ? encryptJson(a.secret) : (row?.secret ?? null);
      const values = { name: a.name, tagId: a.tagId, secret, testCode: hasServer && platform !== "ga4" ? a.testCode || null : null, purchaseOn: a.purchaseOn, productIds, active: a.active };
      if (row) {
        await db.update(schema.pixels).set(values).where(eq(schema.pixels.id, row.id));
        kept.push(row.id);
      } else {
        const id = newId();
        await db.insert(schema.pixels).values({ id, shopId: shop.id, platform, ...values });
        kept.push(id);
      }
    }
    const gone = existing.filter((p) => !kept.includes(p.id)).map((p) => p.id);
    if (gone.length) {
      await db.delete(schema.pixelEvents).where(and(eq(schema.pixelEvents.shopId, shop.id), inArray(schema.pixelEvents.pixelId, gone)));
      await db.delete(schema.pixels).where(and(eq(schema.pixels.shopId, shop.id), inArray(schema.pixels.id, gone)));
    }
    refresh();
    return { ok: true };
  });
}

// Sends a test event from the server; the platform's answer is shown as is.
export async function sendTestEvent(lang: string, id: string): Promise<ActionState> {
  return safeAction("pixels/test", async () => {
    const shop = await shopOf(lang);
    const [pixel] = await db.select().from(schema.pixels).where(and(eq(schema.pixels.shopId, shop.id), eq(schema.pixels.id, id)));
    if (!pixel) return { ok: false, error: "notFound" };
    if (!pixel.secret) return { ok: false, error: "pixelNoSecret" };
    const r = await testPixel(pixel);
    refresh();
    if (r.needsTestCode) return { ok: false, error: "pixelNeedsTestCode" };
    return r.ok ? { ok: true, message: r.detail } : { ok: false, error: "pixelTestFailed", message: r.detail };
  });
}
