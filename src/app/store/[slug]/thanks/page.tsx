import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheckBig } from "lucide-react";
import { getOrderSummary, getShopBySlug, storeBase } from "@/features/storefront/queries";
import { shopLocale } from "@/features/storefront/StoreShell";
import { currencyLabel, getStoreText } from "@/i18n/store";
import { fmt, formatPrice } from "@/lib/format";

export default async function ThanksPage({ params, searchParams }: PageProps<"/store/[slug]/thanks">) {
  const shop = await getShopBySlug((await params).slug);
  if (!shop) notFound();
  const orderId = (await searchParams).o;
  const order = typeof orderId === "string" && /^[0-9a-f-]{36}$/.test(orderId) ? await getOrderSummary(shop.id, orderId) : null;
  if (!order) notFound();
  const locale = shopLocale(shop);
  const t = getStoreText(locale);
  const cur = currencyLabel(locale);
  return (
    <div className="mx-auto max-w-lg space-y-5 py-6 text-center">
      <CircleCheckBig size={64} className="mx-auto text-brand" />
      <h1 className="text-2xl font-extrabold">{t.thanks.title}</h1>
      <p className="text-s-muted">{fmt(t.thanks.body, { phone: order.phone })}</p>
      <div className="space-y-3 rounded-[var(--s-radius)] bg-s-surface p-5 text-start shadow-[var(--s-shadow)]">
        <p className="flex justify-between text-sm">
          <span className="text-s-muted">{t.thanks.number}</span>
          <span className="font-extrabold" data-testid="order-number">
            #{order.number}
          </span>
        </p>
        {order.items.map((item) => (
          <p key={item.id} className="flex justify-between gap-3 text-sm">
            <span>
              {item.name}
              {item.variantTitle && <span className="text-s-muted"> · {item.variantTitle}</span>} ×{item.quantity}
            </span>
            <span className="font-semibold whitespace-nowrap">{formatPrice(item.total, cur)}</span>
          </p>
        ))}
        <p className="flex justify-between text-sm">
          <span className="text-s-muted">{t.summary.shipping}</span>
          <span className="font-semibold">{order.shippingPrice === 0 ? t.summary.free : formatPrice(order.shippingPrice, cur)}</span>
        </p>
        <p className="flex justify-between border-t border-s-line pt-3 text-lg">
          <span className="font-bold">{t.summary.total}</span>
          <span className="font-extrabold text-brand">{formatPrice(order.total, cur)}</span>
        </p>
      </div>
      <Link href={(await storeBase(shop.slug)) || "/"} className="inline-block font-semibold text-brand hover:underline">
        {t.thanks.back}
      </Link>
    </div>
  );
}
