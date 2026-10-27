import { notFound } from "next/navigation";
import { getShippingRates, getShopBySlug, getStoreLanding } from "@/features/storefront/queries";
import { saveLead, submitOrder } from "@/features/checkout/actions";
import { PublicLanding } from "@/features/landing/PublicLanding";
import { HeightReporter } from "@/features/landing/HeightReporter";
import { LandingView } from "@/features/landing/LandingView";
import { StoreFrame } from "@/features/storefront/blocks";
import { shopLocale } from "@/features/storefront/StoreShell";
import { resolveDesign } from "@/features/design/types";
import { findTheme } from "@/features/themes/themes";

// The order form of a landing page alone, for <iframe> embedding on other sites.
export default async function EmbedForm({ params }: PageProps<"/embed/[slug]/[page]">) {
  const { slug, page: pageSlug } = await params;
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();
  const landing = await getStoreLanding(shop.id, decodeURIComponent(pageSlug));
  if (!landing) notFound();
  const { page, product } = landing;
  return (
    <StoreFrame locale={shopLocale(shop)} color={page.color ?? shop.primaryColor} theme={findTheme(resolveDesign(shop.design).theme)} className="bg-transparent p-1">
      <PublicLanding
        page={page}
        product={{ price: product.price, compareAtPrice: product.compareAtPrice, trackStock: product.trackStock, stock: product.stock, options: product.options, offers: product.offers }}
        variants={product.variants.map((v) => ({ id: v.id, values: v.optionValues, price: v.price, stock: v.stock }))}
        rates={await getShippingRates(shop.id)}
        action={submitOrder.bind(null, shop.slug, product.id, page.id, true)}
        saveLead={saveLead.bind(null, shop.slug, product.id)}
        embedded
      >
        <LandingView pageId={page.id} />
        <HeightReporter frameId={page.id} />
      </PublicLanding>
    </StoreFrame>
  );
}
