import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, Truck } from "lucide-react";
import { getShippingRates, getShopBySlug, getStoreProduct } from "@/features/storefront/queries";
import { shopLocale } from "@/features/storefront/StoreShell";
import { Gallery } from "@/features/storefront/Gallery";
import { CheckoutForm } from "@/features/storefront/CheckoutForm";
import { saveLead, submitOrder } from "@/features/checkout/actions";
import { currencyLabel, getStoreText } from "@/i18n/store";
import { wilayas } from "@/lib/wilayas";
import { formatPrice } from "@/lib/format";

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

export async function generateMetadata({ params }: PageProps<"/store/[slug]/p/[product]">): Promise<Metadata> {
  const { shop, product } = await load(params);
  return { title: `${product.name} | ${shop.name}`, description: product.description?.slice(0, 160), openGraph: { images: product.images.slice(0, 1) } };
}

export default async function ProductPage({ params }: PageProps<"/store/[slug]/p/[product]">) {
  const { shop, product } = await load(params);
  const locale = shopLocale(shop);
  const t = getStoreText(locale);
  const cur = currencyLabel(locale);
  const rates = await getShippingRates(shop.id);

  return (
    <div className="grid gap-6 pb-20 md:grid-cols-2 md:gap-10 md:pb-0">
      <Gallery images={product.images} alt={product.name} />
      <div className="space-y-5">
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold leading-snug">{product.name}</h1>
          <p className="flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-extrabold text-brand">{formatPrice(product.price, cur)}</span>
            {product.compareAtPrice ? <span className="text-lg text-slate-400 line-through">{formatPrice(product.compareAtPrice, cur)}</span> : null}
          </p>
          <ul className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
            <li className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 shadow-sm">
              <BadgeCheck size={14} className="text-brand" /> {t.cod}
            </li>
            <li className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 shadow-sm">
              <Truck size={14} className="text-brand" /> {t.fastDelivery}
            </li>
          </ul>
        </div>
        <CheckoutForm
          t={t}
          currency={cur}
          product={{ price: product.price, trackStock: product.trackStock, stock: product.stock, options: product.options, offers: product.offers }}
          variants={product.variants.map((v) => ({ id: v.id, values: v.optionValues, price: v.price, stock: v.stock }))}
          rates={rates}
          wilayas={wilayas.map((w) => ({ code: w.code, name: `${String(w.code).padStart(2, "0")} - ${locale === "ar" ? w.ar : w.fr}` }))}
          action={submitOrder.bind(null, shop.slug, product.id)}
          saveLead={saveLead.bind(null, shop.slug, product.id)}
        />
        {product.description && <div className="whitespace-pre-line rounded-2xl bg-white p-5 leading-relaxed text-slate-700 shadow-sm">{product.description}</div>}
      </div>
    </div>
  );
}
