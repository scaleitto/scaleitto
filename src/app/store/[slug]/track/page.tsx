import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Search } from "lucide-react";
import { getShopBySlug, storeBase } from "@/features/storefront/queries";
import { shopLocale } from "@/features/storefront/StoreShell";
import { TrackContact, TrackedOrderCard } from "@/features/storefront/TrackOrder";
import { lookupAllowed, lookupOrders, orderByToken, type TrackedOrder } from "@/features/storefront/tracking";
import { resolveApps, trackingContact } from "@/features/apps/settings";
import { currencyLabel, getStoreText } from "@/i18n/store";
import { isValidDzPhone, normalizePhone } from "@/lib/phone";
import { clientIp } from "@/server/client-ip";

export const metadata: Metadata = { title: "Tracking", robots: { index: false } };

// Apps → Order tracking: the private link from the thank-you page (?o=&k=), or a lookup by phone (and order number)
export default async function TrackPage({ params, searchParams }: PageProps<"/store/[slug]/track">) {
  const shop = await getShopBySlug((await params).slug);
  if (!shop) notFound();
  const apps = resolveApps(shop.apps);
  const tracking = apps.tracking;
  if (!tracking.enabled) notFound();
  const q = await searchParams;
  const one = (v: unknown) => (typeof v === "string" ? v : "");
  const locale = shopLocale(shop);
  const t = getStoreText(locale);
  const tr = t.track;
  const base = await storeBase(shop.slug);

  let orders: TrackedOrder[] | null = null;
  let message: string | null = null;
  const phoneIn = one(q.phone);
  const numberIn = one(q.number);
  if (one(q.o)) {
    const order = await orderByToken(shop.id, one(q.o), one(q.k));
    if (!order) notFound();
    orders = [order];
  } else if (phoneIn) {
    const phone = normalizePhone(phoneIn);
    const number = /^\d{1,9}$/.test(numberIn.replace(/^#/, "")) ? Number(numberIn.replace(/^#/, "")) : null;
    const h = await headers();
    const ip = clientIp(h);
    if (!isValidDzPhone(phone) || (tracking.lookup === "number_phone" && number === null)) message = tr.none;
    else if (!lookupAllowed(ip)) message = tr.tooMany;
    else {
      orders = await lookupOrders(shop.id, phone, tracking.lookup === "number_phone" ? number : null);
      if (!orders.length) message = tr.none;
    }
  }

  const contact = trackingContact(apps, shop.phone);

  const field = "h-12 w-full rounded-[var(--s-radius-btn)] border border-s-field-edge bg-s-field px-4 text-start outline-none focus:border-brand";
  return (
    <div className="mx-auto max-w-lg space-y-5 py-4">
      <h1 className="text-2xl font-extrabold">{tr.title}</h1>
      {orders?.length ? (
        <>
          {orders.map((o) => (
            <TrackedOrderCard key={o.id} order={o} locale={locale} currency={currencyLabel(locale)} t={t} />
          ))}
          <TrackContact contact={contact} t={t} />
          <Link href={`${base}/track`} className="block text-center text-sm font-semibold text-brand-ink hover:underline">
            {tr.other}
          </Link>
        </>
      ) : (
        <form method="get" className="space-y-3 rounded-[var(--s-radius)] border border-s-card-border bg-s-surface p-5 shadow-[var(--s-shadow)]" data-testid="track-form">
          <p className="text-sm text-s-muted">{tracking.lookup === "phone" ? tr.hintPhone : tr.hintNumber}</p>
          {tracking.lookup === "number_phone" && (
            <label className="block space-y-1 text-sm font-semibold">
              {tr.number}
              <input name="number" inputMode="numeric" dir="ltr" defaultValue={numberIn} placeholder="1001" className={field} />
            </label>
          )}
          <label className="block space-y-1 text-sm font-semibold">
            {tr.phone}
            <input name="phone" type="tel" inputMode="tel" dir="ltr" defaultValue={phoneIn} placeholder="0555 12 34 56" className={field} />
          </label>
          {message && (
            <p className="text-sm font-semibold text-red-600" data-testid="track-message">
              {message}
            </p>
          )}
          <button type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--s-radius-btn)] bg-brand font-bold text-brand-fg">
            <Search size={17} /> {tr.search}
          </button>
          <TrackContact contact={contact} t={t} />
        </form>
      )}
    </div>
  );
}
