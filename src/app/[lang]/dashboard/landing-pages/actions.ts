"use server";

import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { newId, requireManager } from "@/lib/auth";
import { canAdd } from "@/lib/limits";
import { slugify } from "@/lib/format";
import { sectionsSchema } from "@/lib/landing";
import { asLocale, locales } from "@/i18n";
import { aiConfigured, AiNotConfiguredError, AiRequestError } from "@/lib/ai/openai";
import { aiLanguages, aiTones, generateLandingPage } from "@/lib/ai/landing-generator";

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
  const sections = sectionsSchema.parse(JSON.parse(data.sections));
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

export type AiFormState = { error?: "limit" | "pageLimit" | "notConfigured" | "failed" | "validation"; detail?: string };

const aiFormSchema = z.object({
  productId: z.string().min(1),
  language: z.enum(aiLanguages),
  tone: z.enum(aiTones),
  audience: z.string().trim().max(300).optional().default(""),
  notes: z.string().trim().max(4000).optional().default(""),
});

// Writes a full landing page with AI and saves it as a draft for the merchant to review.
export async function generateWithAi(lang: string, _prev: AiFormState, formData: FormData): Promise<AiFormState> {
  const locale = asLocale(lang);
  const { shop, user } = await requireManager(locale);
  if (!aiConfigured()) return { error: "notConfigured" };
  const parsed = aiFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "validation" };
  const d = parsed.data;
  if (!(await canAdd(shop.id, "maxAiPerMonth"))) return { error: "limit" };
  if (!(await canAdd(shop.id, "maxLandingPages"))) return { error: "pageLimit" };

  const [product] = await db
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.id, d.productId), eq(schema.products.shopId, shop.id)));
  if (!product) return { error: "validation" };

  let page;
  try {
    page = await generateLandingPage({
      product: {
        name: product.name,
        description: product.description,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        images: product.images,
        options: product.options,
        offers: product.offers ?? [],
      },
      language: d.language,
      tone: d.tone,
      audience: d.audience,
      notes: d.notes,
    });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) return { error: "notConfigured" };
    console.error("[ai] landing generation failed:", err);
    return { error: "failed", detail: err instanceof AiRequestError ? err.message : undefined };
  }

  const id = newId();
  await db.insert(schema.landingPages).values({
    id,
    shopId: shop.id,
    productId: product.id,
    slug: await uniqueSlug(shop.id, page.title),
    title: page.title,
    sections: page.sections,
    status: "draft",
    locale: d.language === "dz" ? "ar" : d.language,
  });
  await db.insert(schema.aiGenerations).values({
    id: newId(),
    shopId: shop.id,
    userId: user.id,
    kind: "landing_page",
    model: page.model,
    inputTokens: page.inputTokens,
    outputTokens: page.outputTokens,
  });
  redirect(`/${locale}/dashboard/landing-pages/${id}?generated=1`);
}
