import { NextResponse, type NextRequest } from "next/server";
import { locales, defaultLocale, isLocale } from "@/i18n/config";

const RESERVED_SUBDOMAINS = new Set(["www", "app", "admin", "api"]);

// The platform's own addresses (dashboard, /store/<slug> links): APP_URL, ROOT_DOMAIN, local and IP hosts.
function isPlatformHost(host: string, rootDomain: string) {
  const app = (() => {
    try {
      return new URL(process.env.APP_URL ?? "").hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  return host === app || host === rootDomain || (rootDomain !== "" && host.endsWith(`.${rootDomain}`)) || host === "localhost" || /^[\d.]+$/.test(host) || host.includes(":") || !host.includes(".");
}

function preferredLocale(req: NextRequest) {
  const fromCookie = req.cookies.get("sc_locale")?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const header = req.headers.get("accept-language") ?? "";
  for (const part of header.split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return defaultLocale;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const rootDomain = (process.env.ROOT_DOMAIN ?? "").toLowerCase();

  // <shop>.scaleitto.com → /store/<shop>/...
  if (rootDomain && host.endsWith(`.${rootDomain}`)) {
    const sub = host.slice(0, -(rootDomain.length + 1));
    if (sub && !sub.includes(".") && !RESERVED_SUBDOMAINS.has(sub)) {
      const url = req.nextUrl.clone();
      url.pathname = `/store/${sub}${pathname === "/" ? "" : pathname}`;
      const headers = new Headers(req.headers);
      headers.set("x-store-subdomain", sub);
      return NextResponse.rewrite(url, { request: { headers } });
    }
  }

  const first = pathname.split("/")[1];

  // Any other host is a merchant's own domain: its store is served at the root (the shop is found by
  // its verified domain in getShopBySlug). Shared paths (api, uploads, embed) stay as they are.
  if (host && !isPlatformHost(host, rootDomain)) {
    if (first === "api" || first === "uploads" || first === "embed") return NextResponse.next();
    const domain = host.replace(/^www\./, "");
    const url = req.nextUrl.clone();
    url.pathname = `/store/${domain}${pathname === "/" ? "" : pathname}`;
    const headers = new Headers(req.headers);
    headers.set("x-store-subdomain", domain);
    return NextResponse.rewrite(url, { request: { headers } });
  }

  if (first === "store" || first === "embed" || first === "api" || first === "uploads" || first === "r" || (locales as readonly string[]).includes(first)) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = `/${preferredLocale(req)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // api/ is excluded so uploads are not buffered (and size-limited) by the proxy.
  matcher: ["/((?!_next|api/|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
