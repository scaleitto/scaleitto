"use server";

import { and, eq, inArray, notInArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { db, schema } from "@/server/db";
import { newId, requireSection } from "@/server/auth/context";
import { canAdd } from "@/server/limits";
import { safeAction } from "@/server/errors";
import { fieldErrorsFrom } from "@/lib/validation";
import { asLocale } from "@/i18n";
import { sectionHref } from "@/lib/permissions";
import type { ActionState } from "@/lib/action";
import { productSchema, type ProductInput } from "./validators";
import { combinations, variantTitle } from "./variants";
import { uniqueSlug } from "./slug";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Variants are rebuilt from the options on the server; the form only supplies price/SKU/stock per title.
// Existing rows keep their id (orders will point to them).
async function saveVariants(tx: Tx, shopId: string, productId: string, input: ProductInput) {
  const supplied = new Map(input.variants.map((v) => [v.title, v]));
  const existing = new Map(
    (await tx.select().from(schema.productVariants).where(and(eq(schema.productVariants.shopId, shopId), eq(schema.productVariants.productId, productId)))).map((v) => [v.title, v]),
  );
  const keep: string[] = [];
  for (const [position, values] of combinations(input.options).entries()) {
    const title = variantTitle(values, input.options);
    const data = supplied.get(title);
    const row = { optionValues: values, title, position, sku: data?.sku || null, price: data?.price ?? null, stock: data?.stock ?? 0 };
    const current = existing.get(title);
    if (current) {
      await tx.update(schema.productVariants).set(row).where(eq(schema.productVariants.id, current.id));
      keep.push(current.id);
    } else {
      const id = newId();
      await tx.insert(schema.productVariants).values({ id, productId, shopId, ...row });
      keep.push(id);
    }
  }
  const stale = and(eq(schema.productVariants.shopId, shopId), eq(schema.productVariants.productId, productId));
  await tx.delete(schema.productVariants).where(keep.length ? and(stale, notInArray(schema.productVariants.id, keep)) : stale);
}

function productRow(input: ProductInput) {
  return {
    name: input.name,
    description: input.description || null,
    price: input.price,
    compareAtPrice: input.compareAtPrice,
    costPrice: input.costPrice,
    sku: input.sku || null,
    trackStock: input.trackStock,
    stock: input.stock,
    images: input.images,
    options: input.options,
    offers: input.offers,
    status: input.status,
    shortDescription: input.shortDescription || null,
    descriptionImages: input.descriptionImages.length ? input.descriptionImages : null,
    lowStock: input.lowStock,
    showOutOfStock: input.showOutOfStock,
    carrierAccountId: input.carrierAccountId || null,
    similarIds: input.similar === "chosen" ? input.similarIds : null,
  };
}

// The delivery company and the similar products must belong to the shop
async function checkLinks(shopId: string, input: ProductInput, productId: string | null) {
  if (input.carrierAccountId) {
    const [account] = await db.select({ id: schema.carrierAccounts.id }).from(schema.carrierAccounts).where(and(eq(schema.carrierAccounts.shopId, shopId), eq(schema.carrierAccounts.id, input.carrierAccountId)));
    if (!account) return false;
  }
  const ids = input.similarIds.filter((id) => id !== productId);
  if (ids.length) {
    const found = await db.select({ id: schema.products.id }).from(schema.products).where(and(eq(schema.products.shopId, shopId), inArray(schema.products.id, ids)));
    input.similarIds = found.map((f) => f.id);
  } else input.similarIds = [];
  return true;
}

export async function saveProduct(lang: string, productId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = asLocale(lang);
  const result = await safeAction("products/save", async () => {
    const { shop } = await requireSection(locale, "products");
    const parsed = productSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const input = parsed.data;
    if (!(await checkLinks(shop.id, input, productId))) return { ok: false, error: "notFound" };

    if (productId) {
      const [before] = await db.select({ stock: schema.products.stock }).from(schema.products).where(and(eq(schema.products.shopId, shop.id), eq(schema.products.id, productId)));
      if (!before) return { ok: false, error: "notFound" };
      await db.transaction(async (tx) => {
        const slug = await uniqueSlug(tx, shop.id, input.slug, productId);
        await tx.update(schema.products).set({ ...productRow(input), slug }).where(and(eq(schema.products.shopId, shop.id), eq(schema.products.id, productId)));
        await saveVariants(tx, shop.id, productId, input);
      });
      refresh();
      return { ok: true };
    }

    if (!(await canAdd(shop.id, "maxProducts"))) return { ok: false, error: "limitProducts" };
    const id = newId();
    await db.transaction(async (tx) => {
      const slug = await uniqueSlug(tx, shop.id, input.slug);
      await tx.insert(schema.products).values({ id, shopId: shop.id, slug, ...productRow(input) });
      await saveVariants(tx, shop.id, id, input);
    });
    return { ok: true, message: id };
  });
  // Created → open the list, or a new empty form for "create & add another" (redirect must happen outside safeAction)
  if (!productId && result.ok) redirect(formData.get("intent") === "another" ? `${sectionHref(locale, "products")}/new?created=${result.message}` : `${sectionHref(locale, "products")}?created=1`);
  return result;
}

export async function deleteProduct(lang: string, productId: string): Promise<ActionState> {
  return safeAction("products/delete", async () => {
    const { shop } = await requireSection(asLocale(lang), "products");
    await db.transaction(async (tx) => {
      await tx.delete(schema.productVariants).where(and(eq(schema.productVariants.shopId, shop.id), eq(schema.productVariants.productId, productId)));
      await tx.delete(schema.products).where(and(eq(schema.products.shopId, shop.id), eq(schema.products.id, productId)));
    });
    refresh();
    return { ok: true };
  });
}

export async function duplicateProduct(lang: string, productId: string): Promise<ActionState> {
  const locale = asLocale(lang);
  const result = await safeAction("products/duplicate", async () => {
    const { shop } = await requireSection(locale, "products");
    const [source] = await db.select().from(schema.products).where(and(eq(schema.products.shopId, shop.id), eq(schema.products.id, productId)));
    if (!source) return { ok: false, error: "notFound" };
    if (!(await canAdd(shop.id, "maxProducts"))) return { ok: false, error: "limitProducts" };
    const id = newId();
    await db.transaction(async (tx) => {
      const slug = await uniqueSlug(tx, shop.id, `${source.slug}-copy`);
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = source;
      await tx.insert(schema.products).values({ ...rest, id, slug, name: `${source.name} (2)`, status: "draft" });
      const variants = await tx.select().from(schema.productVariants).where(and(eq(schema.productVariants.shopId, shop.id), eq(schema.productVariants.productId, productId)));
      if (variants.length) await tx.insert(schema.productVariants).values(variants.map((v) => ({ ...v, id: newId(), productId: id })));
    });
    return { ok: true, message: id };
  });
  if (result.ok && result.message) redirect(`${sectionHref(locale, "products")}/${result.message}`);
  return result;
}

// Quick status switch from the list (active ⇄ draft)
export async function setProductsStatus(lang: string, ids: string[], status: "active" | "draft"): Promise<ActionState> {
  return safeAction("products/status", async () => {
    const { shop } = await requireSection(asLocale(lang), "products");
    if (ids.length) await db.update(schema.products).set({ status }).where(and(eq(schema.products.shopId, shop.id), inArray(schema.products.id, ids)));
    refresh();
    return { ok: true };
  });
}
