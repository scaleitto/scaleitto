import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";

export async function listPromotions(shopId: string) {
  return db.select().from(schema.promotions).where(eq(schema.promotions.shopId, shopId)).orderBy(desc(schema.promotions.createdAt)).limit(100);
}

export async function promotionProducts(shopId: string) {
  return db
    .select({ id: schema.products.id, name: schema.products.name, price: schema.products.price, images: schema.products.images, status: schema.products.status })
    .from(schema.products)
    .where(eq(schema.products.shopId, shopId))
    .orderBy(desc(schema.products.createdAt))
    .limit(500);
}
