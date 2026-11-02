import { resolveDesign, storeTheme } from "@/features/design/types";
import { cardGateway } from "@/features/payments/flow";
import { resolveWholesale } from "@/features/checkout/pricing";
import { resolveApps } from "@/features/apps/settings";
import { richTextToPlain } from "@/lib/rich-text";
import { VisitPing } from "@/features/analytics/VisitPing";
import { productForm } from "@/features/order-form/resolve";
import type { Metadata } from "next";
import { randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getOrderSummary, getShippingRates, getShopBySlug, getStoreLanding } from "@/features/storefront/queries";
import { saveLead, submitOrder } from "@/features/checkout/actions";
import { PublicLanding } from "@/features/landing/PublicLanding";
import { LandingView } from "@/features/landing/LandingView";
import { ThankYouPopup } from "@/features/landing/ThankYouPopup";
import { interfaceLocale, liveVersions, pageLanguage, readPublished, sanitizeSections, versionSections, type VersionKey } from "@/features/landing/types";
import { PixelScope } from "@/features/pixels/PixelScope";
import { orderPixels, pagePixels } from "@/features/pixels/queries";
import { getStoreText } from "@/i18n/store";
import { fmt } from "@/lib/format";

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

async function load(params: PageProps<"/store/[slug]/lp/[page]">["params"]) {
  const { slug, page: pageSlug } = await params;
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();
  const landing = await getStoreLanding(shop.id, decode(pageSlug));
  if (!landing) notFound();
  return { shop, ...landing };
}

export async function generateMetadata({ params }: PageProps<"/store/[slug]/lp/[page]">): Promise<Metadata> {
  const { page, product } = await load(params);
  const description = page.metaDescription || richTextToPlain(product.description ?? "").replace(/\s+/g, " ").slice(0, 160);
  return { title: product.name, description, openGraph: { title: product.name, description: description ?? undefined, images: product.images.slice(0, 1) } };
}

export default async function LandingPage({ params, searchParams }: PageProps<"/store/[slug]/lp/[page]">) {
  const { shop, page, product } = await load(params);
  const published = readPublished(page.published) ?? { sections: sanitizeSections(page.sections), variants: [] };
  // A/B: each visitor keeps the version they were given (cookie), new visitors get one of the running versions in turn
  const live = liveVersions(published);
  const saved = (await cookies()).get(`lpv_${page.id}`)?.value as VersionKey | undefined;
  const version: VersionKey = saved && live.includes(saved) ? saved : live[randomInt(live.length)];
  const sections = versionSections(published, version);

  // Back after ordering on a page with a thank-you window: the window and the purchase events
  const thanksId = (await searchParams).thanks;
  const order = typeof thanksId === "string" && /^[0-9a-f-]{36}$/.test(thanksId) ? await getOrderSummary(shop.id, thanksId) : null;
  const popup = order && order.landingPageId === page.id ? sections.find((s) => s.type === "thankYou") : undefined;
  const t = getStoreText(interfaceLocale(pageLanguage(page.language)));
  // One pixel scope: the page view (and the product), plus the purchase when coming back after ordering
  const item = { id: product.id, name: product.name, price: product.price, quantity: 1 };
  const scope = popup ? { ...(await orderPixels(shop.id, order!)), item } : { pixels: await pagePixels(shop.id, [product.id], page.pixels), item };
  return (
    <PixelScope {...scope}>
      <PublicLanding
        language={page.language}
        color={page.color}
        sections={sections}
        settings={productForm(shop, product)}
        cardPayment={Boolean(await cardGateway(shop.id))}
        product={{ price: product.price, trackStock: product.trackStock, stock: product.stock, options: product.options, offers: product.offers, wholesale: resolveApps(shop.apps).wholesale ? resolveWholesale(product.wholesale) : null }}
        variants={product.variants.map((v) => ({ id: v.id, values: v.optionValues, price: v.price, stock: v.stock }))}
        rates={await getShippingRates(shop.id)}
        action={submitOrder.bind(null, shop.slug, product.id, { id: page.id, version })}
        saveLead={saveLead.bind(null, shop.slug, product.id)}
        whatsapp={{ phone: shop.phone ?? "", product: product.name }}
        theme={storeTheme(resolveDesign(shop.design))}
      >
        <LandingView pageId={page.id} version={version} />
        <VisitPing shopId={shop.id} productId={product.id} />
        {order && popup?.type === "thankYou" && (
          <ThankYouPopup title={popup.title || t.landing.thanks.title} message={popup.message || order.thankYou || t.landing.thanks.message} number={fmt(t.landing.thanks.number, { n: order.number })} close={t.landing.thanks.close} />
        )}
      </PublicLanding>
    </PixelScope>
  );
}
