import type { ReactNode } from "react";
import { CircleCheckBig } from "lucide-react";
import { dir, type Locale } from "@/i18n/config";
import { currencyLabel, getStoreText } from "@/i18n/store";
import { fmt, formatPrice } from "@/lib/format";
import { interfaceLocale, resolveForm } from "@/features/landing/types";
import { pageLanguage } from "@/features/landing/PublicLanding";
import type { getOrderSummary } from "./queries";

type Order = NonNullable<Awaited<ReturnType<typeof getOrderSummary>>>;

// The thank-you content after an order (store page, landing page and embedded form).
export function ThankYou({ order, locale: storeLocale, children }: { order: Order; locale: Locale; children?: ReactNode }) {
  const locale = order.landing ? interfaceLocale(pageLanguage(order.landing.language)) : storeLocale;
  const t = getStoreText(locale);
  const cur = currencyLabel(locale);
  const message = order.landing ? resolveForm(order.landing.form).thankYou : "";
  return (
    <div lang={locale} dir={dir(locale)} className="mx-auto max-w-lg space-y-5 py-6 text-center">
      <CircleCheckBig size={64} className="mx-auto text-brand" />
      <h1 className="text-2xl font-extrabold">{t.thanks.title}</h1>
      <p className="text-s-muted">{fmt(t.thanks.body, { phone: order.phone })}</p>
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
          <span className="font-extrabold text-brand">{formatPrice(order.total, cur)}</span>
        </p>
      </div>
      {children}
    </div>
  );
}
