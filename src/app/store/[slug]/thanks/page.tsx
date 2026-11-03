import Link from "next/link";
import { connection } from "next/server";
import { ClearCart } from "@/features/storefront/CartLink";
import { refreshPayment } from "@/features/payments/flow";
import { isOnlineMethod } from "@/features/payments/methods";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { resolveApps } from "@/features/apps/settings";
import { trackLink } from "@/features/storefront/tracking";
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
  const t = getStoreText(locale);
  const apps = resolveApps(shop.apps);
  // Back from an online payment page: ask the method's connector how it went (at request time, never while prerendering)
  const online = isOnlineMethod(order.paymentMethod);
  if (online) await connection();
  const payment = online ? (order.paymentStatus === "pending" ? await refreshPayment(shop.id, order.id) : order.paymentStatus) : "none";
  const thanks = apps.thanks;
  const base = await storeBase(shop.slug);
  // "Same product": the ordered product's page, when it is still on sale
  const productId = order.items.find((i) => i.productId)?.productId;
  const [product] = thanks.redirect === "product" && productId ? await db.select({ slug: schema.products.slug }).from(schema.products).where(and(eq(schema.products.shopId, shop.id), eq(schema.products.id, productId), eq(schema.products.status, "active"))) : [];
  const href = product ? `${base}/p/${product.slug}` : base || "/";
  return (
    <ThankYou order={order} locale={locale} custom={thanks}>
      <PixelScope {...await orderPixels(shop.id, order)} />
      {((await searchParams).cart === "1" || online) && <ClearCart shopId={shop.id} />}
      {online && (
        <p className={`rounded-[var(--s-radius)] p-3 text-sm font-semibold ${payment === "paid" ? "bg-brand/10 text-brand-ink" : payment === "failed" ? "bg-red-500/10 text-red-600" : "bg-s-surface text-s-muted"}`} data-testid="payment-result" data-payment={payment}>
          {payment === "paid" ? t.payment.paid : payment === "failed" ? t.payment.failed : t.payment.pending}
        </p>
      )}
      <Link href={href} className="inline-flex h-12 items-center justify-center rounded-[var(--s-radius-btn)] bg-brand px-6 font-bold text-brand-fg shadow-[var(--s-shadow)] hover:opacity-90" data-testid="thanks-button">
        {thanks.button || (product ? t.thanks.backProduct : t.thanks.back)}
      </Link>
      {apps.tracking.enabled && (
        <Link href={trackLink(base, order.id)} className="block font-semibold text-brand-ink hover:underline" data-testid="track-link">
          {t.track.button}
        </Link>
      )}
    </ThankYou>
  );
}
