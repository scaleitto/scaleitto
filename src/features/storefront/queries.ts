import "server-only";
import { formFor } from "@/features/order-form/resolve";
import { cache } from "react";
import { headers } from "next/headers";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import type { RateMap } from "@/features/checkout/pricing";
import { planAllowsDomain } from "@/features/settings/domain";

// Active shop by its link, or by its own domain (proxy.ts rewrites <domain>/… to /store/<domain>/…).
// cache() → one query per request even if layout and page both ask.
export const getShopBySlug = cache(async (slugOrDomain: string) => {
  const key = decodeURIComponent(slugOrDomain).toLowerCase();
  if (key.includes(".")) return getShopByDomain(key);
  const [shop] = await db.select().from(schema.shops).where(eq(schema.shops.slug, key));
  return shop && shop.status === "active" ? shop : null;
});

// A domain serves a store only once verified, and while the shop's plan includes custom domains.
async function getShopByDomain(domain: string) {
  const [shop] = await db.select().from(schema.shops).where(eq(schema.shops.customDomain, domain));
  if (!shop || shop.status !== "active" || !shop.domainVerifiedAt) return null;
  return (await planAllowsDomain(shop.id)) ? shop : null;
}

export type StoreShop = NonNullable<Awaited<ReturnType<typeof getShopBySlug>>>;

// On <slug>.scaleitto.com or the shop's own domain links start at "/", on /store/<slug> they need the prefix.
export async function storeBase(slug: string) {
  return (await headers()).get("x-store-subdomain") ? "" : `/store/${slug}`;
}

export async function listStoreProducts(shopId: string) {
  return db
    .select({ id: schema.products.id, slug: schema.products.slug, name: schema.products.name, price: schema.products.price, compareAtPrice: schema.products.compareAtPrice, images: schema.products.images })
    .from(schema.products)
    .where(and(eq(schema.products.shopId, shopId), eq(schema.products.status, "active")))
    .orderBy(desc(schema.products.createdAt));
}

export async function getStoreProduct(shopId: string, slug: string) {
  const [product] = await db
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.shopId, shopId), eq(schema.products.slug, slug), eq(schema.products.status, "active")));
  if (!product) return null;
  const variants = await db
    .select()
    .from(schema.productVariants)
    .where(and(eq(schema.productVariants.shopId, shopId), eq(schema.productVariants.productId, product.id)))
    .orderBy(asc(schema.productVariants.position));
  return { ...product, variants };
}

export async function getShippingRates(shopId: string): Promise<RateMap> {
  const rows = await db.select().from(schema.shippingRates).where(eq(schema.shippingRates.shopId, shopId));
  return Object.fromEntries(rows.map((r) => [r.wilayaCode, { home: r.homePrice, office: r.officePrice }]));
}

// The thank-you page: the order id is a random UUID, so only the customer who ordered knows it.
export async function getOrderSummary(shopId: string, orderId: string) {
  const [order] = await db.select().from(schema.orders).where(and(eq(schema.orders.shopId, shopId), eq(schema.orders.id, orderId)));
  if (!order) return null;
  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id));
  // Landing page orders are shown in the page's language; the thank-you message is the form's (the page's template,
  // else the product's, else the store's — the same form the customer filled)
  const [landing] = order.landingPageId
    ? await db.select({ language: schema.landingPages.language, templateId: schema.landingPages.formTemplateId }).from(schema.landingPages).where(eq(schema.landingPages.id, order.landingPageId))
    : [];
  const productId = items[0]?.productId;
  const [[product], [shop]] = await Promise.all([
    productId ? db.select({ templateId: schema.products.formTemplateId }).from(schema.products).where(and(eq(schema.products.shopId, shopId), eq(schema.products.id, productId))) : Promise.resolve([]),
    db.select({ id: schema.shops.id, orderForm: schema.shops.orderForm }).from(schema.shops).where(eq(schema.shops.id, shopId)),
  ]);
  const form = await formFor(shop, landing?.templateId, product?.templateId);
  return { ...order, items, landing: landing ? { language: landing.language } : null, thankYou: form.thankYou };
}

// A published landing page by its link, with its product (and the product's variants).
export async function getStoreLanding(shopId: string, slug: string) {
  const [page] = await db
    .select()
    .from(schema.landingPages)
    .where(and(eq(schema.landingPages.shopId, shopId), eq(schema.landingPages.slug, slug), eq(schema.landingPages.status, "published")));
  if (!page) return null;
  const [product] = await db.select().from(schema.products).where(and(eq(schema.products.shopId, shopId), eq(schema.products.id, page.productId), eq(schema.products.status, "active")));
  if (!product) return null;
  const variants = await db
    .select()
    .from(schema.productVariants)
    .where(and(eq(schema.productVariants.shopId, shopId), eq(schema.productVariants.productId, product.id)))
    .orderBy(asc(schema.productVariants.position));
  return { page, product: { ...product, variants } };
}
