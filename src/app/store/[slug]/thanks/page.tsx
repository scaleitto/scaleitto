import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderSummary, getShopBySlug, storeBase } from "@/features/storefront/queries";
import { shopLocale } from "@/features/storefront/StoreShell";
import { ThankYou } from "@/features/storefront/ThankYou";
import { getStoreText } from "@/i18n/store";
import { PixelScope } from "@/features/pixels/PixelScope";
import { orderPixels } from "@/features/pixels/queries";

export default async function ThanksPage({ params, searchParams }: PageProps<"/store/[slug]/thanks">) {
  const shop = await getShopBySlug((await params).slug);
  if (!shop) notFound();
  const orderId = (await searchParams).o;
  const order = typeof orderId === "string" && /^[0-9a-f-]{36}$/.test(orderId) ? await getOrderSummary(shop.id, orderId) : null;
  if (!order) notFound();
  const locale = shopLocale(shop);
  return (
    <ThankYou order={order} locale={locale} storeForm={shop.orderForm}>
      <PixelScope {...await orderPixels(shop.id, order)} />
      <Link href={(await storeBase(shop.slug)) || "/"} className="inline-block font-semibold text-brand-ink hover:underline">
        {getStoreText(locale).thanks.back}
      </Link>
    </ThankYou>
  );
}
