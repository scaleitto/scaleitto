import { notFound } from "next/navigation";
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
  const [products, base, pixels] = await Promise.all([listStoreProducts(shop.id), storeBase(shop.slug), pagePixels(shop.id)]);
  return (
    <div className="space-y-10">
      <PixelScope pixels={pixels} />
      <VisitPing shopId={shop.id} />
      {design.hero.enabled && <Hero hero={design.hero} variant={theme.layout.hero} t={t} />}
      {design.showBadges && <TrustBadges t={t} items={trustBadgeItems(resolveApps(shop.apps).badges, t)} />}
      <ProductGrid title={design.productsTitle} products={products} base={base} currency={currencyLabel(locale)} t={t} layout={theme.layout} />
      {design.showOrderSteps && products.length > 0 && <OrderSteps t={t} />}
    </div>
  );
}
