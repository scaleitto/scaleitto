import "server-only";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db";

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
    // The card's one-line summary: how many images, where the form is
    const sections = Array.isArray(p.sections) ? (p.sections as { type?: string; hidden?: boolean }[]).filter((s) => !s.hidden) : [];
    const images = sections.filter((s) => s.type === "poster" || s.type === "image").length;
    const formAt = sections.findIndex((s) => s.type === "form");
    return { ...p, sections: undefined, images, formBottom: formAt < 0 || formAt === sections.length - 1, orders: n, conversion: p.views > 0 ? Math.round((n / p.views) * 1000) / 10 : null };
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
