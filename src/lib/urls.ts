type ShopLink = { slug: string; customDomain?: string | null; domainVerifiedAt?: Date | null };

// Public URL of a shop: its own verified domain; with SHOP_SUBDOMAINS=true <slug>.ROOT_DOMAIN
// (needs wildcard DNS + SSL); otherwise APP_URL/store/<slug>, which works on any hosting.
export function storeUrl(shop: ShopLink) {
  if (shop.customDomain && shop.domainVerifiedAt) return `https://${shop.customDomain}`;
  if (process.env.SHOP_SUBDOMAINS === "true" && process.env.ROOT_DOMAIN) return `https://${shop.slug}.${process.env.ROOT_DOMAIN}`;
  return `${(process.env.APP_URL ?? "").replace(/\/$/, "")}/store/${shop.slug}`;
}

// How a new store's link will look, around the slug the merchant types on the sign-up form:
// "<slug>.scaleitto.com" with subdomains, otherwise "scaleitto.com/store/<slug>". A local or IP address
// (a server still set up for testing) shows the platform's name instead.
export function storeLinkParts() {
  const isLocal = (host: string) => !host || /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?|\d+\.\d+\.\d+\.\d+)/.test(host);
  const root = (process.env.ROOT_DOMAIN ?? "").toLowerCase();
  if (process.env.SHOP_SUBDOMAINS === "true" && root && !isLocal(root)) return { prefix: "", suffix: `.${root}` };
  let host = "";
  try {
    host = new URL(process.env.APP_URL ?? "").host;
  } catch {
    // not set
  }
  return { prefix: `${isLocal(host) ? root && !isLocal(root) ? root : "scaleitto.com" : host}/store/`, suffix: "" };
}
