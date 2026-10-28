// Pure helpers for reading product pages from other sites (no network here, so they are unit-tested).

const ALIEXPRESS = /(^|\.)aliexpress\.(com|us|ru)$/i;

// A product link as merchants paste it (tracking parameters, regional subdomains…) → the plain product page.
// AliExpress: ar.aliexpress.com/item/123.html?spm=… → https://www.aliexpress.com/item/123.html
export function canonicalProductUrl(input: string): URL {
  const url = new URL(input.trim());
  const ae = url.hostname.match(ALIEXPRESS) && url.pathname.match(/\/item\/(\d+)\.html/);
  if (ae) return new URL(`https://www.aliexpress.com/item/${ae[1]}.html`);
  return url;
}

export const isAliExpress = (url: URL) => ALIEXPRESS.test(url.hostname);

// Anti-bot pages (captcha / "punish") instead of the product
export const isBlockedPage = (finalUrl: string, html: string) => /punish|captcha|_____tmd_____|slide to verify|baxia/i.test(finalUrl) || /x5secdata|captcha-content|nc_1_n1z|baxia-dialog/i.test(html.slice(0, 20_000));

const unescapeJson = (s: string) => {
  try {
    return JSON.parse(`"${s}"`) as string;
  } catch {
    return s;
  }
};

// AliExpress product pages carry their data as JSON inside scripts: "subject" (the title) and "imagePathList".
export function parseAliExpress(html: string): { title: string; images: string[]; price: number | null } | null {
  const title = html.match(/"subject"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1];
  const list = html.match(/"imagePathList"\s*:\s*\[([^\]]*)\]/)?.[1] ?? "";
  const images = [...list.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => unescapeJson(m[1])).map((u) => (u.startsWith("//") ? `https:${u}` : u));
  const priceText = html.match(/"(?:minActivityAmount|minAmount|formatedActivityPrice|salePrice)"\s*:\s*\{?[^}]*?"value"\s*:\s*"?([\d.]+)/)?.[1];
  const price = priceText ? Math.round(Number(priceText)) : null;
  if (!title && !images.length) return null;
  return { title: title ? unescapeJson(title).replace(/\s*-\s*AliExpress.*$/i, "").trim() : "", images, price: price && price > 0 ? price : null };
}

// Cookies a site sets while redirecting (some sites loop until their cookie comes back)
export function mergeCookies(jar: Map<string, string>, setCookies: string[]) {
  for (const header of setCookies) {
    const [pair] = header.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  return jar;
}
export const cookieHeader = (jar: Map<string, string>) => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
