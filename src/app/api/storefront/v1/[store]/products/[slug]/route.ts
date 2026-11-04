import { getStoreProduct } from "@/features/storefront/queries";
import { apiJson, preflight, withStore } from "@/features/storefront/api";
import { descriptionHtml } from "@/lib/rich-text";

// GET /api/storefront/v1/<store>/products/<slug> — one product with its options, variants (the ones on sale) and offers
export async function GET(req: Request, { params }: RouteContext<"/api/storefront/v1/[store]/products/[slug]">) {
  const { store, slug } = await params;
  return withStore(req, store, async (shop, headers) => {
    const p = await getStoreProduct(shop.id, decodeURIComponent(slug));
    if (!p) return apiJson({ error: "product_not_found" }, 404, headers);
    return apiJson(
      {
        product: {
          id: p.id,
          slug: p.slug,
          name: p.name,
          price: p.price,
          compareAtPrice: p.compareAtPrice,
          images: p.images,
          descriptionHtml: descriptionHtml(p.description ?? ""),
          options: p.options.filter((o) => !o.hidden).map((o) => ({ name: o.name, values: o.values.filter((v) => !o.off?.includes(v)), optional: Boolean(o.optional) })),
          variants: p.variants.map((v) => ({ id: v.id, values: v.optionValues, price: v.price, compareAtPrice: v.compareAtPrice, available: !p.trackStock || v.stock > 0 })),
          offers: (p.offers ?? []).filter((o) => !o.off).map((o) => ({ quantity: o.quantity, price: o.price, label: o.label ?? "", freeShipping: Boolean(o.freeShipping) })),
          available: !p.trackStock || p.stock > 0 || p.variants.some((v) => v.stock > 0),
        },
        currency: "DZD",
      },
      200,
      headers,
    );
  });
}

export async function OPTIONS(req: Request, { params }: RouteContext<"/api/storefront/v1/[store]/products/[slug]">) {
  return preflight(req, (await params).store);
}
