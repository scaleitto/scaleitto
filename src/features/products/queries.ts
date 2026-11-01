import "server-only";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";

export const PAGE_SIZE = 20;


export async function listProducts(shopId: string, page = 1) {
  const p = schema.products;
  const where = eq(p.shopId, shopId);
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
        slug: p.slug,
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        images: p.images,
        status: p.status,
        trackStock: p.trackStock,
        stock: p.stock,
        sku: p.sku,
        createdAt: p.createdAt,
        // Pieces sold: every order that still counts (not cancelled, flagged or abandoned)
        units: sql<number>`(select coalesce(sum(oi.quantity), 0) from order_items oi join orders o on o.id = oi.order_id where oi.product_id = products.id and o.status not in ('cancelled', 'flagged', 'abandoned'))`,
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
      return { ...r, variantCount, units: Number(r.units), totalStock: variantCount ? Number(r.variantStock) : r.stock };
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

// What the product editor needs besides the product: the delivery companies and the store's other products
export async function editorData(shopId: string, productId: string | null) {
  const [accounts, others] = await Promise.all([
    db.select({ id: schema.carrierAccounts.id, carrier: schema.carrierAccounts.carrier }).from(schema.carrierAccounts).where(eq(schema.carrierAccounts.shopId, shopId)),
    db
      .select({ id: schema.products.id, name: schema.products.name, image: sql<string | null>`json_unquote(json_extract(${schema.products.images}, '$[0]'))` })
      .from(schema.products)
      .where(eq(schema.products.shopId, shopId))
      .orderBy(desc(schema.products.createdAt)),
  ]);
  return { accounts, others: others.filter((o) => o.id !== productId) };
}
