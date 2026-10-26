import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

export const getShopBySlug = cache(async (slug: string) => {
  const [shop] = await db.select().from(schema.shops).where(eq(schema.shops.slug, slug.toLowerCase()));
  return shop && shop.status === "active" ? shop : null;
});

// On <slug>.scaleitto.com links start at "/", on /store/<slug> they need the prefix.
export async function storeBase(slug: string) {
  return (await headers()).get("x-store-subdomain") ? "" : `/store/${slug}`;
}
