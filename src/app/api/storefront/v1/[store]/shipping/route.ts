import { getShippingRates } from "@/features/storefront/queries";
import { apiJson, preflight, withStore } from "@/features/storefront/api";
import { wilayas } from "@/lib/wilayas";

// GET /api/storefront/v1/<store>/shipping — the 69 wilayas with the home / desk price (null = not delivered there)
export async function GET(req: Request, { params }: RouteContext<"/api/storefront/v1/[store]/shipping">) {
  const { store } = await params;
  return withStore(req, store, async (shop, headers) => {
    const rates = await getShippingRates(shop.id);
    const free = Object.keys(rates).length === 0;
    return apiJson(
      { wilayas: wilayas.map((w) => ({ code: w.code, name: { ar: w.ar, fr: w.fr }, home: free ? 0 : (rates[w.code]?.home ?? null), office: free ? 0 : (rates[w.code]?.office ?? null) })), currency: "DZD" },
      200,
      headers,
    );
  });
}

export async function OPTIONS(req: Request, { params }: RouteContext<"/api/storefront/v1/[store]/shipping">) {
  return preflight(req, (await params).store);
}
