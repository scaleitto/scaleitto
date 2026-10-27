type ShopLink = { slug: string; customDomain?: string | null; domainVerifiedAt?: Date | null };

// Public URL of a shop: its own verified domain; with SHOP_SUBDOMAINS=true <slug>.ROOT_DOMAIN
// (needs wildcard DNS + SSL); otherwise APP_URL/store/<slug>, which works on any hosting.
export function storeUrl(shop: ShopLink) {
  if (shop.customDomain && shop.domainVerifiedAt) return `https://${shop.customDomain}`;
  if (process.env.SHOP_SUBDOMAINS === "true" && process.env.ROOT_DOMAIN) return `https://${shop.slug}.${process.env.ROOT_DOMAIN}`;
  return `${(process.env.APP_URL ?? "").replace(/\/$/, "")}/store/${shop.slug}`;
}
