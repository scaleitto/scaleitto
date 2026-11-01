"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { newId, requireSection } from "@/server/auth/context";
import { safeAction } from "@/server/errors";
import { canAdd } from "@/server/limits";
import { asLocale } from "@/i18n";
import { sectionHref } from "@/lib/permissions";
import { fieldErrorsFrom } from "@/lib/validation";
import type { ActionState } from "@/lib/action";
import { pageLanguages, sanitizeSections } from "./types";
import { freeSlug, insertLandingPage, shopProduct } from "./store";
import { starterImageSections, starterSections } from "./template";

const guard = (lang: string) => requireSection(asLocale(lang), "landingPages");
const MAX_VERSIONS = 20;

const createSchema = z.object({
  productId: z.string().min(1, "e:required").max(36),
  language: z.enum(pageLanguages),
  // blank = only the order form (Zimam's "design manually")
  pageStyle: z.enum(["sections", "images", "blank"]).optional().default("sections"),
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
    pageId = await insertLandingPage(shop.id, { productId: product.id, title: product.name, language: parsed.data.language, sections: parsed.data.pageStyle === "blank" ? [{ id: "form", type: "form" }] : (parsed.data.pageStyle === "images" ? starterImageSections : starterSections)(product, parsed.data.language) });
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
  // One of the store's form templates (null: the product's form)
  formTemplateId: z.string().max(36).nullable().optional().default(null),
});

export type LandingDraft = z.input<typeof saveSchema>;

export async function saveLandingPage(lang: string, pageId: string, draft: LandingDraft): Promise<ActionState> {
  return safeAction("landing/save", async () => {
    const { shop, user } = await guard(lang);
    const parsed = saveSchema.safeParse(draft);
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const d = parsed.data;
    const [page] = await db.select({ id: schema.landingPages.id }).from(schema.landingPages).where(and(eq(schema.landingPages.shopId, shop.id), eq(schema.landingPages.id, pageId)));
    if (!page) return { ok: false, error: "notFound" };
    const sections = sanitizeSections(d.sections);
    // Never trust a template id from the browser: it must be one of this store's
    if (d.formTemplateId) {
      const [tpl] = await db.select({ id: schema.formTemplates.id }).from(schema.formTemplates).where(and(eq(schema.formTemplates.shopId, shop.id), eq(schema.formTemplates.id, d.formTemplateId)));
      if (!tpl) return { ok: false, error: "notFound" };
    }
    await db
      .update(schema.landingPages)
      .set({ title: d.title, slug: await freeSlug(shop.id, d.slug || d.title, pageId), language: d.language, color: d.color, status: d.status, sections, formTemplateId: d.formTemplateId })
      .where(eq(schema.landingPages.id, pageId));
    // History: this save as a version, the last 20 kept
    await db.insert(schema.landingVersions).values({ id: newId(), shopId: shop.id, pageId, title: d.title, sections, formTemplateId: d.formTemplateId, userId: user.id });
    const old = await db.select({ id: schema.landingVersions.id }).from(schema.landingVersions).where(eq(schema.landingVersions.pageId, pageId)).orderBy(desc(schema.landingVersions.createdAt)).limit(100).offset(MAX_VERSIONS);
    if (old.length) await db.delete(schema.landingVersions).where(inArray(schema.landingVersions.id, old.map((v) => v.id)));
    refresh();
    return { ok: true };
  });
}

// The builder's History: the saved versions, then one of them to load back into the editor
export async function listVersions(lang: string, pageId: string) {
  const { shop } = await guard(lang);
  const rows = await db
    .select({ id: schema.landingVersions.id, at: schema.landingVersions.createdAt, title: schema.landingVersions.title, sections: schema.landingVersions.sections, by: schema.users.name })
    .from(schema.landingVersions)
    .leftJoin(schema.users, eq(schema.users.id, schema.landingVersions.userId))
    .where(and(eq(schema.landingVersions.shopId, shop.id), eq(schema.landingVersions.pageId, pageId)))
    .orderBy(desc(schema.landingVersions.createdAt))
    .limit(MAX_VERSIONS);
  return rows.map((r) => ({ id: r.id, at: r.at.toISOString(), title: r.title, by: r.by, count: Array.isArray(r.sections) ? r.sections.length : 0 }));
}

export async function getVersion(lang: string, pageId: string, versionId: string) {
  const { shop } = await guard(lang);
  const [v] = await db.select().from(schema.landingVersions).where(and(eq(schema.landingVersions.shopId, shop.id), eq(schema.landingVersions.pageId, pageId), eq(schema.landingVersions.id, versionId)));
  return v ? { title: v.title, sections: sanitizeSections(v.sections), formTemplateId: v.formTemplateId } : null;
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
