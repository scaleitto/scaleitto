"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { requireSection } from "@/server/auth/context";
import { safeAction } from "@/server/errors";
import { canAdd } from "@/server/limits";
import { asLocale } from "@/i18n";
import { sectionHref } from "@/lib/permissions";
import { fieldErrorsFrom } from "@/lib/validation";
import type { ActionState } from "@/lib/action";
import { pageLanguages, resolveForm, sanitizeSections } from "./types";
import { freeSlug, insertLandingPage, shopProduct } from "./store";
import { starterImageSections, starterSections } from "./template";

const guard = (lang: string) => requireSection(asLocale(lang), "landingPages");

const createSchema = z.object({
  productId: z.string().min(1, "e:required").max(36),
  language: z.enum(pageLanguages),
  pageStyle: z.enum(["sections", "images"]).optional().default("sections"),
});

// A new page by hand: starts from a ready template filled with the product's data.
export async function createLandingPage(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = asLocale(lang);
  let pageId: string | null = null;
  const result = await safeAction("landing/create", async () => {
    const { shop } = await guard(locale);
    const parsed = createSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const product = await shopProduct(shop.id, parsed.data.productId);
    if (!product) return { ok: false, error: "checkFields", fieldErrors: { productId: "required" } };
    if (!(await canAdd(shop.id, "maxLandingPages"))) return { ok: false, error: "limitLanding" };
    pageId = await insertLandingPage(shop.id, { productId: product.id, title: product.name, language: parsed.data.language, sections: (parsed.data.pageStyle === "images" ? starterImageSections : starterSections)(product, parsed.data.language) });
    return { ok: true };
  });
  if (pageId) redirect(`${sectionHref(locale, "landingPages")}/${pageId}`);
  return result;
}

const saveSchema = z.object({
  title: z.string().trim().min(1, "e:required").max(200, "e:invalid"),
  slug: z.string().trim().max(120).optional().default(""),
  language: z.enum(pageLanguages),
  color: z
    .string()
    .trim()
    .regex(/^(#[0-9a-fA-F]{6})?$/, "e:color")
    .transform((v) => v.toLowerCase() || null),
  status: z.enum(["draft", "published"]),
  sections: z.unknown(),
  form: z.unknown(),
});

export type LandingDraft = z.input<typeof saveSchema>;

export async function saveLandingPage(lang: string, pageId: string, draft: LandingDraft): Promise<ActionState> {
  return safeAction("landing/save", async () => {
    const { shop } = await guard(lang);
    const parsed = saveSchema.safeParse(draft);
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const d = parsed.data;
    const [page] = await db.select({ id: schema.landingPages.id }).from(schema.landingPages).where(and(eq(schema.landingPages.shopId, shop.id), eq(schema.landingPages.id, pageId)));
    if (!page) return { ok: false, error: "notFound" };
    const sections = sanitizeSections(d.sections);
    await db
      .update(schema.landingPages)
      .set({ title: d.title, slug: await freeSlug(shop.id, d.slug || d.title, pageId), language: d.language, color: d.color, status: d.status, sections, form: resolveForm(d.form) })
      .where(eq(schema.landingPages.id, pageId));
    refresh();
    return { ok: true };
  });
}

export async function deleteLandingPage(lang: string, pageId: string): Promise<ActionState> {
  return safeAction("landing/delete", async () => {
    const { shop } = await guard(lang);
    await db.delete(schema.landingPages).where(and(eq(schema.landingPages.shopId, shop.id), eq(schema.landingPages.id, pageId)));
    refresh();
    return { ok: true };
  });
}

export async function duplicateLandingPage(lang: string, pageId: string): Promise<ActionState> {
  const locale = asLocale(lang);
  let copyId: string | null = null;
  const result = await safeAction("landing/duplicate", async () => {
    const { shop } = await guard(locale);
    const [page] = await db.select().from(schema.landingPages).where(and(eq(schema.landingPages.shopId, shop.id), eq(schema.landingPages.id, pageId)));
    if (!page) return { ok: false, error: "notFound" };
    if (!(await canAdd(shop.id, "maxLandingPages"))) return { ok: false, error: "limitLanding" };
    copyId = await insertLandingPage(shop.id, { ...page, title: `${page.title} (2)`, status: "draft" });
    return { ok: true };
  });
  if (copyId) redirect(`${sectionHref(locale, "landingPages")}/${copyId}`);
  return result;
}
