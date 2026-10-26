import "server-only";
import { and, asc, count, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/server/db";
import type { ProductStatus } from "./types";

export const PAGE_SIZE = 20;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function listProducts(shopId: string, { q = "", status, page = 1 }: { q?: string; status?: ProductStatus; page?: number }) {
  const p = schema.products;
  const filters: (SQL | undefined)[] = [eq(p.shopId, shopId)];
  if (status) filters.push(eq(p.status, status));
  if (q.trim()) {
    const term = `%${escapeLike(q.trim())}%`;
    filters.push(or(like(p.name, term), like(p.sku, term)));
  }
  const where = and(...filters);
  // Variant count and stock per product in one query
  const v = db
    .select({ productId: schema.productVariants.productId, variantCount: count().as("variant_count"), variantStock: sql<number>`sum(${schema.productVariants.stock})`.as("variant_stock") })
    .from(schema.productVariants)
    .where(eq(schema.productVariants.shopId, shopId))
    .groupBy(schema.productVariants.productId)
    .as("v");
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: p.id,
        name: p.name,
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        images: p.images,
        status: p.status,
        trackStock: p.trackStock,
        stock: p.stock,
        sku: p.sku,
        variantCount: sql<number>`coalesce(${v.variantCount}, 0)`,
        variantStock: sql<number>`coalesce(${v.variantStock}, 0)`,
      })
      .from(p)
      .leftJoin(v, eq(v.productId, p.id))
      .where(where)
      .orderBy(desc(p.createdAt), desc(p.id))
      .limit(PAGE_SIZE)
      .offset((Math.max(1, page) - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(p).where(where),
  ]);
  return {
    total,
    rows: rows.map((r) => {
      const variantCount = Number(r.variantCount);
      return { ...r, variantCount, totalStock: variantCount ? Number(r.variantStock) : r.stock };
    }),
  };
}

export async function getProduct(shopId: string, id: string) {
  const [product] = await db
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.shopId, shopId), eq(schema.products.id, id)));
  if (!product) return null;
  const variants = await db
    .select()
    .from(schema.productVariants)
    .where(and(eq(schema.productVariants.shopId, shopId), eq(schema.productVariants.productId, id)))
    .orderBy(asc(schema.productVariants.position));
  return { ...product, variants };
}

export type ProductWithVariants = NonNullable<Awaited<ReturnType<typeof getProduct>>>;
