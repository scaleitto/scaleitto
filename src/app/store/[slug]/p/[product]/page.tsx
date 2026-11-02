import type { Metadata } from "next";
import { VisitPing } from "@/features/analytics/VisitPing";
import { notFound } from "next/navigation";
import { BadgeCheck, Truck } from "lucide-react";
import {
  getShippingRates,
  getShopBySlug,
  getStoreProduct,
  similarProducts,
  storeBase,
} from "@/features/storefront/queries";
import { shopLocale } from "@/features/storefront/StoreShell";
import { Gallery } from "@/features/storefront/Gallery";
import { CheckoutForm } from "@/features/storefront/CheckoutForm";
import { saveLead, submitOrder } from "@/features/checkout/actions";
import { currencyLabel, getStoreText } from "@/i18n/store";
import { wilayas } from "@/lib/wilayas";
import { formatPrice } from "@/lib/format";
import { ProductGrid, discountOf } from "@/features/storefront/blocks";
import { PixelScope } from "@/features/pixels/PixelScope";
import { pagePixels } from "@/features/pixels/queries";
import { storeForm } from "@/features/order-form/resolve";

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

async function load(params: PageProps<"/store/[slug]/p/[product]">["params"]) {
  const { slug, product: productSlug } = await params;
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();
  const product = await getStoreProduct(shop.id, decode(productSlug));
  if (!product) notFound();
  return { shop, product };
}

export async function generateMetadata({
  params,
}: PageProps<"/store/[slug]/p/[product]">): Promise<Metadata> {
  const { product } = await load(params);
  return {
    title: product.name,
    description: product.description?.slice(0, 160),
    openGraph: { images: product.images.slice(0, 1) },
  };
}

export default async function ProductPage({
  params,
}: PageProps<"/store/[slug]/p/[product]">) {
  const { shop, product } = await load(params);
  const locale = shopLocale(shop);
  const t = getStoreText(locale);
  const cur = currencyLabel(locale);
  const [rates, pixels, similar, base] = await Promise.all([
    getShippingRates(shop.id),
    pagePixels(shop.id, [product.id]),
    similarProducts(shop.id, product),
    storeBase(shop.slug),
  ]);

  return (
    <>
      <div className="grid gap-6 pb-20 md:grid-cols-2 md:gap-10 md:pb-0">
        {/* On large screens the photos stay in view while the visitor fills the form */}
        <div className="md:sticky md:top-24 md:self-start">
          <Gallery images={product.images} alt={product.name} />
        </div>
        <div className="space-y-5">
          <VisitPing shopId={shop.id} productId={product.id} />
          <PixelScope
            pixels={pixels}
            item={{
              id: product.id,
              name: product.name,
              price: product.price,
              quantity: 1,
            }}
          >
            <div className="space-y-2">
              <h1 className="text-2xl leading-snug font-extrabold tracking-tight sm:text-3xl">
                {product.name}
              </h1>
              {product.shortDescription && (
                <p className="text-s-muted" data-testid="short-description">
                  {product.shortDescription}
                </p>
              )}
              <p className="flex flex-wrap items-baseline gap-3">
                <span className="text-3xl font-extrabold text-brand-ink">
                  {formatPrice(product.price, cur)}
                </span>
                {discountOf(product.price, product.compareAtPrice) > 0 &&
                product.compareAtPrice ? (
                  <>
                    <span className="text-lg text-s-muted line-through">
                      {formatPrice(product.compareAtPrice, cur)}
                    </span>
                    <span
                      dir="ltr"
                      className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-extrabold text-white"
                    >
                      -{discountOf(product.price, product.compareAtPrice)}%
                    </span>
                  </>
                ) : null}
              </p>
              <ul className="flex flex-wrap gap-2 text-xs font-semibold text-s-muted">
                <li className="flex items-center gap-1 rounded-full bg-s-surface px-3 py-1.5 shadow-[var(--s-shadow)]">
                  <BadgeCheck size={14} className="text-brand-ink" /> {t.cod}
                </li>
                <li className="flex items-center gap-1 rounded-full bg-s-surface px-3 py-1.5 shadow-[var(--s-shadow)]">
                  <Truck size={14} className="text-brand-ink" />{" "}
                  {t.fastDelivery}
                </li>
              </ul>
            </div>
            <CheckoutForm
              t={t}
              currency={cur}
              product={{
                price: product.price,
                trackStock: product.trackStock,
                stock: product.stock,
                options: product.options,
                offers: product.offers,
              }}
              variants={product.variants.map((v) => ({
                id: v.id,
                values: v.optionValues,
                price: v.price,
                stock: v.stock,
              }))}
              rates={rates}
              wilayas={wilayas.map((w) => ({
                code: w.code,
                name: `${String(w.code).padStart(2, "0")} - ${locale === "ar" ? w.ar : w.fr}`,
              }))}
              action={submitOrder.bind(null, shop.slug, product.id, null)}
              saveLead={saveLead.bind(null, shop.slug, product.id)}
              settings={storeForm(shop)}
              whatsapp={{ phone: shop.phone ?? "", product: product.name }}
            />
          </PixelScope>
          {(product.description ||
            (product.descriptionImages ?? []).length > 0) && (
            <section className="space-y-3 rounded-[var(--s-radius)] border border-s-card-border bg-s-surface p-5 shadow-[var(--s-shadow)]">
              <h2 className="font-bold">{t.description}</h2>
              {product.description && (
                <div className="leading-relaxed whitespace-pre-line text-s-muted">
                  {product.description}
                </div>
              )}
              {(product.descriptionImages ?? []).map((src) => (
                // The whole photo, never cropped
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt=""
                  loading="lazy"
                  className="w-full rounded-[var(--s-radius)] object-contain"
                  data-testid="description-image"
                />
              ))}
            </section>
          )}
        </div>
      </div>
      {similar.length > 0 && (
        <div className="mt-12" data-testid="similar-products">
          <ProductGrid
            title={t.similar}
            products={similar}
            base={base}
            currency={cur}
            t={t}
          />
        </div>
      )}
    </>
  );
}
