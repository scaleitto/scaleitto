import "server-only";
import { cache } from "react";
import { and, eq, gt, lte } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { bestPercents, promoted } from "./pricing";

// The percentages running now in a shop, per product (one query per request)
export const runningPercents = cache(async (shopId: string) => {
  const now = new Date();
  const rows = await db
    .select({ percent: schema.promotions.percent, productIds: schema.promotions.productIds })
    .from(schema.promotions)
    .where(and(eq(schema.promotions.shopId, shopId), lte(schema.promotions.startsAt, now), gt(schema.promotions.endsAt, now)));
  return bestPercents(rows);
});

// Products as the store sells them right now (lists, product and landing pages, orders)
export async function withPromotions<P extends { id: string; price: number; compareAtPrice: number | null }>(shopId: string, products: P[]): Promise<P[]> {
  const percents = await runningPercents(shopId);
  return percents.size ? products.map((p) => promoted(p, percents.get(p.id))) : products;
}
export async function withPromotion<P extends { id: string; price: number; compareAtPrice: number | null }>(shopId: string, product: P): Promise<P> {
  return (await withPromotions(shopId, [product]))[0];
}
