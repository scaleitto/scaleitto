import "server-only";
import { and, eq, like } from "drizzle-orm";
import { db, schema } from "@/server/db";
import type { PageStrategy } from "@/server/db/schema";
import { newId } from "@/server/auth/context";
import { nextFreeSlug, slugify } from "@/lib/format";
import { defaultForm, resolveForm, sanitizeSections } from "./types";

// Landing page writes shared by the editor actions and the AI generator (not server actions themselves).
export async function freeSlug(shopId: string, wanted: string, exceptId?: string) {
  const base = slugify(wanted).slice(0, 100) || "page";
  const rows = await db
    .select({ slug: schema.landingPages.slug, id: schema.landingPages.id })
    .from(schema.landingPages)
    .where(and(eq(schema.landingPages.shopId, shopId), like(schema.landingPages.slug, `${base}%`)));
  return nextFreeSlug(base, new Set(rows.filter((r) => r.id !== exceptId).map((r) => r.slug)));
}

export async function shopProduct(shopId: string, productId: string) {
  const [p] = await db.select().from(schema.products).where(and(eq(schema.products.shopId, shopId), eq(schema.products.id, productId)));
  return p ?? null;
}

// Inserts a page (used by manual creation and by the AI).
export async function insertLandingPage(shopId: string, data: { productId: string; title: string; language: string; color?: string | null; sections: unknown; form?: unknown; status?: "draft" | "published"; strategy?: PageStrategy | null }) {
  const id = newId();
  await db.insert(schema.landingPages).values({
    id,
    shopId,
    productId: data.productId,
    slug: await freeSlug(shopId, data.title),
    title: data.title.slice(0, 200),
    language: data.language,
    color: data.color ?? null,
    status: data.status ?? "draft",
    sections: sanitizeSections(data.sections),
    // New pages start from the store's own order form
    form: resolveForm(data.form ?? (await db.select({ form: schema.shops.orderForm }).from(schema.shops).where(eq(schema.shops.id, shopId)))[0]?.form ?? defaultForm),
    strategy: data.strategy ?? null,
  });
  return id;
}

