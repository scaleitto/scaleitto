"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { newId, requireSection } from "@/server/auth/context";
import { logError } from "@/server/errors";
import { canAdd } from "@/server/limits";
import { visionImages } from "@/server/ai/vision";
import { downloadImages, importProductFromUrl } from "@/server/product-import";
import { AiRequestError, aiConfigured, checkAiConnection, pollBackgroundJson, startBackgroundJson, type AiCheckStep } from "@/server/ai/openai";
import { asLocale } from "@/i18n";
import { nextFreeSlug, slugify } from "@/lib/format";
import type { QuantityOffer, ProductOption } from "@/server/db/schema";
import { aiTones, buildLandingRequest, finishLandingPage, type LandingAiOutput } from "./ai-prompt";
import { insertLandingPage } from "./store";
import { isSafeImage, pageLanguages, sanitizeSections } from "./types";
import { imageStyles, pollTask, startImageTask, startPosterTask, type ImageStyle } from "@/features/ai/tasks";
import { currencyLabel } from "@/i18n/store";
import { buildPosterPlanRequest, finishPosterPage, posterAudiences, posterCounts, posterPeople, posterPrompt, type PosterOptions, type PosterPlan } from "./posters";
import { interfaceLocale, type PageLanguage } from "./types";

// Everything needed to build the page once the text is ready (stored on the generation).
type Brief = {
  productId: string | null;
  newProduct: { name: string; price: number; compareAtPrice: number | null; images: string[] } | null;
  language: string;
  color: string | null;
  images: string[];
  // Rework the page's main photo(s) once the text is ready
  enhance?: { style: ImageStyle; count: number } | null;
  // "images" = a Wibi-style page of designed images (one per section), "sections" = text and photo blocks
  pageStyle?: "sections" | "images";
  poster?: PosterOptions;
};
// Image reworks started after the page was built, then swapped into it
// (photo reworks carry `source`; designed section images carry `sectionId`)
type ImageJobs = { imageTasks?: { taskId: string; source?: string; sectionId?: string }[]; applied?: boolean };

export type AiStartResult = { ok: true; generationId: string } | { ok: false; error: string; message?: string; fieldErrors?: Record<string, string> };
export type AiCheckResult = { state: "pending"; step?: "images"; done?: number; total?: number } | { state: "done"; pageId: string } | { state: "failed"; error: string; message?: string };

const startSchema = z.object({
  source: z.enum(["product", "photos", "link"]),
  productId: z.string().max(36).optional(),
  photos: z.array(z.string()).max(8).optional(),
  // More photos for the page, whatever the source (the AI places them in different sections)
  extraPhotos: z.array(z.string()).max(8).optional(),
  enhance: z.object({ style: z.enum(imageStyles), count: z.number().int().min(1).max(2) }).nullable().optional(),
  url: z.string().trim().max(1000).optional(),
  name: z.string().trim().max(200).optional(),
  price: z.number().int().min(0).max(100_000_000).nullable().optional(),
  compareAtPrice: z.number().int().min(0).max(100_000_000).nullable().optional(),
  notes: z.string().trim().max(3000).optional().default(""),
  audience: z.string().trim().max(300).optional().default(""),
  language: z.enum(pageLanguages),
  tone: z.enum(aiTones),
  pageStyle: z.enum(["sections", "images"]).optional().default("sections"),
  poster: z
    .object({
      count: z.union([z.literal(2), z.literal(4), z.literal(6), z.literal(8), z.literal(10)]),
      people: z.enum(posterPeople),
      audience: z.enum(posterAudiences),
      color: z.string().regex(/^#[0-9a-f]{6}$/i).nullable(),
    })
    .optional(),
});
export type AiStartInput = z.input<typeof startSchema>;

const guard = (lang: string) => requireSection(asLocale(lang), "landingPages");

// Starts an AI landing page. Returns at once: the browser then asks checkAiLanding every few seconds.
export async function startAiLanding(lang: string, input: AiStartInput): Promise<AiStartResult> {
  try {
    const { shop, user } = await guard(lang);
    if (!aiConfigured()) return { ok: false, error: "aiNotConfigured" };
    const parsed = startSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "checkFields" };
    const d = parsed.data;
    const poster: PosterOptions | null = d.pageStyle === "images" ? (d.poster ?? { count: posterCounts[2], people: "hands", audience: "neutral", color: null }) : null;
    // The plan + one image per section all count in the monthly AI quota
    if (!(await canAdd(shop.id, "maxAiPerMonth", 1 + (poster?.count ?? 0)))) return { ok: false, error: "limitAi" };
    if (!(await canAdd(shop.id, "maxLandingPages"))) return { ok: false, error: "limitLanding" };

    let product: { name: string; description: string | null; price: number; compareAtPrice: number | null; images: string[]; options: ProductOption[]; offers: QuantityOffer[] };
    let brief: Brief;
    let sourceText: string | undefined;
    const ownPhoto = (src: string) => src.startsWith(`/uploads/${shop.id}/`) && isSafeImage(src);
    const extras = (d.extraPhotos ?? []).filter(ownPhoto);
    if (d.source === "product") {
      const [p] = await db.select().from(schema.products).where(and(eq(schema.products.shopId, shop.id), eq(schema.products.id, d.productId ?? "")));
      if (!p) return { ok: false, error: "checkFields", fieldErrors: { productId: "required" } };
      const images = [...new Set([...p.images, ...extras])].slice(0, 12);
      product = { ...p, images };
      brief = { productId: p.id, newProduct: null, language: d.language, color: null, images, enhance: poster ? null : (d.enhance ?? null), pageStyle: d.pageStyle, poster: poster ?? undefined };
    } else {
      if (d.price == null) return { ok: false, error: "checkFields", fieldErrors: { price: "price" } };
      if (!(await canAdd(shop.id, "maxProducts"))) return { ok: false, error: "limitProducts" };
      let images = [...new Set([...(d.photos ?? []).filter(ownPhoto), ...extras])];
      let name = d.name ?? "";
      if (d.source === "photos" && !images.length) return { ok: false, error: "checkFields", fieldErrors: { photos: "required" } };
      if (d.source === "link") {
        try {
          const imported = await importProductFromUrl(d.url ?? "");
          // Keep our own copies so the page never depends on the other site
          images = [...images, ...(await downloadImages(shop.id, imported.images, 6))].slice(0, 8);
          name = name || imported.title;
          sourceText = `${imported.title}\n${imported.description}`;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return message === "BLOCKED" ? { ok: false, error: "importBlocked" } : { ok: false, error: "importFailed", message };
        }
      }
      product = { name: name || "—", description: null, price: d.price, compareAtPrice: d.compareAtPrice ?? null, images, options: [], offers: [] };
      brief = { productId: null, newProduct: { name, price: d.price, compareAtPrice: d.compareAtPrice ?? null, images }, language: d.language, color: null, images, enhance: poster ? null : (d.enhance ?? null), pageStyle: d.pageStyle, poster: poster ?? undefined };
    }

    const vision = await visionImages(product.images, 10);
    const request = poster
      ? buildPosterPlanRequest({ product, language: d.language, options: poster, notes: d.notes, sourceText, visionImages: vision, writeProduct: d.source !== "product" })
      : buildLandingRequest({
      product,
      language: d.language,
      tone: d.tone,
      audience: d.audience,
      notes: d.notes,
      sourceText,
      visionImages: vision,
      writeProduct: d.source !== "product",
    });
    const started = await startBackgroundJson(request);
    const generationId = newId();
    await db.insert(schema.aiGenerations).values({ id: generationId, shopId: shop.id, userId: user.id, responseId: started.responseId, model: started.model, brief });
    return { ok: true, generationId };
  } catch (err) {
    if (err instanceof AiRequestError) return { ok: false, error: "aiFailed", message: err.message };
    await logError("landing/ai-start", err);
    return { ok: false, error: "unexpected" };
  }
}

const SAVING_TIMEOUT_MS = 2 * 60_000;

// One short check of a generation; builds the page (and the new product) when the text is ready.
export async function checkAiLanding(lang: string, generationId: string): Promise<AiCheckResult> {
  try {
    const { shop } = await guard(lang);
    const g = schema.aiGenerations;
    const [gen] = await db.select().from(g).where(and(eq(g.shopId, shop.id), eq(g.id, generationId)));
    if (!gen) return { state: "failed", error: "notFound" };
    if (gen.status === "done" && gen.landingPageId) return finishImages(shop.id, gen.landingPageId, gen.id, gen.result as ImageJobs | null);
    if (gen.status === "failed") return { state: "failed", error: "aiFailed", message: gen.error ?? undefined };
    if (gen.status === "saving") {
      if (Date.now() - new Date(gen.updatedAt).getTime() < SAVING_TIMEOUT_MS) return { state: "pending" };
      await db.update(g).set({ status: "failed", error: "Saving was interrupted" }).where(eq(g.id, gen.id));
      return { state: "failed", error: "aiFailed", message: "Saving was interrupted" };
    }

    const result = await pollBackgroundJson<LandingAiOutput & PosterPlan>(gen.responseId ?? "");
    if (result.state === "pending") return { state: "pending" };
    if (result.state === "failed") {
      await db.update(g).set({ status: "failed", error: result.error.slice(0, 2000) }).where(eq(g.id, gen.id));
      return { state: "failed", error: "aiFailed", message: result.error };
    }

    // Only one check may build the page (the browser can send two at once)
    const [claim] = await db.update(g).set({ status: "saving" }).where(and(eq(g.id, gen.id), eq(g.status, "pending")));
    if (!claim.affectedRows) return { state: "pending" };

    const brief = gen.brief as Brief;
    const imagePage = brief.pageStyle === "images" && brief.poster ? finishPosterPage(result.data, brief.newProduct?.name || "Page", brief.poster) : null;
    const page = imagePage ?? finishLandingPage(result.data, brief.newProduct?.name || "Page", brief.images);
    let productId = brief.productId;
    if (!productId && brief.newProduct) {
      const np = brief.newProduct;
      const name = (page.productName || np.name || page.title).slice(0, 200);
      productId = newId();
      const taken = new Set(
        (await db.select({ slug: schema.products.slug }).from(schema.products).where(eq(schema.products.shopId, shop.id))).map((r) => r.slug),
      );
      await db.insert(schema.products).values({
        id: productId,
        shopId: shop.id,
        name,
        slug: nextFreeSlug(slugify(name), taken),
        description: page.productDescription,
        price: np.price,
        compareAtPrice: np.compareAtPrice && np.compareAtPrice > np.price ? np.compareAtPrice : null,
        images: np.images,
        options: [],
        offers: [],
      });
    }
    const pageId = await insertLandingPage(shop.id, { productId: productId!, title: page.title, language: brief.language, color: imagePage ? imagePage.palette.primary : brief.color, sections: page.sections });
    // Photos to rework: the hero's, then the next ones in page order (our uploads only)
    const imageTasks: NonNullable<ImageJobs["imageTasks"]> = [];
    if (imagePage) {
      // One designed image per section, all started now (they are made in parallel)
      const [product] = await db.select().from(schema.products).where(and(eq(schema.products.shopId, shop.id), eq(schema.products.id, productId!)));
      const language = brief.language as PageLanguage;
      for (const s of page.sections) {
        if (s.type !== "poster") continue;
        const prompt = posterPrompt(s, { productName: product?.name ?? page.title, language, price: product?.price ?? 0, compareAtPrice: product?.compareAtPrice ?? null, currency: currencyLabel(interfaceLocale(language)) });
        const started = await startPosterTask(shop.id, gen.userId, prompt, brief.images.slice(0, 3));
        if (started.ok) imageTasks.push({ taskId: started.taskId, sectionId: s.id });
      }
    }
    if (brief.enhance) {
      const sources = [...new Set(page.sections.flatMap((s) => (s.type === "hero" || s.type === "imageText" ? [s.image] : s.type === "image" ? [s.url] : [])))].filter(
        (src): src is string => Boolean(src) && src!.startsWith(`/uploads/${shop.id}/`),
      );
      for (const source of sources.slice(0, brief.enhance.count)) {
        const started = await startImageTask(shop.id, gen.userId, source, brief.enhance.style);
        if (started.ok) imageTasks.push({ taskId: started.taskId, source });
      }
    }
    await db
      .update(g)
      .set({ status: "done", landingPageId: pageId, result: { imageTasks, applied: imageTasks.length === 0 }, inputTokens: result.inputTokens, outputTokens: result.outputTokens, model: result.model || gen.model })
      .where(eq(g.id, gen.id));
    return imageTasks.length ? { state: "pending", step: "images", done: 0, total: imageTasks.length } : { state: "done", pageId };
  } catch (err) {
    await logError("landing/ai-check", err);
    return { state: "failed", error: "unexpected" };
  }
}

// Once the page exists: waits for its photo reworks, then puts the new photos in the page (and the product)
async function finishImages(shopId: string, pageId: string, generationId: string, jobs: ImageJobs | null): Promise<AiCheckResult> {
  if (!jobs?.imageTasks?.length || jobs.applied) return { state: "done", pageId };
  const states = await Promise.all(jobs.imageTasks.map(async (j) => ({ ...j, state: await pollTask(shopId, j.taskId) })));
  const pending = states.filter((s) => s.state.state === "pending").length;
  if (pending) return { state: "pending", step: "images", done: states.length - pending, total: states.length };
  const urlOf = (s: (typeof states)[number]) => (s.state.state === "done" ? (s.state.result as { url: string }).url : null);
  // Designed section images go into their sections (a failed one stays empty: the merchant regenerates it)
  const designed = new Map(states.flatMap((s) => (s.sectionId && urlOf(s) ? [[s.sectionId, urlOf(s)!] as const] : [])));
  if (designed.size) {
    const [page] = await db.select().from(schema.landingPages).where(and(eq(schema.landingPages.shopId, shopId), eq(schema.landingPages.id, pageId)));
    if (page) {
      const sections = sanitizeSections(page.sections).map((s) => (s.type === "poster" && designed.has(s.id) ? { ...s, image: designed.get(s.id)! } : s));
      await db.update(schema.landingPages).set({ sections }).where(eq(schema.landingPages.id, page.id));
    }
  }
  // Failed reworks keep the original photo
  const swaps = new Map(states.flatMap((s) => (s.source && urlOf(s) ? [[s.source, urlOf(s)!] as const] : [])));
  if (swaps.size) {
    const [page] = await db.select().from(schema.landingPages).where(and(eq(schema.landingPages.shopId, shopId), eq(schema.landingPages.id, pageId)));
    if (page) {
      const swap = (src?: string) => (src ? (swaps.get(src) ?? src) : src);
      const sections = sanitizeSections(page.sections).map((s) =>
        s.type === "hero" || s.type === "imageText" ? { ...s, image: swap(s.image) } : s.type === "image" ? { ...s, url: swap(s.url)! } : s.type === "gallery" ? { ...s, images: s.images.map((x) => swap(x)!) } : s,
      );
      await db.update(schema.landingPages).set({ sections }).where(eq(schema.landingPages.id, page.id));
      const [product] = await db.select({ images: schema.products.images }).from(schema.products).where(and(eq(schema.products.shopId, shopId), eq(schema.products.id, page.productId)));
      if (product) await db.update(schema.products).set({ images: [...new Set([...swaps.values(), ...product.images])].slice(0, 10) }).where(eq(schema.products.id, page.productId));
    }
  }
  await db.update(schema.aiGenerations).set({ result: { ...jobs, applied: true } }).where(eq(schema.aiGenerations.id, generationId));
  return { state: "done", pageId };
}

// "Test the AI connection" button: every step of the real path, with OpenAI's own messages.
export async function testAi(lang: string): Promise<AiCheckStep[]> {
  const { role } = await guard(lang);
  if (role === "agent") return [];
  return checkAiConnection();
}
