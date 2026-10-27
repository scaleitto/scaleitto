import "server-only";
import { and, eq, like } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { nextFreeSlug } from "@/lib/format";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// The product's link must be unique in its shop: shoes, shoes-2, shoes-3…
export async function uniqueSlug(tx: Tx, shopId: string, base: string, exceptId?: string) {
  const taken = new Set(
    (
      await tx
        .select({ slug: schema.products.slug, id: schema.products.id })
        .from(schema.products)
        .where(and(eq(schema.products.shopId, shopId), like(schema.products.slug, `${base}%`)))
    )
      .filter((r) => r.id !== exceptId)
      .map((r) => r.slug),
  );
  return nextFreeSlug(base, taken);
}
