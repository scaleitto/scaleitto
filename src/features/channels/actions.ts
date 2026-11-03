"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { newId, requireSection } from "@/server/auth/context";
import { encryptJson } from "@/server/crypto";
import { safeAction } from "@/server/errors";
import { asLocale } from "@/i18n";
import { fieldErrorsFrom } from "@/lib/validation";
import type { ActionState } from "@/lib/action";
import type { ChannelKind } from "@/server/db/schema";
import { redirect } from "next/navigation";
import { sectionHref } from "@/lib/permissions";
import { shopifySetup, wooAuthorizeUrl } from "./platforms";
import { requiredSheetFields, sheetFields, splitHeaders, type SheetImport } from "./sheets";

const guard = (lang: string) => requireSection(asLocale(lang), "channels");

// Shopify (Zimam): the store's *.myshopify.com address, the custom app's Admin API access token and its API secret key; the
// token is checked and the "orders/create" webhook created on the spot. WooCommerce: the store's https address, then the
// merchant approves our app on their store (wooAuthorizeUrl) and the callback finishes the setup (/api/channels/woo-auth).
const shopifySchema = z.object({
  storeUrl: z.string().trim().toLowerCase().transform((v) => v.replace(/^https?:\/\//, "").replace(/\/.*$/, "")).refine((v) => /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(v), "e:shopifyDomain"),
  token: z.string().trim().min(20, "e:tooShort").max(200, "e:invalid"),
  secret: z.string().trim().min(16, "e:tooShort").max(200, "e:invalid"),
});
// https only (the automated tests' fake store is the one exception)
const storeAddress = (v: string) => /^https:\/\/[^\s/]+\.[^\s/]+/.test(v) || Boolean(process.env.E2E_APPS_URL && v.startsWith(`${process.env.E2E_APPS_URL}/`));
const wooSchema = z.object({
  storeUrl: z.string().trim().max(255).refine(storeAddress, "e:httpsUrl").transform((v) => v.replace(/\/+$/, "")),
});
const appUrl = () => (process.env.APP_URL ?? "").replace(/\/$/, "");

async function upsertChannel(shopId: string, kind: ChannelKind, values: { storeUrl: string; secret: Record<string, string>; settings: Record<string, unknown> }) {
  const [existing] = await db.select({ id: schema.shopChannels.id, token: schema.shopChannels.token }).from(schema.shopChannels).where(and(eq(schema.shopChannels.shopId, shopId), eq(schema.shopChannels.kind, kind)));
  const row = { storeUrl: values.storeUrl, secret: encryptJson(values.secret), settings: values.settings, active: true };
  if (existing) {
    await db.update(schema.shopChannels).set(row).where(eq(schema.shopChannels.id, existing.id));
    return existing.token;
  }
  const token = randomBytes(18).toString("base64url");
  await db.insert(schema.shopChannels).values({ id: newId(), shopId, kind, token, ...row });
  return token;
}

export async function connectChannel(lang: string, kind: ChannelKind, _prev: ActionState, formData: FormData): Promise<ActionState> {
  let target: string | null = null;
  const result = await safeAction("channels/connect", async (): Promise<ActionState> => {
    const { shop } = await guard(lang);
    if (kind !== "shopify" && kind !== "woocommerce") return { ok: false, error: "invalid" };
    const raw = Object.fromEntries(formData);
    if (kind === "shopify") {
      const parsed = shopifySchema.safeParse(raw);
      if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
      const { storeUrl, token, secret } = parsed.data;
      // The receiving address exists before Shopify is asked to call it
      const channelToken = await upsertChannel(shop.id, kind, { storeUrl, secret: { secret, token }, settings: { pending: true } });
      const setup = await shopifySetup(storeUrl, token, `${appUrl()}/api/channels/${channelToken}`);
      if (!setup.ok) {
        await db.delete(schema.shopChannels).where(and(eq(schema.shopChannels.shopId, shop.id), eq(schema.shopChannels.kind, kind)));
        return { ok: false, error: "platformRefused", message: setup.detail };
      }
      await db.update(schema.shopChannels).set({ settings: { webhookId: setup.webhookId } }).where(and(eq(schema.shopChannels.shopId, shop.id), eq(schema.shopChannels.kind, kind)));
      refresh();
      return { ok: true };
    }
    const parsed = wooSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const channelToken = await upsertChannel(shop.id, kind, { storeUrl: parsed.data.storeUrl, secret: { secret: randomBytes(24).toString("base64url") }, settings: { pending: true } });
    target = wooAuthorizeUrl(parsed.data.storeUrl, channelToken, `${appUrl()}${sectionHref(asLocale(lang), "channels")}/woocommerce`, `${appUrl()}/api/channels/woo-auth`);
    return { ok: true };
  });
  if (target) redirect(target);
  return result;
}

export async function setChannelActive(lang: string, kind: ChannelKind, active: boolean): Promise<ActionState> {
  return safeAction("channels/active", async () => {
    const { shop } = await guard(lang);
    await db.update(schema.shopChannels).set({ active }).where(and(eq(schema.shopChannels.shopId, shop.id), eq(schema.shopChannels.kind, kind)));
    refresh();
    return { ok: true };
  });
}

export async function disconnectChannel(lang: string, kind: ChannelKind): Promise<ActionState> {
  return safeAction("channels/disconnect", async () => {
    const { shop } = await guard(lang);
    await db.delete(schema.shopChannels).where(and(eq(schema.shopChannels.shopId, shop.id), eq(schema.shopChannels.kind, kind)));
    refresh();
    return { ok: true };
  });
}

// Only Google's script addresses (and the fake server of the automated tests) receive the order statuses
function validScriptUrl(url: string) {
  if (/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) return true;
  const fake = process.env.E2E_APPS_URL;
  return Boolean(fake && url.startsWith(`${fake}/`));
}

// Google Sheets → Import orders: the sheet's header row, which column holds each field, and the deployed script address
// (for the statuses). The receiving address and the secret are made on the first save.
export async function saveSheetImport(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("channels/sheets", async () => {
    const { shop } = await guard(lang);
    const headers = splitHeaders(String(formData.get("headers") ?? ""));
    if (headers.length < 2) return { ok: false, error: "checkFields", fieldErrors: { headers: "sheetHeaders" } };
    const fieldErrors: Record<string, string> = {};
    const columns = Object.fromEntries(
      sheetFields.map((f) => {
        const raw = String(formData.get(`col_${f}`) ?? "");
        const n = raw === "" ? null : Number(raw);
        const value = n !== null && Number.isInteger(n) && n >= 0 && n < headers.length ? n : null;
        if (value === null && requiredSheetFields.includes(f)) fieldErrors[`col_${f}`] = "required";
        return [f, value];
      }),
    ) as SheetImport["columns"];
    const scriptUrl = String(formData.get("scriptUrl") ?? "").trim() || null;
    if (scriptUrl && !validScriptUrl(scriptUrl)) fieldErrors.scriptUrl = "scriptUrl";
    if (Object.keys(fieldErrors).length) return { ok: false, error: "checkFields", fieldErrors };
    const settings: SheetImport = { headers, columns, scriptUrl };
    const [existing] = await db.select({ id: schema.shopChannels.id }).from(schema.shopChannels).where(and(eq(schema.shopChannels.shopId, shop.id), eq(schema.shopChannels.kind, "google_sheets")));
    if (existing) await db.update(schema.shopChannels).set({ settings, active: true }).where(eq(schema.shopChannels.id, existing.id));
    else
      await db.insert(schema.shopChannels).values({
        id: newId(),
        shopId: shop.id,
        kind: "google_sheets",
        token: randomBytes(18).toString("base64url"),
        secret: encryptJson({ secret: randomBytes(24).toString("base64url") }),
        settings,
      });
    refresh();
    return { ok: true };
  });
}
