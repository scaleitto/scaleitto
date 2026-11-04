import { listStoreProducts, storeBase } from "@/features/storefront/queries";
import { apiJson, preflight, withStore } from "@/features/storefront/api";
import { storeUrl } from "@/lib/urls";

// GET /api/storefront/v1/<store>/products — the store's products (active, in stock or shown when sold out)
export async function GET(req: Request, { params }: RouteContext<"/api/storefront/v1/[store]/products">) {
  const { store } = await params;
  return withStore(req, store, async (shop, headers) => {
    const products = await listStoreProducts(shop.id);
    const base = storeUrl(shop) || (await storeBase(shop.slug));
    return apiJson(
      { products: products.map((p) => ({ id: p.id, slug: p.slug, name: p.name, price: p.price, compareAtPrice: p.compareAtPrice, images: p.images, url: `${base}/p/${encodeURIComponent(p.slug)}` })), currency: "DZD" },
      200,
      headers,
    );
  });
}

export async function OPTIONS(req: Request, { params }: RouteContext<"/api/storefront/v1/[store]/products">) {
  return preflight(req, (await params).store);
}
