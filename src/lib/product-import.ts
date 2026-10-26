import "server-only";
import { safeFetch, SafeFetchError } from "./safe-fetch";

export type ImportedProduct = {
  title: string;
  description: string;
  price: number | null;
  currency: string | null;
  images: string[];
  sourceUrl: string;
};

const decodeEntities = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

// HTML → readable plain text (keeps line breaks of paragraphs and list items).
export function htmlToText(html: string) {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(br|\/p|\/li|\/h\d|\/div)[^>]*>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
    .slice(0, 4000);
}

function metaContent(html: string, key: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, "gi");
  for (const tag of html.match(re) ?? []) {
    const m = tag.match(/content=["']([^"']*)["']/i);
    if (m) out.push(decodeEntities(m[1]));
  }
  return out;
}

type JsonLd = Record<string, unknown>;

function findLdProduct(html: string): JsonLd | null {
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1].trim());
      const queue: unknown[] = Array.isArray(data) ? data : [data];
      while (queue.length) {
        const node = queue.shift() as JsonLd | null;
        if (!node || typeof node !== "object") continue;
        const type = node["@type"];
        if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) return node;
        if (Array.isArray(node["@graph"])) queue.push(...(node["@graph"] as unknown[]));
      }
    } catch {
      // ignore broken JSON-LD blocks
    }
  }
  return null;
}

const ldImages = (img: unknown): string[] =>
  !img ? [] : typeof img === "string" ? [img] : Array.isArray(img) ? img.flatMap(ldImages) : typeof img === "object" && "url" in (img as JsonLd) ? [String((img as JsonLd).url)] : [];

function ldPrice(offers: unknown): { price: number | null; currency: string | null } {
  const o = (Array.isArray(offers) ? offers[0] : offers) as JsonLd | undefined;
  if (!o) return { price: null, currency: null };
  const raw = o.price ?? o.lowPrice ?? (o.priceSpecification as JsonLd | undefined)?.price;
  const price = raw != null ? Number(String(raw).replace(/[^\d.]/g, "")) : NaN;
  return { price: Number.isFinite(price) && price > 0 ? Math.round(price) : null, currency: o.priceCurrency ? String(o.priceCurrency) : null };
}

const absolutize = (urls: string[], base: string) =>
  [...new Set(urls.map((u) => { try { return new URL(u.startsWith("//") ? `https:${u}` : u, base).toString(); } catch { return ""; } }))]
    .filter((u) => /^https?:\/\//.test(u))
    .slice(0, 8);

// Shopify stores expose every product as JSON at /products/<handle>.json
async function tryShopify(url: URL): Promise<ImportedProduct | null> {
  const m = url.pathname.match(/\/products\/([^/?#.]+)/);
  if (!m) return null;
  try {
    const res = await safeFetch(`${url.origin}/products/${m[1]}.json`, { accept: "application/json" });
    if (res.status !== 200 || !res.contentType.includes("json")) return null;
    const p = (JSON.parse(res.body.toString("utf8")) as { product?: { title: string; body_html: string; images: { src: string }[]; variants: { price: string }[] } }).product;
    if (!p?.title) return null;
    const price = Number(p.variants?.[0]?.price);
    return {
      title: p.title,
      description: htmlToText(p.body_html ?? ""),
      price: Number.isFinite(price) && price > 0 ? Math.round(price) : null,
      currency: null,
      images: absolutize(p.images?.map((i) => i.src) ?? [], url.toString()),
      sourceUrl: url.toString(),
    };
  } catch {
    return null;
  }
}

export async function importProductFromUrl(input: string): Promise<ImportedProduct> {
  const url = new URL(input.trim());
  const shopify = await tryShopify(url);
  if (shopify) return shopify;

  const res = await safeFetch(url.toString(), { accept: "text/html,application/xhtml+xml" });
  if (res.status >= 400) throw new SafeFetchError(`The page answered HTTP ${res.status}`);
  const html = res.body.toString("utf8");

  const ld = findLdProduct(html);
  const title =
    (ld?.name ? String(ld.name) : "") || metaContent(html, "og:title")[0] || decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "").trim();
  const description = htmlToText(
    (ld?.description ? String(ld.description) : "") || metaContent(html, "og:description")[0] || metaContent(html, "description")[0] || "",
  );
  const { price, currency } = ld ? ldPrice(ld.offers) : { price: null, currency: null };
  const metaPrice = Number(metaContent(html, "product:price:amount")[0]);
  const images = absolutize([...ldImages(ld?.image), ...metaContent(html, "og:image")], res.url);

  if (!title) throw new SafeFetchError("No product information found on this page");
  return {
    title: title.slice(0, 200),
    description,
    price: price ?? (Number.isFinite(metaPrice) && metaPrice > 0 ? Math.round(metaPrice) : null),
    currency: currency ?? metaContent(html, "product:price:currency")[0] ?? null,
    images,
    sourceUrl: res.url,
  };
}

// Copies remote product images into our own uploads (so pages don't depend on the source site).
export async function downloadImages(shopId: string, urls: string[], max = 6): Promise<string[]> {
  const { saveImage, MAX_UPLOAD_BYTES } = await import("./storage");
  const saved: string[] = [];
  for (const url of urls.slice(0, max)) {
    try {
      const res = await safeFetch(url, { maxBytes: MAX_UPLOAD_BYTES, accept: "image/*" });
      if (res.status === 200) saved.push(await saveImage(shopId, res.body));
    } catch {
      // skip images that cannot be downloaded or are not real images
    }
  }
  return saved;
}
