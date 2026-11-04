import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { getShopBySlug, type StoreShop } from "./queries";

// The public store API (Store settings → Domain → Allowed origins): a merchant who builds their own storefront on another
// website reads the products and sends orders with the store ID. Browsers may only call it from the store's allowed origins
// (CORS); calls from a server (no Origin header) are accepted like any order form.
export const API_VERSION = "v1";
export { MAX_ORIGINS, cleanOrigin } from "./origins";

export function apiBase() {
  const app = (process.env.APP_URL ?? "").replace(/\/+$/, "");
  return `${app}/api/storefront/${API_VERSION}`;
}

export async function apiShop(storeId: string): Promise<StoreShop | null> {
  if (!/^[\w-]{1,36}$/.test(storeId)) return null;
  const [row] = await db.select({ slug: schema.shops.slug }).from(schema.shops).where(eq(schema.shops.id, storeId));
  return row ? getShopBySlug(row.slug) : null;
}

// CORS headers for this request: the origin echoed back when the store allows it
export function corsHeaders(req: Request, shop: Pick<StoreShop, "apiOrigins"> | null): { ok: boolean; headers: Record<string, string> } {
  const origin = req.headers.get("origin");
  const base = { Vary: "Origin", "Cache-Control": "no-store" };
  if (!origin) return { ok: true, headers: base };
  const allowed = (shop?.apiOrigins ?? []).includes(origin.toLowerCase());
  return {
    ok: allowed,
    headers: allowed ? { ...base, "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "600" } : base,
  };
}

export function apiJson(data: unknown, status: number, headers: Record<string, string>) {
  return Response.json(data, { status, headers });
}

// Shared by every route: the store, the CORS check, then the handler
export async function withStore(req: Request, storeId: string, handle: (shop: StoreShop, headers: Record<string, string>) => Promise<Response>) {
  const shop = await apiShop(storeId);
  const cors = corsHeaders(req, shop);
  if (!shop) return apiJson({ error: "store_not_found" }, 404, cors.headers);
  if (!cors.ok) return apiJson({ error: "origin_not_allowed" }, 403, cors.headers);
  return handle(shop, cors.headers);
}

export async function preflight(req: Request, storeId: string) {
  const cors = corsHeaders(req, await apiShop(storeId));
  return new Response(null, { status: cors.ok ? 204 : 403, headers: cors.headers });
}
