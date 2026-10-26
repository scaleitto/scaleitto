"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { newId, requireManager } from "@/lib/auth";
import { canAdd } from "@/lib/limits";
import { slugify } from "@/lib/format";
import { asLocale } from "@/i18n";

const intOrNull = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(0).nullable());

const variantSchema = z.object({
  optionValues: z.record(z.string(), z.string()),
  title: z.string().max(200),
  sku: z.string().max(80).optional().default(""),
  price: intOrNull,
  stock: z.coerce.number().int().min(0).default(0),
});

const productSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(20000).optional().default(""),
  price: z.coerce.number().int().min(0),
  compareAtPrice: intOrNull,
  sku: z.string().trim().max(80).optional().default(""),
  stock: z.coerce.number().int().min(0).default(0),
  trackStock: z.preprocess((v) => v === "on", z.boolean()),
  status: z.enum(["active", "draft"]),
  images: z.string().optional().default(""),
  options: z.string().default("[]"),
  variants: z.string().default("[]"),
  offers: z.string().default("[]"),
  upsellProductId: z.string().optional().default(""),
  upsellPrice: intOrNull,
});

const offersSchema = z
  .array(z.object({ quantity: z.coerce.number().int().min(2).max(20), price: z.coerce.number().int().min(0), label: z.string().trim().max(60).optional() }))
  .max(5);

async function parseForm(formData: FormData, shopId: string, productId?: string) {
  const data = productSchema.parse(Object.fromEntries(formData));
  const options = z
    .array(z.object({ name: z.string().trim().min(1).max(60), values: z.array(z.string().trim().min(1).max(60)).min(1) }))
    .max(3)
    .parse(JSON.parse(data.options));
  const variants = z.array(variantSchema).max(100).parse(JSON.parse(data.variants));
  const images = data.images
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//.test(s))
    .slice(0, 10);
  const offers = offersSchema
    .parse(JSON.parse(data.offers))
    .sort((a, b) => a.quantity - b.quantity)
    .filter((o, i, all) => all.findIndex((x) => x.quantity === o.quantity) === i);

  // The upsell product must belong to the same shop and not be the product itself.
  let upsellProductId: string | null = null;
  if (data.upsellProductId && data.upsellProductId !== productId) {
    const [p] = await db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(and(eq(schema.products.id, data.upsellProductId), eq(schema.products.shopId, shopId)));
    upsellProductId = p?.id ?? null;
  }
  const upsell = { upsellProductId, upsellPrice: upsellProductId ? data.upsellPrice : null };
  return { data, options, variants, images, offers: offers.length ? offers : null, upsell };
}

async function uniqueSlug(shopId: string, name: string, excludeId?: string) {
  const base = slugify(name);
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const [taken] = await db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(and(eq(schema.products.shopId, shopId), eq(schema.products.slug, slug), excludeId ? ne(schema.products.id, excludeId) : undefined));
    if (!taken) return slug;
  }
  return `${base}-${Date.now()}`;
}

async function writeVariants(shopId: string, productId: string, variants: z.infer<typeof variantSchema>[]) {
  await db.delete(schema.productVariants).where(and(eq(schema.productVariants.productId, productId), eq(schema.productVariants.shopId, shopId)));
  if (variants.length) {
    await db.insert(schema.productVariants).values(
      variants.map((v) => ({
        id: newId(),
        productId,
        shopId,
        optionValues: v.optionValues,
        title: v.title,
        sku: v.sku || null,
        price: v.price,
        stock: v.stock,
      })),
    );
  }
}

export async function createProduct(lang: string, formData: FormData) {
  const locale = asLocale(lang);
  const { shop } = await requireManager(locale);
  if (!(await canAdd(shop.id, "maxProducts"))) redirect(`/${locale}/dashboard/products?error=limit`);

  const { data, options, variants, images, offers, upsell } = await parseForm(formData, shop.id);
  const id = newId();
  await db.insert(schema.products).values({
    id,
    shopId: shop.id,
    name: data.name,
    slug: await uniqueSlug(shop.id, data.name),
    description: data.description,
    price: data.price,
    compareAtPrice: data.compareAtPrice,
    sku: data.sku || null,
    stock: data.stock,
    trackStock: data.trackStock,
    status: data.status,
    images,
    options,
    offers,
    ...upsell,
  });
  await writeVariants(shop.id, id, options.length ? variants : []);
  revalidatePath(`/${locale}/dashboard/products`);
  redirect(`/${locale}/dashboard/products`);
}

export async function updateProduct(lang: string, productId: string, formData: FormData) {
  const locale = asLocale(lang);
  const { shop } = await requireManager(locale);
  const { data, options, variants, images, offers, upsell } = await parseForm(formData, shop.id, productId);
  const result = await db
    .update(schema.products)
    .set({
      name: data.name,
      description: data.description,
      price: data.price,
      compareAtPrice: data.compareAtPrice,
      sku: data.sku || null,
      stock: data.stock,
      trackStock: data.trackStock,
      status: data.status,
      images,
      options,
      offers,
      ...upsell,
    })
    .where(and(eq(schema.products.id, productId), eq(schema.products.shopId, shop.id)));
  if (result[0].affectedRows === 0) redirect(`/${locale}/dashboard/products`);
  await writeVariants(shop.id, productId, options.length ? variants : []);
  redirect(`/${locale}/dashboard/products`);
}

export async function deleteProduct(lang: string, productId: string) {
  const locale = asLocale(lang);
  const { shop } = await requireManager(locale);
  await db.delete(schema.products).where(and(eq(schema.products.id, productId), eq(schema.products.shopId, shop.id)));
  await db.delete(schema.productVariants).where(and(eq(schema.productVariants.productId, productId), eq(schema.productVariants.shopId, shop.id)));
  redirect(`/${locale}/dashboard/products`);
}
