"use server";

import { and, eq, ne } from "drizzle-orm";
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
import { policyKinds } from "@/lib/enums";
import { shopSlugSchema } from "@/features/auth/validators";
import { checkDomain, newDomainToken, normalizeDomain, planAllowsDomain } from "./domain";

const shopOf = async (lang: string) => (await requireSection(asLocale(lang), "settings")).shop;

const generalSchema = z.object({
  name: z.string().trim().min(2, "e:tooShort").max(120, "e:invalid"),
  phone: z
    .string()
    .trim()
    .transform((v) => (v ? normalizePhone(v) : ""))
    .refine((v) => !v || isValidDzPhone(v), "e:phone"),
  defaultLocale: z.enum(locales, { error: "e:invalid" }),
  slug: shopSlugSchema,
});

// Name, phone, store language and link
export async function saveGeneral(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("settings/general", async () => {
    const shop = await shopOf(lang);
    const parsed = generalSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const d = parsed.data;
    if (d.slug !== shop.slug && (await db.$count(schema.shops, and(eq(schema.shops.slug, d.slug), ne(schema.shops.id, shop.id)))) > 0) {
      return { ok: false, error: "checkFields", fieldErrors: { slug: "slugTaken" } };
    }
    await db.update(schema.shops).set({ name: d.name, phone: d.phone || null, defaultLocale: d.defaultLocale, slug: d.slug }).where(eq(schema.shops.id, shop.id));
    refresh();
    return { ok: true };
  });
}

const seoSchema = z.object({ title: z.string().trim().max(70, "e:invalid"), description: z.string().trim().max(160, "e:invalid") });

export async function saveSeo(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("settings/seo", async () => {
    const shop = await shopOf(lang);
    const parsed = seoSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    await db.update(schema.shops).set({ seo: { title: parsed.data.title || undefined, description: parsed.data.description || undefined } }).where(eq(schema.shops.id, shop.id));
    refresh();
    return { ok: true };
  });
}

const policiesSchema = z.object(Object.fromEntries(policyKinds.map((k) => [k, z.string().trim().max(10_000, "e:invalid")])) as Record<(typeof policyKinds)[number], z.ZodString>);

export async function savePolicies(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("settings/policies", async () => {
    const shop = await shopOf(lang);
    const parsed = policiesSchema.safeParse(Object.fromEntries(policyKinds.map((k) => [k, formData.get(k) ?? ""])));
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const policies = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v));
    await db.update(schema.shops).set({ policies }).where(eq(schema.shops.id, shop.id));
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
