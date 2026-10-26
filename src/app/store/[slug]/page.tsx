import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageOff } from "lucide-react";
import { getShopBySlug, listStoreProducts, storeBase } from "@/features/storefront/queries";
import { shopLocale } from "@/features/storefront/StoreShell";
import { currencyLabel, getStoreText } from "@/i18n/store";
import { formatPrice } from "@/lib/format";

export default async function StoreHome({ params }: PageProps<"/store/[slug]">) {
  const shop = await getShopBySlug((await params).slug);
  if (!shop) notFound();
  const locale = shopLocale(shop);
  const t = getStoreText(locale);
  const cur = currencyLabel(locale);
  const [products, base] = await Promise.all([listStoreProducts(shop.id), storeBase(shop.slug)]);
  return (
    <>
      <h1 className="mb-5 text-2xl font-extrabold">{t.products}</h1>
      {products.length === 0 ? (
        <p className="rounded-2xl bg-white p-10 text-center text-slate-500">{t.empty}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <li key={p.id}>
              <Link href={`${base}/p/${encodeURIComponent(p.slug)}`} className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:shadow-lg">
                <div className="flex aspect-square items-center justify-center overflow-hidden bg-slate-100">
                  {p.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.images[0]} alt={p.name} className="size-full object-cover transition group-hover:scale-105" />
                  ) : (
                    <ImageOff className="text-slate-300" size={32} />
                  )}
                </div>
                <div className="space-y-1 p-3">
                  <h2 className="line-clamp-2 text-sm font-semibold">{p.name}</h2>
                  <p className="flex flex-wrap items-baseline gap-2">
                    <span className="font-extrabold text-brand">{formatPrice(p.price, cur)}</span>
                    {p.compareAtPrice ? <span className="text-xs text-slate-400 line-through">{formatPrice(p.compareAtPrice, cur)}</span> : null}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
