import { notFound } from "next/navigation";
import { getShopBySlug, listStoreProducts, storeBase } from "@/features/storefront/queries";
import { shopLocale } from "@/features/storefront/StoreShell";
import { Hero, ProductGrid, TrustBadges } from "@/features/storefront/blocks";
import { resolveDesign } from "@/features/design/types";
import { findTheme } from "@/features/themes/themes";
import { currencyLabel, getStoreText } from "@/i18n/store";

export default async function StoreHome({ params }: PageProps<"/store/[slug]">) {
  const shop = await getShopBySlug((await params).slug);
  if (!shop) notFound();
  const locale = shopLocale(shop);
  const t = getStoreText(locale);
  const design = resolveDesign(shop.design);
  const theme = findTheme(design.theme);
  const [products, base] = await Promise.all([listStoreProducts(shop.id), storeBase(shop.slug)]);
  return (
    <div className="space-y-8">
      {design.hero.enabled && <Hero hero={design.hero} variant={theme.layout.hero} />}
      {design.showBadges && <TrustBadges t={t} />}
      <ProductGrid title={design.productsTitle} products={products} base={base} currency={currencyLabel(locale)} t={t} layout={theme.layout} />
    </div>
  );
}
