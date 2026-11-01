import "server-only";
import { storeForm } from "@/features/order-form/resolve";
import { cache } from "react";
import { headers } from "next/headers";
import { and, asc, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import type { RateMap } from "@/features/checkout/pricing";
import { applyDelivery, resolveDelivery } from "@/features/delivery/settings";
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
    .where(and(eq(schema.products.shopId, shopId), eq(schema.products.status, "active"), inStock))
    .orderBy(desc(schema.products.createdAt));
}

// Sold-out products leave the store's lists when the merchant turned "show when sold out" off
const inStock = or(
  eq(schema.products.showOutOfStock, true),
  eq(schema.products.trackStock, false),
  sql`(case when exists (select 1 from product_variants pv where pv.product_id = products.id) then exists (select 1 from product_variants pv where pv.product_id = products.id and pv.stock > 0) else products.stock > 0 end)`,
);

// The products under a product page: the merchant's choice, or the store's other products (newest first)
export async function similarProducts(shopId: string, product: { id: string; similarIds: string[] | null }, limit = 4) {
  const p = schema.products;
  const chosen = product.similarIds;
  if (chosen && !chosen.length) return [];
  const rows = await db
    .select({ id: p.id, slug: p.slug, name: p.name, price: p.price, compareAtPrice: p.compareAtPrice, images: p.images })
    .from(p)
    .where(and(eq(p.shopId, shopId), eq(p.status, "active"), ne(p.id, product.id), inStock, chosen ? inArray(p.id, chosen) : undefined))
    .orderBy(desc(p.createdAt))
    .limit(limit);
  return rows;
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

// The delivery prices every form and order uses: the wilaya table shaped by the delivery settings (options, on/off)
export async function getShippingRates(shopId: string): Promise<RateMap> {
  const [rows, [shop]] = await Promise.all([
    db.select().from(schema.shippingRates).where(eq(schema.shippingRates.shopId, shopId)),
    db.select({ delivery: schema.shops.delivery }).from(schema.shops).where(eq(schema.shops.id, shopId)),
  ]);
  const table: RateMap = Object.fromEntries(rows.map((r) => [r.wilayaCode, { home: r.homePrice, office: r.officePrice }]));
  return applyDelivery(table, resolveDelivery(shop?.delivery));
}

// The thank-you page: the order id is a random UUID, so only the customer who ordered knows it.
export async function getOrderSummary(shopId: string, orderId: string) {
  const [order] = await db.select().from(schema.orders).where(and(eq(schema.orders.shopId, shopId), eq(schema.orders.id, orderId)));
  if (!order) return null;
  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id));
  // Landing page orders are shown in the page's language; the thank-you message is the store form's
  const [landing] = order.landingPageId ? await db.select({ language: schema.landingPages.language }).from(schema.landingPages).where(eq(schema.landingPages.id, order.landingPageId)) : [];
  const [shop] = await db.select({ orderForm: schema.shops.orderForm }).from(schema.shops).where(eq(schema.shops.id, shopId));
  const form = storeForm(shop);
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
