import "server-only";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { sanitizeSections, type VersionKey } from "./types";

// The shop's landing pages with their visits, orders and conversion rate.
export async function listLandingPages(shopId: string) {
  const l = schema.landingPages;
  const pages = await db
    .select({ id: l.id, title: l.title, slug: l.slug, status: l.status, views: l.views, language: l.language, updatedAt: l.updatedAt, sections: l.sections, productId: l.productId, productName: schema.products.name, productImages: schema.products.images })
    .from(l)
    .leftJoin(schema.products, eq(schema.products.id, l.productId))
    .where(eq(l.shopId, shopId))
    .orderBy(desc(l.updatedAt));
  const ids = pages.map((p) => p.id);
  const orders = ids.length
    ? await db
        .select({ id: schema.orders.landingPageId, n: count() })
        .from(schema.orders)
        .where(and(eq(schema.orders.shopId, shopId), inArray(schema.orders.landingPageId, ids)))
        .groupBy(schema.orders.landingPageId)
    : [];
  return pages.map((p) => {
    const n = orders.find((o) => o.id === p.id)?.n ?? 0;
    // The card's one-line summary: how many images, where the form is (form, sticky button and thank-you window
    // count as the end of the page)
    const sections = sanitizeSections(p.sections).filter((s) => !s.hidden);
    const images = sections.filter((s) => s.type === "image").length;
    const content = sections.filter((s) => s.type !== "sticky" && s.type !== "thankYou");
    const formAt = content.findIndex((s) => s.type === "form");
    return { ...p, sections: undefined, images, formBottom: formAt < 0 || formAt === content.length - 1, orders: n, conversion: p.views > 0 ? Math.round((n / p.views) * 1000) / 10 : null };
  });
}

export async function getLandingPage(shopId: string, id: string) {
  const [page] = await db.select().from(schema.landingPages).where(and(eq(schema.landingPages.shopId, shopId), eq(schema.landingPages.id, id)));
  return page ?? null;
}

// Products a page can sell (active and draft, newest first)
export async function productChoices(shopId: string) {
  return db
    .select({ id: schema.products.id, name: schema.products.name, price: schema.products.price, compareAtPrice: schema.products.compareAtPrice, images: schema.products.images, status: schema.products.status })
    .from(schema.products)
    .where(eq(schema.products.shopId, shopId))
    .orderBy(desc(schema.products.createdAt));
}

// The page's product with its variants, for the editor preview (any status).
export async function landingProduct(shopId: string, productId: string) {
  const [product] = await db.select().from(schema.products).where(and(eq(schema.products.shopId, shopId), eq(schema.products.id, productId)));
  if (!product) return null;
  const variants = await db
    .select()
    .from(schema.productVariants)
    .where(and(eq(schema.productVariants.shopId, shopId), eq(schema.productVariants.productId, product.id)))
    .orderBy(asc(schema.productVariants.position));
  return { ...product, variants };
}

// Visits and orders of each version of a page (A, B, C), to compare them in the builder and the list
export async function versionStats(shopId: string, pageId: string) {
  const [views, orders] = await Promise.all([
    db.select({ version: schema.landingStats.version, views: schema.landingStats.views }).from(schema.landingStats).where(and(eq(schema.landingStats.shopId, shopId), eq(schema.landingStats.pageId, pageId))),
    db
      .select({ version: schema.orders.landingVersion, n: count() })
      .from(schema.orders)
      .where(and(eq(schema.orders.shopId, shopId), eq(schema.orders.landingPageId, pageId)))
      .groupBy(schema.orders.landingVersion),
  ]);
  return Object.fromEntries(
    (["A", "B", "C"] as VersionKey[]).map((k) => {
      const v = views.find((x) => x.version === k)?.views ?? 0;
      const o = orders.find((x) => (x.version ?? "A") === k)?.n ?? 0;
      return [k, { views: v, orders: o, rate: v > 0 ? Math.round((o / v) * 1000) / 10 : null }];
    }),
  ) as Record<VersionKey, { views: number; orders: number; rate: number | null }>;
}
