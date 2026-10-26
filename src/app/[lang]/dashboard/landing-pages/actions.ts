"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { newId, requireManager } from "@/lib/auth";
import { canAdd } from "@/lib/limits";
import { slugify } from "@/lib/format";
import { sanitizeSections } from "@/lib/landing";
import { asLocale, locales } from "@/i18n";
import { aiConfigured } from "@/lib/ai/openai";
import { aiLanguages, aiTones } from "@/lib/ai/landing-generator";
import { runLandingJob, STALE_JOB_MS } from "@/lib/ai/landing-job";

const formSchema = z.object({
  title: z.string().trim().min(1).max(200),
  productId: z.string().min(1),
  status: z.enum(["active", "draft"]),
  sections: z.string(),
  locale: z.union([z.literal(""), z.enum(locales)]).optional().default(""),
  accentColor: z.union([z.literal(""), z.string().regex(/^#[0-9a-fA-F]{6}$/)]).optional().default(""),
});

async function parse(formData: FormData, shopId: string) {
  const data = formSchema.parse(Object.fromEntries(formData));
  let raw: unknown = [];
  try {
    raw = JSON.parse(data.sections);
  } catch {
    // unreadable sections: save the rest of the page with no sections rather than crashing
  }
  const sections = sanitizeSections(raw);
  const [product] = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(and(eq(schema.products.id, data.productId), eq(schema.products.shopId, shopId)));
  if (!product) throw new Error("Unknown product");
  return { ...data, sections, locale: data.locale || null, accentColor: data.accentColor || null };
}

async function uniqueSlug(shopId: string, title: string, excludeId?: string) {
  const base = slugify(title);
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const [taken] = await db
      .select({ id: schema.landingPages.id })
      .from(schema.landingPages)
      .where(and(eq(schema.landingPages.shopId, shopId), eq(schema.landingPages.slug, slug), excludeId ? ne(schema.landingPages.id, excludeId) : undefined));
    if (!taken) return slug;
  }
  return `${base}-${Date.now()}`;
}

export async function createLandingPage(lang: string, formData: FormData) {
  const locale = asLocale(lang);
  const { shop } = await requireManager(locale);
  if (!(await canAdd(shop.id, "maxLandingPages"))) redirect(`/${locale}/dashboard/landing-pages?error=limit`);
  const d = await parse(formData, shop.id);
  await db.insert(schema.landingPages).values({
    id: newId(),
    shopId: shop.id,
    productId: d.productId,
    slug: await uniqueSlug(shop.id, d.title),
    title: d.title,
    sections: d.sections,
    status: d.status,
    locale: d.locale,
    accentColor: d.accentColor,
  });
  redirect(`/${locale}/dashboard/landing-pages`);
}

export async function updateLandingPage(lang: string, id: string, formData: FormData) {
  const locale = asLocale(lang);
  const { shop } = await requireManager(locale);
  const d = await parse(formData, shop.id);
  await db
    .update(schema.landingPages)
    .set({ title: d.title, productId: d.productId, sections: d.sections, status: d.status, locale: d.locale, accentColor: d.accentColor })
    .where(and(eq(schema.landingPages.id, id), eq(schema.landingPages.shopId, shop.id)));
  redirect(`/${locale}/dashboard/landing-pages`);
}

export async function deleteLandingPage(lang: string, id: string) {
  const locale = asLocale(lang);
  const { shop } = await requireManager(locale);
  await db.delete(schema.landingPages).where(and(eq(schema.landingPages.id, id), eq(schema.landingPages.shopId, shop.id)));
  redirect(`/${locale}/dashboard/landing-pages`);
}

export type AiStartState = {
  error?: "limit" | "pageLimit" | "productLimit" | "notConfigured" | "validation" | "price" | "noImages";
  jobId?: string;
};

const httpUrl = z.string().trim().max(2000).regex(/^https?:\/\/\S+$/);
const aiStartSchema = z.object({
  source: z.enum(["product", "images", "link"]),
  productId: z.string().optional().default(""),
  images: z.string().optional().default("[]"),
  link: z.union([z.literal(""), httpUrl]).optional().default(""),
  price: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().int().min(1).max(10_000_000).optional()),
  compareAtPrice: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().int().min(0).max(10_000_000).optional()),
  language: z.enum(aiLanguages),
  tone: z.enum(aiTones),
  audience: z.string().trim().max(300).optional().default(""),
  notes: z.string().trim().max(4000).optional().default(""),
});

// Starts a background generation and returns at once (long requests get cut by shared hosting).
export async function startAiLanding(lang: string, _prev: AiStartState, formData: FormData): Promise<AiStartState> {
  const locale = asLocale(lang);
  const { shop, user } = await requireManager(locale);
  if (!aiConfigured()) return { error: "notConfigured" };
  const parsed = aiStartSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "validation" };
  const d = parsed.data;
  const images = z.array(httpUrl).max(10).catch([]).parse(JSON.parse(d.images || "[]"));

  if (d.source === "product") {
    const [product] = await db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(and(eq(schema.products.id, d.productId), eq(schema.products.shopId, shop.id)));
    if (!product) return { error: "validation" };
  } else {
    if (!d.price) return { error: "price" };
    if (d.source === "images" && images.length === 0) return { error: "noImages" };
    if (d.source === "link" && !d.link) return { error: "validation" };
    if (!(await canAdd(shop.id, "maxProducts"))) return { error: "productLimit" };
  }
  if (!(await canAdd(shop.id, "maxAiPerMonth"))) return { error: "limit" };
  if (!(await canAdd(shop.id, "maxLandingPages"))) return { error: "pageLimit" };

  const jobId = newId();
  await db.insert(schema.aiJobs).values({
    id: jobId,
    shopId: shop.id,
    userId: user.id,
    input: {
      source: d.source,
      productId: d.source === "product" ? d.productId : undefined,
      images,
      link: d.link || undefined,
      price: d.price,
      compareAtPrice: d.compareAtPrice ?? null,
      language: d.language,
      tone: d.tone,
      audience: d.audience,
      notes: d.notes,
    },
  });
  after(() => runLandingJob(jobId));
  return { jobId };
}

export type AiJobStatus = { status: "queued" | "running" | "done" | "failed"; stage?: string | null; landingPageId?: string | null; error?: string | null };

export async function getAiJobStatus(lang: string, jobId: string): Promise<AiJobStatus> {
  const { shop } = await requireManager(asLocale(lang));
  const [job] = await db
    .select()
    .from(schema.aiJobs)
    .where(and(eq(schema.aiJobs.id, jobId), eq(schema.aiJobs.shopId, shop.id)));
  if (!job) return { status: "failed", error: "Job not found" };
  if ((job.status === "running" || job.status === "queued") && Date.now() - job.updatedAt.getTime() > STALE_JOB_MS) {
    return { status: "failed", error: "Timed out (the server may have restarted). Please try again." };
  }
  return { status: job.status, stage: job.stage, landingPageId: job.landingPageId, error: job.error };
}
