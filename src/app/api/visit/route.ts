import { and, eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db, schema } from "@/server/db";
import { algeriaParts } from "@/lib/time";
import { isBotAgent } from "@/features/checkout/risk";

const UUID = /^[0-9a-f-]{36}$/;
const COOKIE = "sc_v";
const MAX_KEYS = 40;

// The referring site's host ("direct" when there is none or it is unreadable)
function sourceOf(ref: unknown) {
  if (typeof ref !== "string" || !ref) return "direct";
  try {
    return new URL(ref).hostname.replace(/^www\./, "").slice(0, 100) || "direct";
  } catch {
    return "direct";
  }
}

// One storefront page view (sent by VisitPing): an impression always, a visitor once per Algeria day and page key
// (the keys seen today live in a cookie, so nothing personal is stored on the server)
export async function POST(req: Request) {
  if (isBotAgent(req.headers.get("user-agent"))) return Response.json({ ok: true });
  const body = (await req.json().catch(() => null)) as { shop?: unknown; product?: unknown; ref?: unknown } | null;
  const shopId = typeof body?.shop === "string" && UUID.test(body.shop) ? body.shop : null;
  if (!shopId) return Response.json({ ok: false }, { status: 400 });
  let productId = typeof body?.product === "string" && UUID.test(body.product) ? body.product : "";
  const [shop] = await db.select({ id: schema.shops.id }).from(schema.shops).where(and(eq(schema.shops.id, shopId), eq(schema.shops.status, "active")));
  if (!shop) return Response.json({ ok: false }, { status: 404 });
  if (productId) {
    const [p] = await db.select({ id: schema.products.id }).from(schema.products).where(and(eq(schema.products.shopId, shopId), eq(schema.products.id, productId)));
    if (!p) productId = "";
  }
  const day = algeriaParts(new Date()).day;
  const jar = await cookies();
  const [cookieDay, list = ""] = (jar.get(COOKIE)?.value ?? "").split(":");
  const seen = cookieDay === day ? list.split(",").filter(Boolean) : [];
  const key = `${shopId.slice(0, 8)}${productId.slice(0, 8)}`;
  const newVisitor = !seen.includes(key);
  if (newVisitor) jar.set(COOKIE, `${day}:${[...seen, key].slice(-MAX_KEYS).join(",")}`, { path: "/", maxAge: 60 * 60 * 26, sameSite: "lax", httpOnly: true });
  await db
    .insert(schema.pageViews)
    .values({ shopId, day, productId, source: sourceOf(body?.ref), impressions: 1, visitors: newVisitor ? 1 : 0 })
    .onDuplicateKeyUpdate({ set: { impressions: sql`${schema.pageViews.impressions} + 1`, visitors: sql`${schema.pageViews.visitors} + ${newVisitor ? 1 : 0}` } });
  return Response.json({ ok: true });
}
