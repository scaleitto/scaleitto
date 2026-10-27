import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getShippingRates, getShopBySlug, getStoreLanding } from "@/features/storefront/queries";
import { saveLead, submitOrder } from "@/features/checkout/actions";
import { PublicLanding } from "@/features/landing/PublicLanding";
import { LandingView } from "@/features/landing/LandingView";
import { sanitizeSections } from "@/features/landing/types";
import { PixelScope } from "@/features/pixels/PixelScope";
import { pagePixels } from "@/features/pixels/queries";

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
  const { shop, page, product } = await load(params);
  const hero = sanitizeSections(page.sections).find((s) => s.type === "hero");
  const title = hero && "title" in hero && hero.title ? hero.title : product.name;
  return { title: `${title} | ${shop.name}`, description: product.description?.slice(0, 160), openGraph: { title, images: product.images.slice(0, 1) } };
}

export default async function LandingPage({ params }: PageProps<"/store/[slug]/lp/[page]">) {
  const { shop, page, product } = await load(params);
  return (
    <PixelScope pixels={await pagePixels(shop.id, [product.id])} item={{ id: product.id, name: product.name, price: product.price, quantity: 1 }}>
    <PublicLanding
      page={page}
      product={{ price: product.price, compareAtPrice: product.compareAtPrice, trackStock: product.trackStock, stock: product.stock, options: product.options, offers: product.offers }}
      variants={product.variants.map((v) => ({ id: v.id, values: v.optionValues, price: v.price, stock: v.stock }))}
      rates={await getShippingRates(shop.id)}
      action={submitOrder.bind(null, shop.slug, product.id, page.id, false)}
      saveLead={saveLead.bind(null, shop.slug, product.id)}
    >
      <LandingView pageId={page.id} />
    </PublicLanding>
    </PixelScope>
  );
}
