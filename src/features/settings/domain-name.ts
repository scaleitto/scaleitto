// No server dependency, so it can be unit-tested.
// What the merchant types ("https://www.MyShop.com/") → "myshop.com"; null when it is not a usable domain
export function normalizeDomain(input: string) {
  const host = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  if (!/^(?=.{4,191}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(host)) return null;
  // The platform's own domains are not merchant domains
  const root = (process.env.ROOT_DOMAIN ?? "").toLowerCase();
  if (root && (host === root || host.endsWith(`.${root}`))) return null;
  return host;
}
