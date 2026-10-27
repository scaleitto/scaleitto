import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getShopBySlug, storeBase } from "@/features/storefront/queries";
import { StoreShell } from "@/features/storefront/StoreShell";

export async function generateMetadata({ params }: LayoutProps<"/store/[slug]">): Promise<Metadata> {
  const shop = await getShopBySlug((await params).slug);
  if (!shop) return { title: "Store" };
  // Pages set their own title; the store's SEO title is the default (home)
  return { title: { default: shop.seo?.title || shop.name, template: `%s | ${shop.name}` }, description: shop.seo?.description, openGraph: { siteName: shop.name, images: shop.logoUrl ? [shop.logoUrl] : undefined } };
}

export default async function StoreLayout({ children, params }: LayoutProps<"/store/[slug]">) {
  const shop = await getShopBySlug((await params).slug);
  if (!shop) notFound();
  return (
    <StoreShell shop={shop} base={await storeBase(shop.slug)}>
      {children}
    </StoreShell>
  );
}
