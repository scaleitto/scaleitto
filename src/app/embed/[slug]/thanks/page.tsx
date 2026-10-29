import { notFound } from "next/navigation";
import { getOrderSummary, getShopBySlug } from "@/features/storefront/queries";
import { ThankYou } from "@/features/storefront/ThankYou";
import { HeightReporter } from "@/features/landing/HeightReporter";
import { StoreFrame } from "@/features/storefront/blocks";
import { shopLocale } from "@/features/storefront/StoreShell";
import { resolveDesign, storeTheme } from "@/features/design/types";
import { PixelScope } from "@/features/pixels/PixelScope";
import { orderPixels } from "@/features/pixels/queries";

export default async function EmbedThanks({ params, searchParams }: PageProps<"/embed/[slug]/thanks">) {
  const shop = await getShopBySlug((await params).slug);
  if (!shop) notFound();
  const orderId = (await searchParams).o;
  const order = typeof orderId === "string" && /^[0-9a-f-]{36}$/.test(orderId) ? await getOrderSummary(shop.id, orderId) : null;
  if (!order) notFound();
  return (
    <StoreFrame locale={shopLocale(shop)} color={shop.primaryColor} theme={storeTheme(resolveDesign(shop.design))} className="bg-transparent p-1">
      <ThankYou order={order} locale={shopLocale(shop)} storeForm={shop.orderForm} />
      <PixelScope {...await orderPixels(shop.id, order)} />
      <HeightReporter frameId={order.landingPageId ?? "form"} />
    </StoreFrame>
  );
}
