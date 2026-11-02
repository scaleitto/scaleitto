import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getShopBySlug, storeBase } from "@/features/storefront/queries";
import { shopLocale } from "@/features/storefront/StoreShell";
import { ProductGrid } from "@/features/storefront/blocks";
import { resolveDesign, storeTheme } from "@/features/design/types";
import { storeCollection } from "@/features/collections/queries";
import { textIn } from "@/features/collections/types";
import { PixelScope } from "@/features/pixels/PixelScope";
import { pagePixels } from "@/features/pixels/queries";
import { currencyLabel, getStoreText } from "@/i18n/store";

export async function generateMetadata({ params }: PageProps<"/store/[slug]/collections/[handle]">): Promise<Metadata> {
  const { slug, handle } = await params;
  const shop = await getShopBySlug(slug);
  const found = shop ? await storeCollection(shop.id, decodeURIComponent(handle)) : null;
  if (!shop || !found) return {};
  const locale = shopLocale(shop);
  return { title: textIn(found.collection.titles, locale), description: textIn(found.collection.descriptions, locale) || undefined, openGraph: { images: found.collection.image ? [found.collection.image] : undefined } };
}

// Apps → Collections: a collection's banner, title, description, sub-collections and products
export default async function CollectionPage({ params }: PageProps<"/store/[slug]/collections/[handle]">) {
  const { slug, handle } = await params;
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();
  const found = await storeCollection(shop.id, decodeURIComponent(handle));
  if (!found) notFound();
  const locale = shopLocale(shop);
  const t = getStoreText(locale);
  const theme = storeTheme(resolveDesign(shop.design));
  const [base, pixels] = await Promise.all([storeBase(shop.slug), pagePixels(shop.id)]);
  const { collection, children, products } = found;
  const description = textIn(collection.descriptions, locale);
  return (
    <div className="space-y-8" data-collection-page={collection.handle}>
      <PixelScope pixels={pixels} />
      <header className="space-y-4">
        {collection.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={collection.image} alt="" className="aspect-[3/1] w-full rounded-[var(--s-radius)] object-cover" fetchPriority="high" />
        )}
        <h1 className="text-3xl font-extrabold">{textIn(collection.titles, locale)}</h1>
        {description && <p className="max-w-2xl whitespace-pre-line text-s-muted">{description}</p>}
        {children.length > 0 && (
          <nav className="flex flex-wrap gap-2">
            {children.map((c) => (
              <Link key={c.id} href={`${base}/collections/${c.handle}`} className="rounded-full border border-s-edge bg-s-surface px-4 py-1.5 text-sm font-semibold hover:border-brand">
                {textIn(c.titles, locale)}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <ProductGrid title="" products={products} base={base} currency={currencyLabel(locale)} t={t} layout={theme.layout} />
    </div>
  );
}
