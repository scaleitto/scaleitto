import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getShopBySlug, storeBase } from "@/lib/store";
import { getStoreDictionary } from "@/i18n/store";
import { getDictionary } from "@/i18n";
import { formatPrice } from "@/lib/format";

export default async function StoreHome({ params }: PageProps<"/store/[slug]">) {
  const shop = await getShopBySlug((await params).slug);
  if (!shop) notFound();
  const s = getStoreDictionary(shop.defaultLocale);
  const currency = getDictionary(shop.defaultLocale).common.currency;
  const base = await storeBase(shop.slug);

  const products = await db
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.shopId, shop.id), eq(schema.products.status, "active")))
    .orderBy(desc(schema.products.createdAt));

  if (products.length === 0) return <p className="py-20 text-center text-slate-500">{s.noProducts}</p>;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <Link key={p.id} href={`${base}/p/${encodeURIComponent(p.slug)}`} className="group overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition hover:shadow-md">
          <div className="aspect-square bg-slate-100">
            {p.images[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover transition group-hover:scale-105" />
            )}
          </div>
          <div className="p-3">
            <h2 className="line-clamp-2 text-sm font-semibold">{p.name}</h2>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-bold text-brand">{formatPrice(p.price, currency)}</span>
              {p.compareAtPrice && p.compareAtPrice > p.price && (
                <span className="text-xs text-slate-400 line-through">{formatPrice(p.compareAtPrice, currency)}</span>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
