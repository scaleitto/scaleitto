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
import { readPublished, sanitizeSections, sanitizeVariants, storeLanguage, type LandingSection, type PageVariant } from "./types";
import { blankSections, freeSlug, insertLandingPage, shopProduct } from "./store";
import { versionStats } from "./queries";

const guard = (lang: string) => requireSection(asLocale(lang), "landingPages");
const MAX_HISTORY = 20;
// Autosaves add a History entry at most every few minutes (publishing always adds one)
const HISTORY_EVERY_MS = 3 * 60_000;

async function pageOf(shopId: string, pageId: string) {
  const [page] = await db.select().from(schema.landingPages).where(and(eq(schema.landingPages.shopId, shopId), eq(schema.landingPages.id, pageId)));
  return page ?? null;
}

// "Design manually": pick a product and go straight to a blank canvas (an image to fill and the order form)
export async function createLandingPage(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = asLocale(lang);
  let pageId: string | null = null;
  const result = await safeAction("landing/create", async () => {
    const { shop } = await guard(locale);
    const parsed = z.object({ productId: z.string().min(1, "e:required").max(36) }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const product = await shopProduct(shop.id, parsed.data.productId);
    if (!product) return { ok: false, error: "checkFields", fieldErrors: { productId: "required" } };
    if (!(await canAdd(shop.id, "maxLandingPages"))) return { ok: false, error: "limitLanding" };
    pageId = await insertLandingPage(shop.id, { productId: product.id, title: product.name, language: storeLanguage(shop.defaultLocale), sections: blankSections() });
    return { ok: true };
  });
  if (pageId) redirect(`${sectionHref(locale, "landingPages")}/${pageId}`);
  return result;
}

const draftSchema = z.object({
  title: z.string().trim().min(1, "e:required").max(200, "e:invalid"),
  slug: z.string().trim().max(120).optional().default(""),
  metaDescription: z.string().trim().max(300, "e:invalid").optional().default(""),
  sections: z.unknown(),
  variants: z.unknown(),
  // One of the store's form templates (null: the product's form)
  formTemplateId: z.string().max(36).nullable().optional().default(null),
  // Per platform: the pixel ids that fire on the page (missing platform = all the store's pixels)
  pixels: z.record(z.string(), z.array(z.string().max(36)).max(20)).nullable().optional().default(null),
});
export type LandingDraft = z.input<typeof draftSchema>;

async function addHistory(shopId: string, pageId: string, userId: string, title: string, content: { sections: LandingSection[]; variants: PageVariant[] }, formTemplateId: string | null, force: boolean) {
  const v = schema.landingVersions;
  if (!force) {
    const [last] = await db.select({ at: v.createdAt }).from(v).where(eq(v.pageId, pageId)).orderBy(desc(v.createdAt)).limit(1);
    if (last && Date.now() - new Date(last.at).getTime() < HISTORY_EVERY_MS) return;
  }
  await db.insert(v).values({ id: newId(), shopId, pageId, title, sections: content, formTemplateId, userId });
  const old = await db.select({ id: v.id }).from(v).where(eq(v.pageId, pageId)).orderBy(desc(v.createdAt)).limit(100).offset(MAX_HISTORY);
  if (old.length) await db.delete(v).where(inArray(v.id, old.map((x) => x.id)));
}

// The builder saves as it goes ("Saved"): the draft only — visitors keep seeing the published page until "Publish".
// Returns the slug actually used (made unique in the store).
export async function saveLandingDraft(lang: string, pageId: string, draft: LandingDraft): Promise<ActionState> {
  return safeAction("landing/save", async () => {
    const { shop, user } = await guard(lang);
    const parsed = draftSchema.safeParse(draft);
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const d = parsed.data;
    const page = await pageOf(shop.id, pageId);
    if (!page) return { ok: false, error: "notFound" };
    // Never trust ids from the browser: the template and the pixels must be this store's
    if (d.formTemplateId) {
      const [tpl] = await db.select({ id: schema.formTemplates.id }).from(schema.formTemplates).where(and(eq(schema.formTemplates.shopId, shop.id), eq(schema.formTemplates.id, d.formTemplateId)));
      if (!tpl) return { ok: false, error: "notFound" };
    }
    let pixels: Record<string, string[]> | null = null;
    if (d.pixels) {
      const own = await db.select({ id: schema.pixels.id, platform: schema.pixels.platform }).from(schema.pixels).where(eq(schema.pixels.shopId, shop.id));
      pixels = Object.fromEntries(Object.entries(d.pixels).map(([platform, ids]) => [platform, ids.filter((id) => own.some((p) => p.id === id && p.platform === platform))]));
    }
    const sections = sanitizeSections(d.sections);
    const variants = sanitizeVariants(d.variants);
    const slug = d.slug ? await freeSlug(shop.id, d.slug, pageId) : page.slug;
    await db
      .update(schema.landingPages)
      .set({ title: d.title, slug, metaDescription: d.metaDescription || null, sections, variants, formTemplateId: d.formTemplateId, pixels })
      .where(eq(schema.landingPages.id, pageId));
    await addHistory(shop.id, pageId, user.id, d.title, { sections, variants }, d.formTemplateId, false);
    return { ok: true, message: slug };
  });
}

// "Publish": what is in the builder (every version) goes live
export async function publishLandingPage(lang: string, pageId: string): Promise<ActionState> {
  return safeAction("landing/publish", async () => {
    const { shop, user } = await guard(lang);
    const page = await pageOf(shop.id, pageId);
    if (!page) return { ok: false, error: "notFound" };
    const content = { sections: sanitizeSections(page.sections), variants: sanitizeVariants(page.variants) };
    await db.update(schema.landingPages).set({ status: "published", published: content }).where(eq(schema.landingPages.id, pageId));
    await addHistory(shop.id, pageId, user.id, page.title, content, page.formTemplateId, true);
    refresh();
    return { ok: true };
  });
}

// The list's eye button: take the page offline (or back online with what was last published)
export async function setLandingLive(lang: string, pageId: string, live: boolean): Promise<ActionState> {
  return safeAction("landing/live", async () => {
    const { shop } = await guard(lang);
    const page = await pageOf(shop.id, pageId);
    if (!page) return { ok: false, error: "notFound" };
    if (!live) await db.update(schema.landingPages).set({ status: "draft" }).where(eq(schema.landingPages.id, pageId));
    else {
      const published = readPublished(page.published) ?? { sections: sanitizeSections(page.sections), variants: sanitizeVariants(page.variants) };
      await db.update(schema.landingPages).set({ status: "published", published }).where(eq(schema.landingPages.id, pageId));
    }
    refresh();
    return { ok: true };
  });
}

// "Discard changes": the builder goes back to the published page (nothing to go back to before a first publish)
export async function discardLandingChanges(lang: string, pageId: string) {
  const { shop } = await guard(lang);
  const page = await pageOf(shop.id, pageId);
  const published = page ? readPublished(page.published) : null;
  if (!page || !published) return null;
  await db.update(schema.landingPages).set({ sections: published.sections, variants: published.variants }).where(eq(schema.landingPages.id, pageId));
  return published;
}

// The builder's History: the saved versions, then one of them to load back into the builder
export async function listHistory(lang: string, pageId: string) {
  const { shop } = await guard(lang);
  const v = schema.landingVersions;
  const rows = await db
    .select({ id: v.id, at: v.createdAt, title: v.title, sections: v.sections, by: schema.users.name })
    .from(v)
    .leftJoin(schema.users, eq(schema.users.id, v.userId))
    .where(and(eq(v.shopId, shop.id), eq(v.pageId, pageId)))
    .orderBy(desc(v.createdAt))
    .limit(MAX_HISTORY);
  return rows.map((r) => {
    const c = contentOf(r.sections);
    return { id: r.id, at: r.at.toISOString(), title: r.title, by: r.by, count: c.sections.length, versions: 1 + c.variants.length };
  });
}

// History rows hold { sections, variants } (older ones: the sections only)
function contentOf(raw: unknown) {
  if (Array.isArray(raw)) return { sections: sanitizeSections(raw), variants: [] as PageVariant[] };
  const r = (raw ?? {}) as Record<string, unknown>;
  return { sections: sanitizeSections(r.sections), variants: sanitizeVariants(r.variants) };
}

export async function getHistoryEntry(lang: string, pageId: string, entryId: string) {
  const { shop } = await guard(lang);
  const v = schema.landingVersions;
  const [row] = await db.select().from(v).where(and(eq(v.shopId, shop.id), eq(v.pageId, pageId), eq(v.id, entryId)));
  return row ? { title: row.title, formTemplateId: row.formTemplateId, ...contentOf(row.sections) } : null;
}

export async function deleteLandingPage(lang: string, pageId: string): Promise<ActionState> {
  return safeAction("landing/delete", async () => {
    const { shop } = await guard(lang);
    await db.delete(schema.landingPages).where(and(eq(schema.landingPages.shopId, shop.id), eq(schema.landingPages.id, pageId)));
    await db.delete(schema.landingVersions).where(and(eq(schema.landingVersions.shopId, shop.id), eq(schema.landingVersions.pageId, pageId)));
    await db.delete(schema.landingStats).where(and(eq(schema.landingStats.shopId, shop.id), eq(schema.landingStats.pageId, pageId)));
    refresh();
    return { ok: true };
  });
}

export async function duplicateLandingPage(lang: string, pageId: string): Promise<ActionState> {
  const locale = asLocale(lang);
  let copyId: string | null = null;
  const result = await safeAction("landing/duplicate", async () => {
    const { shop } = await guard(locale);
    const page = await pageOf(shop.id, pageId);
    if (!page) return { ok: false, error: "notFound" };
    if (!(await canAdd(shop.id, "maxLandingPages"))) return { ok: false, error: "limitLanding" };
    copyId = await insertLandingPage(shop.id, { ...page, title: `${page.title} (2)`, status: "draft" });
    return { ok: true };
  });
  if (copyId) redirect(`${sectionHref(locale, "landingPages")}/${copyId}`);
  return result;
}

// Visits and orders per version (the list's statistics button and the builder's version menu)
export async function pageVersionStats(lang: string, pageId: string) {
  const { shop } = await guard(lang);
  const page = await pageOf(shop.id, pageId);
  if (!page) return null;
  const variants = sanitizeVariants(page.variants);
  const stats = await versionStats(shop.id, pageId);
  return [{ key: "A" as const, paused: false }, ...variants.map((v) => ({ key: v.key, paused: v.paused }))].map((v) => ({ ...v, ...stats[v.key] }));
}
