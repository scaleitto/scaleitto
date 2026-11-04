// The visitor's IP address, read in ONE place. Every per-IP rule (order limits, blocked IPs, sign-in attempts, tracking
// lookups) depends on it, so it must not come from a value the visitor can choose.
//
// X-Forwarded-For is a list: each proxy APPENDS the address it received the request from. The first entries are whatever
// the client sent (anyone can write "X-Forwarded-For: 1.2.3.4"); only the LAST entry was written by the proxy in front of
// the app. TRUSTED_PROXY_HOPS = how many proxies sit in front of the app (default 1: the host's web server). Behind
// Cloudflare, CLIENT_IP_HEADER=cf-connecting-ip reads the address Cloudflare saw instead.
type HeaderBag = { get(name: string): string | null };

const IP = /^[0-9a-fA-F:.]{2,45}$/;

export function clientIp(h: HeaderBag): string | null {
  const named = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();
  if (named) {
    const v = h.get(named)?.trim() ?? "";
    return IP.test(v) ? v : null;
  }
  const hops = Math.max(1, Math.min(5, Number(process.env.TRUSTED_PROXY_HOPS) || 1));
  const list = (h.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const fromList = list.length ? list[Math.max(0, list.length - hops)] : "";
  if (IP.test(fromList)) return fromList;
  const real = h.get("x-real-ip")?.trim() ?? "";
  return IP.test(real) ? real : null;
}
