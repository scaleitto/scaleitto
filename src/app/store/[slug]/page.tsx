import Link from "next/link";
import { notFound } from "next/navigation";
import { storeCollections } from "@/features/collections/queries";
import { textIn } from "@/features/collections/types";
import { resolveApps } from "@/features/apps/settings";
import { VisitPing } from "@/features/analytics/VisitPing";
import { getShopBySlug, listStoreProducts, storeBase } from "@/features/storefront/queries";
import { shopLocale } from "@/features/storefront/StoreShell";
import { Hero, OrderSteps, ProductGrid, TrustBadges, trustBadgeItems } from "@/features/storefront/blocks";
import { resolveDesign, storeTheme } from "@/features/design/types";
import { currencyLabel, getStoreText } from "@/i18n/store";
import { PixelScope } from "@/features/pixels/PixelScope";
import { pagePixels } from "@/features/pixels/queries";

export default async function StoreHome({ params }: PageProps<"/store/[slug]">) {
  const shop = await getShopBySlug((await params).slug);
  if (!shop) notFound();
  const locale = shopLocale(shop);
  const t = getStoreText(locale);
  const design = resolveDesign(shop.design);
  const theme = storeTheme(design);
  const [products, base, pixels, collections] = await Promise.all([listStoreProducts(shop.id), storeBase(shop.slug), pagePixels(shop.id), storeCollections(shop.id)]);
  return (
    <div className="space-y-10">
      <PixelScope pixels={pixels} />
      <VisitPing shopId={shop.id} />
      {design.hero.enabled && <Hero hero={design.hero} variant={theme.layout.hero} t={t} />}
      {design.showBadges && <TrustBadges t={t} items={trustBadgeItems(resolveApps(shop.apps).badges, t)} />}
      {collections.length > 0 && (
        <nav className="flex gap-3 overflow-x-auto pb-1" data-testid="store-collections">
          {collections.map((c) => (
            <Link key={c.id} href={`${base}/collections/${c.handle}`} className="flex shrink-0 items-center gap-2 rounded-full border border-s-edge bg-s-surface py-1.5 ps-1.5 pe-4 text-sm font-semibold shadow-[var(--s-shadow)] hover:border-brand">
              {c.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.image} alt="" className="size-8 rounded-full object-cover" />
              ) : (
                <span className="size-2" />
              )}
              {textIn(c.titles, locale)}
            </Link>
          ))}
        </nav>
      )}
      <ProductGrid title={design.productsTitle} products={products} base={base} currency={currencyLabel(locale)} t={t} layout={theme.layout} />
      {design.showOrderSteps && products.length > 0 && <OrderSteps t={t} />}
    </div>
  );
}
