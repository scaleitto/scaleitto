import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { toAlgeriaLocal } from "./pricing";

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

// The promotions page: the campaigns with their state now, and the new campaign's default dates (now → in a week)
export async function promotionsView(shopId: string) {
  const [list, products] = await Promise.all([listPromotions(shopId), promotionProducts(shopId)]);
  const now = Date.now();
  return {
    products,
    campaigns: list.map((c) => ({ ...c, state: (c.endsAt.getTime() <= now ? "ended" : c.startsAt.getTime() > now ? "scheduled" : "running") as "ended" | "scheduled" | "running" })),
    defaults: { start: toAlgeriaLocal(new Date(now)), end: toAlgeriaLocal(new Date(now + 7 * 86400_000)) },
  };
}
