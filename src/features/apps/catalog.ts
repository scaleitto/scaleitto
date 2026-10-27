// Turns another platform's product list into products we can create (pure: unit-tested).
// Shopify: the public /products.json of any store. YouCan: the store API (format taken from its docs and
// community SDKs, not verified with a real account yet — the parser accepts several shapes).
import { htmlToText } from "@/lib/html";
import { MAX_IMAGES, MAX_OPTIONS, MAX_VARIANTS } from "@/features/products/constants";

export type CatalogVariant = { values: Record<string, string>; price: number | null; compareAtPrice: number | null; sku: string | null };
export type CatalogProduct = {
  ref: string;
  name: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  images: string[];
  options: { name: string; values: string[] }[];
  variants: CatalogVariant[];
};

const MAX_VALUES = 30;

const money = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};
const str = (v: unknown, max: number) => (typeof v === "string" || typeof v === "number" ? String(v).trim().slice(0, max) : "");

// Keeps the options consistent with the variants, within our limits
function finish(p: Omit<CatalogProduct, "price" | "compareAtPrice"> & { compareAtPrice?: number | null }, fallbackPrice: number | null): CatalogProduct | null {
  let options = p.options
    .filter((o) => o.name && o.values.length)
    .slice(0, MAX_OPTIONS)
    .map((o) => ({ name: o.name.slice(0, 40), values: [...new Set(o.values.map((v) => v.slice(0, 40)).filter(Boolean))].slice(0, MAX_VALUES) }));
  // Too many combinations for our variants: keep the product without options (lowest price)
  if (options.reduce((n, o) => n * o.values.length, 1) > MAX_VARIANTS) options = [];
  const names = new Set(options.map((o) => o.name));
  const variants = options.length
    ? p.variants
        .map((v) => ({ ...v, values: Object.fromEntries(Object.entries(v.values).filter(([k, val]) => names.has(k) && options.find((o) => o.name === k)!.values.includes(val))) }))
        .filter((v) => Object.keys(v.values).length === options.length)
    : [];
  const prices = (variants.length ? variants : p.variants).map((v) => v.price).filter((x): x is number => x != null);
  const price = prices.length ? Math.min(...prices) : fallbackPrice;
  if (!p.name || price == null) return null;
  const compare = p.compareAtPrice ?? p.variants.find((v) => v.compareAtPrice)?.compareAtPrice ?? null;
  return {
    ref: p.ref,
    name: p.name.slice(0, 200),
    description: p.description.slice(0, 20_000),
    price,
    compareAtPrice: compare && compare > price ? compare : null,
    images: [...new Set(p.images)].filter((u) => /^https?:\/\//.test(u)).slice(0, MAX_IMAGES),
    options,
    variants: variants.map((v) => ({ ...v, price: v.price === price ? null : v.price })),
  };
}

type ShopifyProduct = {
  id: number | string;
  title?: string;
  body_html?: string | null;
  options?: { name: string; values?: string[] }[];
  variants?: { option1?: string | null; option2?: string | null; option3?: string | null; price?: string; compare_at_price?: string | null; sku?: string | null }[];
  images?: { src: string }[];
};

export function parseShopify(json: unknown, host: string): CatalogProduct[] {
  const list = (json as { products?: ShopifyProduct[] } | null)?.products ?? [];
  return list.flatMap((p) => {
    // A product without options has one option "Title" / "Default Title"
    const options = (p.options ?? []).filter((o) => !(o.name === "Title" && (o.values ?? []).every((v) => v === "Default Title"))).map((o) => ({ name: str(o.name, 40), values: (o.values ?? []).map((v) => str(v, 40)) }));
    const variants = (p.variants ?? []).map((v) => ({
      values: Object.fromEntries(options.map((o, i) => [o.name, str([v.option1, v.option2, v.option3][i], 40)])),
      price: money(v.price),
      compareAtPrice: money(v.compare_at_price),
      sku: str(v.sku, 80) || null,
    }));
    const product = finish({ ref: `shopify:${host}:${p.id}`, name: str(p.title, 200), description: htmlToText(p.body_html ?? "", 20_000), images: (p.images ?? []).map((i) => i.src), options, variants }, null);
    return product ? [product] : [];
  });
}

type Loose = Record<string, unknown>;
const youcanImage = (img: unknown): string | null => {
  if (typeof img === "string") return img;
  if (!img || typeof img !== "object") return null;
  const o = img as Loose;
  const variations = o.variations as Loose | undefined;
  return (typeof o.url === "string" && o.url) || (typeof o.original === "string" && o.original) || (variations && typeof variations.original === "string" ? variations.original : null) || null;
};

export function parseYoucan(json: unknown): CatalogProduct[] {
  const root = json as Loose | unknown[] | null;
  const list = (Array.isArray(root) ? root : ((root?.data ?? root?.products ?? []) as unknown[])) as Loose[];
  return list.flatMap((p) => {
    const rawVariants = ((p.variants as Loose | undefined)?.data ?? p.variants ?? []) as Loose[];
    const variants = (Array.isArray(rawVariants) ? rawVariants : []).map((v) => {
      const values = (v.variations ?? v.options ?? {}) as Record<string, unknown>;
      return {
        values: Object.fromEntries(Object.entries(typeof values === "object" && !Array.isArray(values) ? values : {}).map(([k, val]) => [str(k, 40), str(val, 40)])),
        price: money(v.price),
        compareAtPrice: money(v.compare_at_price),
        sku: str(v.sku, 80) || null,
      };
    });
    // Options from the variants' values ("default" is YouCan's single variant of a product without options)
    const optionNames = [...new Set(variants.flatMap((v) => Object.keys(v.values)))].filter((n) => n && n.toLowerCase() !== "default");
    const options = optionNames.map((name) => ({ name, values: [...new Set(variants.map((v) => v.values[name]).filter(Boolean))] }));
    const images = ((p.images as unknown[] | undefined) ?? []).map(youcanImage).filter((u): u is string => !!u);
    const thumb = youcanImage(p.thumbnail);
    const product = finish(
      { ref: `youcan:${str(p.id, 100)}`, name: str(p.name ?? p.title, 200), description: htmlToText(str(p.description, 50_000), 20_000), images: thumb ? [thumb, ...images] : images, options, variants, compareAtPrice: money(p.compare_at_price) },
      money(p.price),
    );
    return product && p.id ? [product] : [];
  });
}
