import { notFound } from "next/navigation";
import { formFor } from "@/features/order-form/resolve";
import { getShippingRates, getShopBySlug, getStoreLanding } from "@/features/storefront/queries";
import { saveLead, submitOrder } from "@/features/checkout/actions";
import { PublicLanding } from "@/features/landing/PublicLanding";
import { HeightReporter } from "@/features/landing/HeightReporter";
import { LandingView } from "@/features/landing/LandingView";
import { StoreFrame } from "@/features/storefront/blocks";
import { shopLocale } from "@/features/storefront/StoreShell";
import { resolveDesign, storeTheme } from "@/features/design/types";
import { PixelScope } from "@/features/pixels/PixelScope";
import { pagePixels } from "@/features/pixels/queries";

// The order form of a landing page alone, for <iframe> embedding on other sites.
export default async function EmbedForm({ params }: PageProps<"/embed/[slug]/[page]">) {
  const { slug, page: pageSlug } = await params;
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();
  const landing = await getStoreLanding(shop.id, decodeURIComponent(pageSlug));
  if (!landing) notFound();
  const { page, product } = landing;
  return (
    <StoreFrame locale={shopLocale(shop)} color={page.color ?? shop.primaryColor} theme={storeTheme(resolveDesign(shop.design))} className="bg-transparent p-1">
      <PixelScope pixels={await pagePixels(shop.id, [product.id], page.pixels)} item={{ id: product.id, name: product.name, price: product.price, quantity: 1 }}>
      <PublicLanding
        language={page.language}
        color={page.color}
        sections={[]}
        settings={await formFor(shop, page.formTemplateId, product.formTemplateId)}
        product={{ price: product.price, trackStock: product.trackStock, stock: product.stock, options: product.options, offers: product.offers }}
        variants={product.variants.map((v) => ({ id: v.id, values: v.optionValues, price: v.price, stock: v.stock }))}
        rates={await getShippingRates(shop.id)}
        action={submitOrder.bind(null, shop.slug, product.id, { id: page.id, version: "A" }, true)}
        saveLead={saveLead.bind(null, shop.slug, product.id)}
        whatsapp={{ phone: shop.phone ?? "", product: product.name }}
        theme={storeTheme(resolveDesign(shop.design))}
        embedded
      >
        <LandingView pageId={page.id} version="A" />
        <HeightReporter frameId={page.id} />
      </PublicLanding>
      </PixelScope>
    </StoreFrame>
  );
}
