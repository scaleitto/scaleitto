// Public URL of a shop. With SHOP_SUBDOMAINS=true shops live on <slug>.ROOT_DOMAIN
// (needs wildcard DNS + SSL); otherwise on APP_URL/store/<slug>, which works on any hosting.
export function storeUrl(slug: string) {
  if (process.env.SHOP_SUBDOMAINS === "true" && process.env.ROOT_DOMAIN) return `https://${slug}.${process.env.ROOT_DOMAIN}`;
  return `${(process.env.APP_URL ?? "").replace(/\/$/, "")}/store/${slug}`;
}
