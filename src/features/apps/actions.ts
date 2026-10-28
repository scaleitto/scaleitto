"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { newId, requireSection } from "@/server/auth/context";
import { encryptJson } from "@/server/crypto";
import { logError, safeAction } from "@/server/errors";
import { canAdd } from "@/server/limits";
import { asLocale } from "@/i18n";
import type { ActionState } from "@/lib/action";
import type { AppKey } from "@/server/db/schema";
import { OLD_SCRIPT, backfillSheet, testApp } from "./sync";
import { createImportedProduct, fetchShopify, fetchYoucan, ImportError } from "./importer";
import type { CatalogProduct } from "./catalog";

const shopOf = async (lang: string) => (await requireSection(asLocale(lang), "apps")).shop;
const appKey = z.enum(["google_sheets", "webhook"]);

async function appOf(shopId: string, app: AppKey) {
  const [row] = await db.select().from(schema.shopApps).where(and(eq(schema.shopApps.shopId, shopId), eq(schema.shopApps.app, app)));
  return row ?? null;
}

// First step of a connection: creates the app with its secret (shown in the script / for signatures), not active yet.
export async function startApp(lang: string, app: AppKey): Promise<ActionState> {
  return safeAction("apps/start", async () => {
    const shop = await shopOf(lang);
    const key = appKey.parse(app);
    if (!(await appOf(shop.id, key))) {
      await db.insert(schema.shopApps).values({ id: newId(), shopId: shop.id, app: key, url: "", secret: encryptJson(randomBytes(24).toString("base64url")), active: false });
    }
    refresh();
    return { ok: true };
  });
}

// The Apps Script web app URL must be Google's; tests point it at a local fake server.
function validUrl(app: AppKey, raw: string) {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const fake = process.env.E2E_APPS_URL;
  if (fake && url.toString().startsWith(fake)) return url.toString();
  if (url.protocol !== "https:") return null;
  if (app === "google_sheets" && !(url.hostname === "script.google.com" && /^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname))) return null;
  return url.toString();
}

// Saves the URL, turns the app on and tests it right away (the answer is shown to the merchant).
export async function saveAppUrl(lang: string, app: AppKey, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("apps/url", async () => {
    const shop = await shopOf(lang);
    const key = appKey.parse(app);
    const row = await appOf(shop.id, key);
    if (!row) return { ok: false, error: "notFound" };
    const url = validUrl(key, String(formData.get("url") ?? ""));
    if (!url) return { ok: false, error: "checkFields", fieldErrors: { url: key === "google_sheets" ? "sheetsUrl" : "webhookUrl" } };
    await db.update(schema.shopApps).set({ url, active: true }).where(eq(schema.shopApps.id, row.id));
    const r = await testApp({ ...row, url, active: true });
    refresh();
    return testResult(r);
  });
}

const testResult = (r: { ok: boolean; detail: string }): ActionState =>
  r.ok ? { ok: true, message: r.detail } : r.detail === OLD_SCRIPT ? { ok: false, error: "sheetsOldScript" } : { ok: false, error: "appTestFailed", message: r.detail };

export async function testAppAction(lang: string, app: AppKey): Promise<ActionState> {
  return safeAction("apps/test", async () => {
    const shop = await shopOf(lang);
    const row = await appOf(shop.id, appKey.parse(app));
    if (!row?.url) return { ok: false, error: "notFound" };
    const r = await testApp(row);
    refresh();
    return testResult(r);
  });
}

// Sends the last 30 days of orders to the sheet
export async function backfillAction(lang: string): Promise<ActionState> {
  return safeAction("apps/backfill", async () => {
    const shop = await shopOf(lang);
    const row = await appOf(shop.id, "google_sheets");
    if (!row?.url) return { ok: false, error: "notFound" };
    const r = await backfillSheet(row);
    refresh();
    return r.ok ? { ok: true, message: r.detail } : { ok: false, error: "appTestFailed", message: r.detail };
  });
}

export async function setAppActive(lang: string, app: AppKey, active: boolean): Promise<ActionState> {
  return safeAction("apps/active", async () => {
    const shop = await shopOf(lang);
    await db.update(schema.shopApps).set({ active }).where(and(eq(schema.shopApps.shopId, shop.id), eq(schema.shopApps.app, appKey.parse(app))));
    refresh();
    return { ok: true };
  });
}

export async function disconnectApp(lang: string, app: AppKey): Promise<ActionState> {
  return safeAction("apps/disconnect", async () => {
    const shop = await shopOf(lang);
    await db.delete(schema.shopApps).where(and(eq(schema.shopApps.shopId, shop.id), eq(schema.shopApps.app, appKey.parse(app))));
    refresh();
    return { ok: true };
  });
}

// ─── Product import ─────────────────────────────────────

export type CatalogResult = { ok: true; products: CatalogProduct[]; existing: string[] } | { ok: false; error: string; message?: string };

// Reads the other store's catalog; the merchant then picks what to import.
export async function fetchCatalog(lang: string, source: "shopify" | "youcan", input: string): Promise<CatalogResult> {
  // Outside the try: a redirect (no access) must not be caught
  const shop = await shopOf(lang);
  try {
    if (!input.trim()) return { ok: false, error: source === "shopify" ? "shopifyUrl" : "youcanToken" };
    const products = source === "shopify" ? await fetchShopify(input) : await fetchYoucan(input);
    if (!products.length) return { ok: false, error: "importEmpty" };
    const existing = (await db.select({ ref: schema.products.externalRef }).from(schema.products).where(eq(schema.products.shopId, shop.id))).map((r) => r.ref).filter((r): r is string => !!r);
    return { ok: true, products, existing: products.map((p) => p.ref).filter((ref) => existing.includes(ref)) };
  } catch (err) {
    if (err instanceof ImportError) return { ok: false, error: err.message === "token" ? "youcanTokenInvalid" : "importFailed", message: err.message === "token" ? undefined : err.message };
    await logError("apps/catalog", err);
    return { ok: false, error: "unexpected" };
  }
}

const productSchema = z.object({
  ref: z.string().min(3).max(191),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(20_000),
  price: z.number().int().min(1).max(100_000_000),
  compareAtPrice: z.number().int().min(1).max(100_000_000).nullable(),
  images: z.array(z.string().url().max(2000)).max(10),
  options: z.array(z.object({ name: z.string().min(1).max(40), values: z.array(z.string().min(1).max(40)).min(1).max(30) })).max(3),
  variants: z.array(z.object({ values: z.record(z.string(), z.string()), price: z.number().int().min(0).nullable(), compareAtPrice: z.number().int().nullable(), sku: z.string().max(80).nullable() })).max(100),
});

// One product per call: the browser imports the chosen products one by one and shows the progress.
export async function importCatalogProduct(lang: string, product: CatalogProduct): Promise<ActionState> {
  return safeAction("apps/import", async () => {
    const shop = await shopOf(lang);
    const parsed = productSchema.safeParse(product);
    if (!parsed.success || !/^(shopify|youcan):/.test(parsed.data.ref)) return { ok: false, error: "invalid" };
    if (!(await canAdd(shop.id, "maxProducts"))) return { ok: false, error: "limitProducts" };
    const result = await createImportedProduct(shop.id, parsed.data);
    if (result === "created") refresh();
    return { ok: true, message: result };
  });
}
