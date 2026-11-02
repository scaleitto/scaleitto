import type { ReactNode } from "react";
import { CircleCheckBig } from "lucide-react";
import { dir, type Locale } from "@/i18n/config";
import { currencyLabel, getStoreText } from "@/i18n/store";
import { fmt, formatPrice } from "@/lib/format";
import { interfaceLocale, pageLanguage } from "@/features/landing/types";
import type { getOrderSummary } from "./queries";

type Order = NonNullable<Awaited<ReturnType<typeof getOrderSummary>>>;

// The thank-you content after an order (store page, landing page and embedded form).
// `custom` = Apps → Thank-you page (empty texts keep the store language's wording; the message may use {phone}).
export function ThankYou({ order, locale: storeLocale, custom, children }: { order: Order; locale: Locale; custom?: { title: string; message: string }; children?: ReactNode }) {
  const locale = order.landing ? interfaceLocale(pageLanguage(order.landing.language)) : storeLocale;
  const t = getStoreText(locale);
  const cur = currencyLabel(locale);
  const message = order.thankYou;
  return (
    <div lang={locale} dir={dir(locale)} className="mx-auto max-w-lg space-y-5 py-6 text-center">
      <CircleCheckBig size={64} className="mx-auto text-brand-ink" />
      <h1 className="text-2xl font-extrabold" data-testid="thanks-title">
        {custom?.title || t.thanks.title}
      </h1>
      <p className="whitespace-pre-line text-s-muted" data-testid="thanks-body">
        {fmt(custom?.message || t.thanks.body, { phone: order.phone })}
      </p>
      {message && (
        <p className="rounded-[var(--s-radius)] bg-brand/10 p-4 font-semibold whitespace-pre-line" data-testid="thank-you-message">
          {message}
        </p>
      )}
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
        <p className="flex justify-between border-t border-s-edge pt-3 text-lg">
          <span className="font-bold">{t.summary.total}</span>
          <span className="font-extrabold text-brand-ink">{formatPrice(order.total, cur)}</span>
        </p>
      </div>
      {children}
    </div>
  );
}
