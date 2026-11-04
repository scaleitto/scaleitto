"use server";

import { and, eq, isNull, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { requireSection } from "@/server/auth/context";
import { safeAction } from "@/server/errors";
import { asLocale } from "@/i18n";
import { locales } from "@/i18n/config";
import { fieldErrorsFrom } from "@/lib/validation";
import { isValidDzPhone, normalizePhone } from "@/lib/phone";
import type { ActionState } from "@/lib/action";
import { shopSlugSchema } from "@/features/auth/validators";
import { checkDomain, newDomainToken, normalizeDomain, planAllowsDomain } from "./domain";
import { fieldRules, resolveForm } from "@/features/landing/types";
import { MAX_ORIGINS, cleanOrigin } from "@/features/storefront/api";
import { cleanScopes } from "@/features/mcp/scopes";
import { createToken } from "@/features/mcp/tokens";

const shopOf = async (lang: string) => (await requireSection(asLocale(lang), "settings")).shop;

// A social profile written as a username or a full link → the https link (empty stays empty)
const profile = (base: string, host: RegExp) =>
  z
    .string()
    .trim()
    .max(200)
    .optional()
    .default("")
    .transform((v) => {
      const clean = v.replace(/^@/, "");
      if (!clean) return "";
      if (/^https?:\/\//i.test(clean)) return clean.replace(/^http:/i, "https:");
      if (host.test(clean.split("/")[0])) return `https://${clean}`;
      return `${base}${clean}`;
    })
    .refine((v) => {
      if (!v) return true;
      try {
        return host.test(new URL(v).hostname.replace(/^www\./, ""));
      } catch {
        return false;
      }
    }, "e:socialLink");

const generalSchema = z.object({
  name: z.string().trim().min(2, "e:tooShort").max(120, "e:invalid"),
  description: z.string().trim().max(1000, "e:tooLong").optional().default(""),
  location: z.string().trim().max(160, "e:tooLong").optional().default(""),
  instagram: profile("https://instagram.com/", /^instagram\.com$/i),
  tiktok: profile("https://tiktok.com/@", /^tiktok\.com$/i),
  facebook: profile("https://facebook.com/", /^(facebook\.com|fb\.com)$/i),
  telegram: profile("https://t.me/", /^(t\.me|telegram\.me)$/i),
  phone: z
    .string()
    .trim()
    .transform((v) => (v ? normalizePhone(v) : ""))
    .refine((v) => !v || isValidDzPhone(v), "e:phone"),
});
const raw = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

// Store settings → General (Zimam): name, description, location, social profiles, phone. The description, location and
// profiles are the store footer's (the same as Store Design → Footer).
export async function saveGeneral(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("settings/general", async () => {
    const shop = await shopOf(lang);
    const parsed = generalSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const d = parsed.data;
    const design = raw(shop.design);
    const socials = { ...raw(design.socials), instagram: d.instagram, tiktok: d.tiktok, facebook: d.facebook, telegram: d.telegram };
    await db
      .update(schema.shops)
      .set({ name: d.name, phone: d.phone || null, design: { ...design, about: d.description, location: d.location, socials } })
      .where(eq(schema.shops.id, shop.id));
    refresh();
    return { ok: true };
  });
}

// Store settings → Domain: the store's link on the platform
export async function saveSlug(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("settings/slug", async () => {
    const shop = await shopOf(lang);
    const parsed = z.object({ slug: shopSlugSchema }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const slug = parsed.data.slug;
    if (slug !== shop.slug && (await db.$count(schema.shops, and(eq(schema.shops.slug, slug), ne(schema.shops.id, shop.id)))) > 0) {
      return { ok: false, error: "checkFields", fieldErrors: { slug: "slugTaken" } };
    }
    await db.update(schema.shops).set({ slug }).where(eq(schema.shops.id, shop.id));
    refresh();
    return { ok: true };
  });
}

// Store settings → Language: saved as soon as it is chosen
export async function saveStoreLanguage(lang: string, locale: string): Promise<ActionState> {
  return safeAction("settings/language", async () => {
    const shop = await shopOf(lang);
    if (!(locales as readonly string[]).includes(locale)) return { ok: false, error: "invalid" };
    await db.update(schema.shops).set({ defaultLocale: locale }).where(eq(schema.shops.id, shop.id));
    refresh();
    return { ok: true };
  });
}

const rule = z.enum(fieldRules);
const checkoutSchema = z.object({ name: rule, commune: rule, address: rule, wilaya: z.enum(["optional", "required"]), delivery: z.enum(["hidden", "optional"]) });

// Store settings → Checkout: what the buyer is asked (phone and wilaya are always required)
export async function saveCheckoutFields(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("settings/checkout", async () => {
    const shop = await shopOf(lang);
    const parsed = checkoutSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const d = parsed.data;
    const form = resolveForm(shop.orderForm);
    // Hidden delivery type: always the store's preferred one (home unless the store chose desks)
    const delivery = d.delivery === "optional" ? "both" : form.delivery === "both" ? form.preferDelivery : form.delivery;
    await db
      .update(schema.shops)
      .set({ orderForm: { ...raw(shop.orderForm), name: d.name, commune: d.commune, address: d.address, wilaya: d.wilaya, delivery } })
      .where(eq(schema.shops.id, shop.id));
    refresh();
    return { ok: true };
  });
}

// Store settings → Product page: options always as buttons
export async function saveOptionButtons(lang: string, on: boolean): Promise<ActionState> {
  return safeAction("settings/product-page", async () => {
    const shop = await shopOf(lang);
    await db.update(schema.shops).set({ orderForm: { ...raw(shop.orderForm), optionButtons: on === true } }).where(eq(schema.shops.id, shop.id));
    refresh();
    return { ok: true };
  });
}

// Sets (or replaces) the shop's domain: a new ownership token, verification needed again.
export async function setDomain(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("settings/domain", async () => {
    const shop = await shopOf(lang);
    if (!(await planAllowsDomain(shop.id))) return { ok: false, error: "domainPlan" };
    const domain = normalizeDomain(String(formData.get("domain") ?? ""));
    if (!domain) return { ok: false, error: "checkFields", fieldErrors: { domain: "domain" } };
    if ((await db.$count(schema.shops, and(eq(schema.shops.customDomain, domain), ne(schema.shops.id, shop.id)))) > 0) {
      return { ok: false, error: "checkFields", fieldErrors: { domain: "domainTaken" } };
    }
    if (domain !== shop.customDomain) {
      await db.update(schema.shops).set({ customDomain: domain, domainToken: newDomainToken(), domainVerifiedAt: null }).where(eq(schema.shops.id, shop.id));
    }
    refresh();
    return { ok: true };
  });
}

// Looks up the DNS records; the domain is served once both are right. The answer says what is missing.
export async function verifyDomain(lang: string): Promise<ActionState & { owned?: boolean; pointed?: boolean }> {
  const result = await safeAction("settings/verify-domain", async () => {
    const shop = await shopOf(lang);
    if (!shop.customDomain || !shop.domainToken) return { ok: false, error: "notFound" };
    if (!(await planAllowsDomain(shop.id))) return { ok: false, error: "domainPlan" };
    const check = await checkDomain(shop.customDomain, shop.domainToken);
    if (check.owned && check.pointed) {
      await db.update(schema.shops).set({ domainVerifiedAt: new Date() }).where(eq(schema.shops.id, shop.id));
      refresh();
      return { ok: true };
    }
    return { ok: false, error: !check.owned ? "domainTxt" : "domainPointing", message: [...check.found.cname, ...check.found.a].join(", ") || undefined };
  });
  return result;
}

export async function removeDomain(lang: string): Promise<ActionState> {
  return safeAction("settings/remove-domain", async () => {
    const shop = await shopOf(lang);
    await db.update(schema.shops).set({ customDomain: null, domainToken: null, domainVerifiedAt: null }).where(eq(schema.shops.id, shop.id));
    refresh();
    return { ok: true };
  });
}

// Store settings → Domain → Allowed origins (the public store API, features/storefront/api.ts)
export async function saveOrigins(lang: string, origins: string[]): Promise<ActionState> {
  return safeAction("settings/origins", async () => {
    const shop = await shopOf(lang);
    const list = (Array.isArray(origins) ? origins : []).map((o) => String(o ?? "")).filter((o) => o.trim());
    if (list.length > MAX_ORIGINS) return { ok: false, error: "tooMany" };
    const clean = list.map(cleanOrigin);
    const bad = clean.findIndex((o) => !o);
    if (bad >= 0) return { ok: false, error: "checkFields", fieldErrors: { [`origin.${bad}`]: "origin" } };
    await db.update(schema.shops).set({ apiOrigins: [...new Set(clean as string[])] }).where(eq(schema.shops.id, shop.id));
    return { ok: true };
  });
}

// Store settings → MCP: a new access token for an AI assistant (shown once). The owner must accept that customer data
// goes to their own AI provider.
export async function createMcpToken(lang: string, input: { name: string; scopes: string[]; consent: boolean }): Promise<ActionState & { token?: string }> {
  const result: { token?: string } = {};
  const state = await safeAction("settings/mcp-create", async (): Promise<ActionState> => {
    const { shop, user } = await requireSection(asLocale(lang), "settings");
    const name = String(input.name ?? "").trim();
    const scopes = cleanScopes(input.scopes);
    if (!name) return { ok: false, error: "checkFields", fieldErrors: { name: "required" } };
    if (!scopes.length) return { ok: false, error: "checkFields", fieldErrors: { scopes: "required" } };
    if (input.consent !== true) return { ok: false, error: "checkFields", fieldErrors: { consent: "required" } };
    result.token = await createToken(shop.id, user.id, name, scopes);
    refresh();
    return { ok: true };
  });
  return { ...state, ...result };
}

export async function revokeMcpToken(lang: string, id: string): Promise<ActionState> {
  return safeAction("settings/mcp-revoke", async () => {
    const shop = await shopOf(lang);
    await db.update(schema.mcpTokens).set({ revokedAt: new Date() }).where(and(eq(schema.mcpTokens.shopId, shop.id), eq(schema.mcpTokens.id, id), isNull(schema.mcpTokens.revokedAt)));
    refresh();
    return { ok: true };
  });
}

// Revoking a connected app signs it out everywhere: every token it used
export async function revokeMcpClient(lang: string, client: string): Promise<ActionState> {
  return safeAction("settings/mcp-revoke-client", async () => {
    const shop = await shopOf(lang);
    await db.update(schema.mcpTokens).set({ revokedAt: new Date() }).where(and(eq(schema.mcpTokens.shopId, shop.id), eq(schema.mcpTokens.client, String(client).slice(0, 120)), isNull(schema.mcpTokens.revokedAt)));
    refresh();
    return { ok: true };
  });
}
