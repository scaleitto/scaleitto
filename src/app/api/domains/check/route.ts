import { NextResponse } from "next/server";
import { getShopBySlug } from "@/features/storefront/queries";

// For a reverse proxy issuing certificates on demand (e.g. Caddy "on_demand_tls ask" on a VPS):
// 200 only for verified domains of active shops whose plan allows it, so no certificate is made for anything else.
export async function GET(req: Request) {
  const domain = new URL(req.url).searchParams.get("domain")?.toLowerCase().replace(/^www\./, "") ?? "";
  const shop = domain.includes(".") ? await getShopBySlug(domain) : null;
  return shop ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false }, { status: 404 });
}
