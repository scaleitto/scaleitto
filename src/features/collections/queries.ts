import "server-only";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { withPromotions } from "@/features/promotions/apply";

const c = schema.collections;
const p = schema.products;
const contains = (id: string) => sql`json_contains(${p.collectionIds}, json_quote(${id}))`;

// The dashboard list, with how many products each holds
export async function listCollections(shopId: string) {
  const rows = await db.select().from(c).where(eq(c.shopId, shopId)).orderBy(asc(c.createdAt));
  const counts = await Promise.all(rows.map((r) => db.select({ n: sql<number>`count(*)` }).from(p).where(and(eq(p.shopId, shopId), contains(r.id)))));
  return rows.map((r, i) => ({ ...r, products: Number(counts[i][0]?.n ?? 0) }));
}

// For the product form: id + title (+ parent, to indent)
export async function collectionChoices(shopId: string) {
  return db.select({ id: c.id, titles: c.titles, parentId: c.parentId }).from(c).where(eq(c.shopId, shopId)).orderBy(asc(c.createdAt));
}

// The store's collection page: the collection, its active sub-collections and the products of both
export async function storeCollection(shopId: string, handle: string) {
  const [collection] = await db.select().from(c).where(and(eq(c.shopId, shopId), eq(c.handle, handle), eq(c.active, true)));
  if (!collection) return null;
  const children = await db.select().from(c).where(and(eq(c.shopId, shopId), eq(c.parentId, collection.id), eq(c.active, true))).orderBy(asc(c.createdAt));
  const ids = [collection.id, ...children.map((x) => x.id)];
  const products = await db
    .select({ id: p.id, slug: p.slug, name: p.name, price: p.price, compareAtPrice: p.compareAtPrice, images: p.images })
    .from(p)
    .where(and(eq(p.shopId, shopId), eq(p.status, "active"), or(...ids.map(contains))))
    .orderBy(desc(p.createdAt));
  return { collection, children, products: await withPromotions(shopId, products) };
}

// Top-level active collections (store home)
export async function storeCollections(shopId: string) {
  return db.select({ id: c.id, handle: c.handle, titles: c.titles, image: c.image }).from(c).where(and(eq(c.shopId, shopId), eq(c.active, true), isNull(c.parentId))).orderBy(asc(c.createdAt));
}

// Only the shop's own collections can be put on a product
export async function ownCollections(shopId: string, ids: string[]) {
  if (!ids.length) return [];
  return (await db.select({ id: c.id }).from(c).where(and(eq(c.shopId, shopId), inArray(c.id, ids)))).map((r) => r.id);
}
