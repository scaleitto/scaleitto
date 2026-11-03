import "server-only";
import { lookup } from "node:dns/promises";
import net from "node:net";
import { cookieHeader, mergeCookies } from "@/lib/cookies";

// Fetching URLs typed by merchants must never reach the server's own network
// (localhost, cPanel services, cloud metadata…): every hop is checked.

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

export class SafeFetchError extends Error {}

async function assertPublic(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new SafeFetchError("Only http(s) links are allowed");
  if (process.env.ALLOW_PRIVATE_FETCH === "1") return; // local tests only
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new SafeFetchError("Could not resolve host");
  if (addresses.some((a) => isPrivateIp(a.address))) throw new SafeFetchError("This address is not allowed");
}

export async function safeFetch(
  input: string,
  { maxBytes = 3 * 1024 * 1024, timeoutMs = 15_000, accept = "*/*" }: { maxBytes?: number; timeoutMs?: number; accept?: string } = {},
): Promise<{ url: string; status: number; contentType: string; body: Buffer }> {
  let url = new URL(input);
  const signal = AbortSignal.timeout(timeoutMs);
  // Cookies set along the redirects are sent back, like a browser (some sites loop until they get them)
  const jar = new Map<string, string>();
  for (let hop = 0; hop < 10; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal,
      headers: {
        Accept: accept,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
        "Accept-Language": "fr,ar;q=0.9,en;q=0.8",
        ...(jar.size ? { Cookie: cookieHeader(jar) } : {}),
      },
    });
    mergeCookies(jar, res.headers.getSetCookie?.() ?? []);
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    // Read at most maxBytes so a huge page cannot exhaust memory.
    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = res.body?.getReader();
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) {
        await reader.cancel();
        throw new SafeFetchError("Response too large");
      }
      chunks.push(value);
    }
    return { url: url.toString(), status: res.status, contentType: res.headers.get("content-type") ?? "", body: Buffer.concat(chunks) };
  }
  throw new SafeFetchError("Too many redirects");
}

// POSTs JSON to a merchant's URL (Apps Script, webhook) with the same checks on every hop.
// Like browsers, a 301/302/303 answer is followed with a GET (Google Apps Script returns its result that way).
export async function safePostJson(
  input: string,
  body: string,
  { headers = {}, timeoutMs = 15_000, maxBytes = 256 * 1024 }: { headers?: Record<string, string>; timeoutMs?: number; maxBytes?: number } = {},
): Promise<{ status: number; contentType: string; text: string }> {
  let url = new URL(input);
  const signal = AbortSignal.timeout(timeoutMs);
  let method: "POST" | "GET" = "POST";
  for (let hop = 0; hop < 5; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      method,
      redirect: "manual",
      signal,
      headers: method === "POST" ? { "Content-Type": "application/json", "User-Agent": "Scaleitto", ...headers } : { "User-Agent": "Scaleitto" },
      body: method === "POST" ? body : undefined,
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      if (res.status !== 307 && res.status !== 308) method = "GET";
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) throw new SafeFetchError("Response too large");
    return { status: res.status, contentType: res.headers.get("content-type") ?? "", text: buf.toString("utf8") };
  }
  throw new SafeFetchError("Too many redirects");
}

// An API call to a merchant's platform (Shopify Admin API, WooCommerce REST API): any method, the caller's headers, no
// redirect followed (an API that redirects is answered as is), the same public-address check and a size limit.
export async function safeRequest(
  input: string,
  { method = "GET", headers = {}, body, timeoutMs = 15_000, maxBytes = 512 * 1024 }: { method?: string; headers?: Record<string, string>; body?: string; timeoutMs?: number; maxBytes?: number } = {},
): Promise<{ status: number; text: string; json: unknown }> {
  const url = new URL(input);
  await assertPublic(url);
  const res = await fetch(url, { method, redirect: "manual", signal: AbortSignal.timeout(timeoutMs), headers: { "User-Agent": "Scaleitto", Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}), ...headers }, body });
  const text = (await res.text()).slice(0, maxBytes);
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON
  }
  return { status: res.status, text, json };
}
