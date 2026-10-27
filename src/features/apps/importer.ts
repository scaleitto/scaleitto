import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { newId } from "@/server/auth/context";
import { safeFetch, SafeFetchError } from "@/server/safe-fetch";
import { downloadImages } from "@/server/product-import";
import { slugify } from "@/lib/format";
import { uniqueSlug } from "@/features/products/slug";
import { combinations, variantTitle } from "@/features/products/variants";
import { parseShopify, parseYoucan, type CatalogProduct } from "./catalog";

export class ImportError extends Error {}
export const MAX_IMPORT = 500;

// Shopify: any store's public catalog, 250 products per page.
export async function fetchShopify(storeUrl: string): Promise<CatalogProduct[]> {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//.test(storeUrl.trim()) ? storeUrl.trim() : `https://${storeUrl.trim()}`);
  } catch {
    throw new ImportError("url");
  }
  const out: CatalogProduct[] = [];
  for (let page = 1; page <= 8 && out.length < MAX_IMPORT; page++) {
    const res = await safeFetch(`${url.origin}/products.json?limit=250&page=${page}`, { accept: "application/json", maxBytes: 10 * 1024 * 1024, timeoutMs: 20_000 }).catch((err: unknown) => {
      throw new ImportError(err instanceof SafeFetchError ? err.message : "unreachable");
    });
    if (res.status !== 200 || !res.contentType.includes("json")) {
      if (page === 1) throw new ImportError(`HTTP ${res.status}`);
      break;
    }
    const products = parseShopify(JSON.parse(res.body.toString("utf8")), url.host);
    if (!products.length) break;
    out.push(...products);
  }
  return out.slice(0, MAX_IMPORT);
}

// YouCan: the store API with the seller's access token. E2E_APPS_URL points it at a fake server in tests.
export async function fetchYoucan(token: string): Promise<CatalogProduct[]> {
  const base = process.env.E2E_APPS_URL ? `${process.env.E2E_APPS_URL}/youcan` : "https://api.youcan.shop";
  const out: CatalogProduct[] = [];
  for (let page = 1; page <= 20 && out.length < MAX_IMPORT; page++) {
    const res = await fetch(`${base}/products?include=variants&limit=50&page=${page}`, {
      headers: { Authorization: `Bearer ${token.trim()}`, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    }).catch(() => {
      throw new ImportError("unreachable");
    });
    if (res.status === 401 || res.status === 403) throw new ImportError("token");
    if (!res.ok) throw new ImportError(`HTTP ${res.status}`);
    const json = (await res.json().catch(() => null)) as { meta?: { pagination?: { total_pages?: number } } } | null;
    const products = parseYoucan(json);
    out.push(...products);
    const pages = json?.meta?.pagination?.total_pages;
    if (!products.length || (pages != null && page >= pages)) break;
  }
  return out.slice(0, MAX_IMPORT);
}

// Creates one imported product (as a draft, so the merchant checks prices first) with its photos copied
// to our storage. Returns "exists" when it was already imported.
export async function createImportedProduct(shopId: string, p: CatalogProduct): Promise<"created" | "exists"> {
  const [existing] = await db.select({ id: schema.products.id }).from(schema.products).where(and(eq(schema.products.shopId, shopId), eq(schema.products.externalRef, p.ref)));
  if (existing) return "exists";
  const images = await downloadImages(shopId, p.images, 6);
  const supplied = new Map(p.variants.map((v) => [variantTitle(v.values, p.options), v]));
  const id = newId();
  const created = await db
    .transaction(async (tx) => {
      await tx.insert(schema.products).values({
        id,
        shopId,
        name: p.name,
        slug: await uniqueSlug(tx, shopId, slugify(p.name)),
        description: p.description || null,
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        images,
        options: p.options,
        offers: [],
        status: "draft",
        externalRef: p.ref,
      });
      const rows = combinations(p.options).map((values, position) => {
        const title = variantTitle(values, p.options);
        const source = supplied.get(title);
        return { id: newId(), productId: id, shopId, optionValues: values, title, position, sku: source?.sku ?? null, price: source?.price ?? null, stock: 0 };
      });
      if (rows.length) await tx.insert(schema.productVariants).values(rows);
      return true;
    })
    // Two imports at the same time: the unique (shop, external_ref) index keeps one
    .catch((err: { code?: string }) => {
      if (err?.code === "ER_DUP_ENTRY") return false;
      throw err;
    });
  return created ? "created" : "exists";
}
