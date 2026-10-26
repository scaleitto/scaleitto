import { NextResponse, type NextRequest } from "next/server";
import { locales, defaultLocale, isLocale } from "@/i18n/config";

const RESERVED_SUBDOMAINS = new Set(["www", "app", "admin", "api"]);

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
  if (first === "store" || first === "api" || (locales as readonly string[]).includes(first)) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = `/${preferredLocale(req)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
