import type { Metadata } from "next";
import { storeCaptcha } from "@/server/turnstile";
import { resolveProtection } from "@/features/checkout/protection-settings";
import { notFound } from "next/navigation";
import { getShippingRates, getShopBySlug, storeBase } from "@/features/storefront/queries";
import { shopLocale } from "@/features/storefront/StoreShell";
import { CartPage } from "@/features/storefront/CartPage";
import { submitCart } from "@/features/storefront/cart-actions";
import { liveMethods } from "@/features/payments/flow";
import { resolveApps } from "@/features/apps/settings";
import { currencyLabel, getStoreText } from "@/i18n/store";
import { wilayas } from "@/lib/wilayas";

export const metadata: Metadata = { title: "Cart", robots: { index: false } };

// Apps → Shopping cart: the buyer's cart and one order for all of it
export default async function Cart({ params }: PageProps<"/store/[slug]/cart">) {
  const shop = await getShopBySlug((await params).slug);
  if (!shop || !resolveApps(shop.apps).cart) notFound();
  const locale = shopLocale(shop);
  const [rates, base] = await Promise.all([getShippingRates(shop.id), storeBase(shop.slug)]);
  return (
    <CartPage
      slug={shop.slug}
      shopId={shop.id}
      base={base}
      rates={rates}
      wilayas={wilayas.map((w) => ({ code: w.code, name: `${String(w.code).padStart(2, "0")} - ${locale === "ar" ? w.ar : w.fr}` }))}
      arabic={locale === "ar"}
      currency={currencyLabel(locale)}
      action={submitCart.bind(null, shop.slug)}
      payMethods={await liveMethods(shop.id)}
      captcha={storeCaptcha(resolveProtection(shop.protection))}
      t={getStoreText(locale)}
    />
  );
}
