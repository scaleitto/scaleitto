"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { newId, requireSection } from "@/server/auth/context";
import { logError } from "@/server/errors";
import { canAdd } from "@/server/limits";
import { visionImages } from "@/server/ai/vision";
import { AiRequestError, aiConfigured, pollBackgroundJson, startBackgroundJson } from "@/server/ai/openai";
import { asLocale } from "@/i18n";
import { pollTask, startPosterTask } from "@/features/ai/tasks";
import { buildPosterPlanRequest, finishPosterPage, posterPrompt, type PosterOptions, type PosterPlan } from "./posters";
import { frameworks, posterSizes, styleKeys } from "./ai-options";
import { insertLandingPage } from "./store";
import { pageLanguage, pageLanguages, sanitizeSections, type LandingSection, type PageLanguage } from "./types";

// What to build once the plan is ready (stored on the generation). pageId = a new version of an existing page.
type Brief = { productId: string; language: PageLanguage; options: PosterOptions; pageId?: string };
// The images being drawn, then put into their components. A new version of an existing page is kept here
// (sections) until it is complete, then handed to the builder, which adds it to the page.
type ImageJobs = { imageTasks?: { taskId: string; sectionId: string }[]; applied?: boolean; sections?: LandingSection[] };

export type AiStartResult = { ok: true; generationId: string } | { ok: false; error: string; message?: string; fieldErrors?: Record<string, string> };
export type AiCheckResult = { state: "pending"; step?: "images"; done?: number; total?: number } | { state: "done"; pageId: string; sections?: LandingSection[] } | { state: "failed"; error: string; message?: string };

const startSchema = z.object({
  productId: z.string().min(1).max(36),
  language: z.enum(pageLanguages),
  brief: z.string().trim().max(900).optional().default(""),
  framework: z.enum(frameworks),
  size: z.union([z.literal(2), z.literal(4), z.literal(6)]),
  style: z.enum(styleKeys),
  priceText: z.string().trim().max(60).optional().default(""),
});
export type AiStartInput = z.input<typeof startSchema>;

const guard = (lang: string) => requireSection(asLocale(lang), "landingPages");

// "Generate Landing Page": starts the plan. Returns at once; the browser then asks checkAiLanding every few seconds.
export async function startAiLanding(lang: string, input: AiStartInput): Promise<AiStartResult> {
  try {
    const { shop, user } = await guard(lang);
    if (!aiConfigured()) return { ok: false, error: "aiNotConfigured" };
    const parsed = startSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "checkFields" };
    const d = parsed.data;
    // The plan + one image per section all count in the monthly AI quota
    if (!(await canAdd(shop.id, "maxAiPerMonth", 1 + d.size))) return { ok: false, error: "limitAi" };
    if (!(await canAdd(shop.id, "maxLandingPages"))) return { ok: false, error: "limitLanding" };
    return start(shop.id, user.id, d.productId, d.language, { count: d.size, framework: d.framework, style: d.style, brief: d.brief, priceText: d.priceText });
  } catch (err) {
    await logError("landing/ai-start", err);
    return { ok: false, error: "unexpected" };
  }
}

// "Improve with AI → Generate another version": another version of the page from its product and language, with the
// default choices and as many images as version A has. The builder adds it (paused) once it is ready.
export async function startAiVersion(lang: string, pageId: string): Promise<AiStartResult> {
  try {
    const { shop, user } = await guard(lang);
    if (!aiConfigured()) return { ok: false, error: "aiNotConfigured" };
    const [page] = await db.select().from(schema.landingPages).where(and(eq(schema.landingPages.shopId, shop.id), eq(schema.landingPages.id, pageId)));
    if (!page) return { ok: false, error: "notFound" };
    const images = sanitizeSections(page.sections).filter((s) => s.type === "image").length;
    const count = posterSizes.find((n) => n >= images) ?? 6;
    if (!(await canAdd(shop.id, "maxAiPerMonth", 1 + count))) return { ok: false, error: "limitAi" };
    return start(shop.id, user.id, page.productId, pageLanguage(page.language), { count, framework: "auto", style: "auto", brief: "", priceText: "" }, page.id);
  } catch (err) {
    await logError("landing/ai-version", err);
    return { ok: false, error: "unexpected" };
  }
}

async function start(shopId: string, userId: string, productId: string, language: PageLanguage, options: PosterOptions, pageId?: string): Promise<AiStartResult> {
  try {
    const [p] = await db.select().from(schema.products).where(and(eq(schema.products.shopId, shopId), eq(schema.products.id, productId)));
    if (!p) return { ok: false, error: "checkFields", fieldErrors: { productId: "required" } };
    const vision = await visionImages(p.images, 6);
    const request = buildPosterPlanRequest({ product: p, language, options, visionImages: vision });
    const started = await startBackgroundJson(request);
    const generationId = newId();
    const brief: Brief = { productId: p.id, language, options, ...(pageId ? { pageId } : {}) };
    await db.insert(schema.aiGenerations).values({ id: generationId, shopId, userId, responseId: started.responseId, model: started.model, brief });
    return { ok: true, generationId };
  } catch (err) {
    if (err instanceof AiRequestError) return { ok: false, error: "aiFailed", message: err.message };
    throw err;
  }
}

const SAVING_TIMEOUT_MS = 2 * 60_000;

// One short check of a generation: builds the page (or the new version) when the plan is ready, starts drawing its
// images, then puts each image into its component as it arrives.
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

    const result = await pollBackgroundJson<PosterPlan>(gen.responseId ?? "");
    if (result.state === "pending") return { state: "pending" };
    if (result.state === "failed") {
      await db.update(g).set({ status: "failed", error: result.error.slice(0, 2000) }).where(eq(g.id, gen.id));
      return { state: "failed", error: "aiFailed", message: result.error };
    }

    // Only one check may build the page (the browser can send two at once)
    const [claim] = await db.update(g).set({ status: "saving" }).where(and(eq(g.id, gen.id), eq(g.status, "pending")));
    if (!claim.affectedRows) return { state: "pending" };

    const brief = gen.brief as Brief;
    const [product] = await db.select().from(schema.products).where(and(eq(schema.products.shopId, shop.id), eq(schema.products.id, brief.productId)));
    if (!product) {
      await db.update(g).set({ status: "failed", error: "Product deleted" }).where(eq(g.id, gen.id));
      return { state: "failed", error: "notFound" };
    }
    const page = finishPosterPage(result.data, product.name, brief.options);
    // A new version of an existing page stays in the generation until complete; a new page is created now
    const pageId = brief.pageId ?? (await insertLandingPage(shop.id, { productId: product.id, title: page.title, language: brief.language, color: page.color, sections: page.sections }));
    // One image per component, all started now (they are drawn in parallel)
    const imageTasks: NonNullable<ImageJobs["imageTasks"]> = [];
    let first = true;
    for (const s of page.sections) {
      if (s.type !== "image" || !s.poster) continue;
      const prompt = posterPrompt({ ...s.poster, first }, { productName: product.name, language: brief.language, priceText: brief.options.priceText || undefined });
      first = false;
      const started = await startPosterTask(shop.id, gen.userId, prompt, product.images.slice(0, 3));
      if (started.ok) imageTasks.push({ taskId: started.taskId, sectionId: s.id });
    }
    await db
      .update(g)
      .set({ status: "done", landingPageId: pageId, result: { imageTasks, applied: imageTasks.length === 0, ...(brief.pageId ? { sections: page.sections } : {}) }, inputTokens: result.inputTokens, outputTokens: result.outputTokens, model: result.model || gen.model })
      .where(eq(g.id, gen.id));
    return imageTasks.length ? { state: "pending", step: "images", done: 0, total: imageTasks.length } : { state: "done", pageId, ...(brief.pageId ? { sections: page.sections } : {}) };
  } catch (err) {
    await logError("landing/ai-check", err);
    return { state: "failed", error: "unexpected" };
  }
}

// Once the page exists: waits for its images, then puts each one into its component (a failed one stays an empty
// image: the merchant draws it again or uploads one)
async function finishImages(shopId: string, pageId: string, generationId: string, jobs: ImageJobs | null): Promise<AiCheckResult> {
  const done = (sections?: LandingSection[]): AiCheckResult => ({ state: "done", pageId, ...(sections ? { sections } : {}) });
  if (!jobs?.imageTasks?.length || jobs.applied) return done(jobs?.sections);
  const states = await Promise.all(jobs.imageTasks.map(async (j) => ({ ...j, state: await pollTask(shopId, j.taskId) })));
  const pending = states.filter((s) => s.state.state === "pending").length;
  if (pending) return { state: "pending", step: "images", done: states.length - pending, total: states.length };
  const drawn = new Map(states.flatMap((s) => (s.state.state === "done" ? [[s.sectionId, (s.state.result as { url: string }).url] as const] : [])));
  const fill = (list: LandingSection[]) => list.map((s) => (s.type === "image" && drawn.has(s.id) && !s.url ? { ...s, url: drawn.get(s.id)! } : s));
  let sections = jobs.sections;
  if (sections) sections = fill(sanitizeSections(sections));
  else {
    const [page] = await db.select().from(schema.landingPages).where(and(eq(schema.landingPages.shopId, shopId), eq(schema.landingPages.id, pageId)));
    if (page && drawn.size) await db.update(schema.landingPages).set({ sections: fill(sanitizeSections(page.sections)) }).where(eq(schema.landingPages.id, page.id));
  }
  await db.update(schema.aiGenerations).set({ result: { ...jobs, sections, applied: true } }).where(eq(schema.aiGenerations.id, generationId));
  return done(sections);
}
