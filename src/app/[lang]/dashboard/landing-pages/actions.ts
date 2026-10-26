"use server";

import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { newId, requireManager } from "@/lib/auth";
import { canAdd } from "@/lib/limits";
import { slugify } from "@/lib/format";
import { sectionsSchema } from "@/lib/landing";
import { asLocale } from "@/i18n";

const formSchema = z.object({
  title: z.string().trim().min(1).max(200),
  productId: z.string().min(1),
  status: z.enum(["active", "draft"]),
  sections: z.string(),
});

async function parse(formData: FormData, shopId: string) {
  const data = formSchema.parse(Object.fromEntries(formData));
  const sections = sectionsSchema.parse(JSON.parse(data.sections));
  const [product] = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(and(eq(schema.products.id, data.productId), eq(schema.products.shopId, shopId)));
  if (!product) throw new Error("Unknown product");
  return { ...data, sections };
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
  });
  redirect(`/${locale}/dashboard/landing-pages`);
}

export async function updateLandingPage(lang: string, id: string, formData: FormData) {
  const locale = asLocale(lang);
  const { shop } = await requireManager(locale);
  const d = await parse(formData, shop.id);
  await db
    .update(schema.landingPages)
    .set({ title: d.title, productId: d.productId, sections: d.sections, status: d.status })
    .where(and(eq(schema.landingPages.id, id), eq(schema.landingPages.shopId, shop.id)));
  redirect(`/${locale}/dashboard/landing-pages`);
}

export async function deleteLandingPage(lang: string, id: string) {
  const locale = asLocale(lang);
  const { shop } = await requireManager(locale);
  await db.delete(schema.landingPages).where(and(eq(schema.landingPages.id, id), eq(schema.landingPages.shopId, shop.id)));
  redirect(`/${locale}/dashboard/landing-pages`);
}
