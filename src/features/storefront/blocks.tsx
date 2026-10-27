// Storefront building blocks. Plain components (no server or browser-only code) so the real store
// and the live preview in Store Design render exactly the same thing.
import Link from "next/link";
import type { ReactNode } from "react";
import { BadgeCheck, ImageOff, Megaphone, MessageCircle, Phone, Truck, Zap } from "lucide-react";
import { dir, type Locale } from "@/i18n/config";
import type { StoreText } from "@/i18n/store";
import { formatPrice } from "@/lib/format";
import type { StoreDesign } from "@/features/design/types";

export function StoreFrame({ locale, color, children, className = "" }: { locale: Locale; color: string; children: ReactNode; className?: string }) {
  return (
    <div data-testid="store-frame" lang={locale} dir={dir(locale)} className={`flex flex-col bg-slate-50 text-slate-900 ${className}`} style={{ ["--brand" as string]: color }}>
      {children}
    </div>
  );
}

export function AnnouncementBar({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 bg-brand px-4 py-2 text-center text-sm font-semibold text-white" data-testid="announcement">
      <Megaphone size={15} className="shrink-0" /> {text}
    </div>
  );
}

export function StoreHeader({ name, logoUrl, phone, homeHref }: { name: string; logoUrl: string | null; phone: string | null; homeHref: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href={homeHref} className="flex min-w-0 items-center gap-2 text-lg font-extrabold text-brand">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="size-10 rounded-lg object-contain" data-testid="store-logo" />
          )}
          <span className="truncate">{name}</span>
        </Link>
        {phone && (
          <a href={`tel:${phone}`} dir="ltr" className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
            <Phone size={15} /> {phone}
          </a>
        )}
      </div>
    </header>
  );
}

export function Hero({ hero }: { hero: StoreDesign["hero"] }) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-brand text-white" data-testid="hero">
      {hero.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={hero.image} alt="" className="absolute inset-0 size-full object-cover" />
      )}
      <div className={`relative flex min-h-56 flex-col items-start justify-center gap-3 p-6 sm:min-h-72 sm:p-10 ${hero.image ? "bg-black/45" : ""}`}>
        {hero.title && <h1 className="max-w-xl text-3xl leading-tight font-extrabold sm:text-4xl">{hero.title}</h1>}
        {hero.subtitle && <p className="max-w-xl text-base text-white/90 sm:text-lg">{hero.subtitle}</p>}
        {hero.buttonText && (
          <a href="#products" className="mt-2 rounded-xl bg-white px-6 py-3 font-extrabold text-brand shadow-lg transition hover:scale-105">
            {hero.buttonText}
          </a>
        )}
      </div>
    </section>
  );
}

export function TrustBadges({ t }: { t: StoreText }) {
  const badges = [
    { icon: BadgeCheck, label: t.cod },
    { icon: Truck, label: t.fastDelivery },
    { icon: Zap, label: t.easyOrder },
  ];
  return (
    <ul className="grid grid-cols-3 gap-2 sm:gap-4" data-testid="badges">
      {badges.map(({ icon: Icon, label }) => (
        <li key={label} className="flex flex-col items-center gap-2 rounded-2xl bg-white p-3 text-center text-xs font-semibold text-slate-700 shadow-sm sm:flex-row sm:p-4 sm:text-start sm:text-sm">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Icon size={18} />
          </span>
          {label}
        </li>
      ))}
    </ul>
  );
}

export type GridProduct = { id: string; slug: string; name: string; price: number; compareAtPrice: number | null; images: string[] };

export function ProductGrid({ title, products, base, currency, t }: { title: string; products: GridProduct[]; base: string; currency: string; t: StoreText }) {
  return (
    <section id="products" className="scroll-mt-20 space-y-4">
      <h2 className="text-2xl font-extrabold">{title || t.products}</h2>
      {products.length === 0 ? (
        <p className="rounded-2xl bg-white p-10 text-center text-slate-500">{t.empty}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => {
            const off = p.compareAtPrice && p.compareAtPrice > p.price ? Math.round(((p.compareAtPrice - p.price) / p.compareAtPrice) * 100) : 0;
            return (
              <li key={p.id}>
                <Link href={`${base}/p/${encodeURIComponent(p.slug)}`} className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:shadow-lg">
                  <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-slate-100">
                    {p.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0]} alt={p.name} className="size-full object-cover transition group-hover:scale-105" />
                    ) : (
                      <ImageOff className="text-slate-300" size={32} />
                    )}
                    {off > 0 && <span dir="ltr" className="absolute start-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                        -{off}%
                      </span>}
                  </div>
                  <div className="space-y-1 p-3">
                    <h3 className="line-clamp-2 text-sm font-semibold">{p.name}</h3>
                    <p className="flex flex-wrap items-baseline gap-2">
                      <span className="font-extrabold text-brand">{formatPrice(p.price, currency)}</span>
                      {p.compareAtPrice ? <span className="text-xs text-slate-400 line-through">{formatPrice(p.compareAtPrice, currency)}</span> : null}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function StoreFooter({ name, about, socials, t }: { name: string; about: string; socials: StoreDesign["socials"]; t: StoreText }) {
  const links = [
    { href: socials.facebook, label: "Facebook" },
    { href: socials.instagram, label: "Instagram" },
    { href: socials.tiktok, label: "TikTok" },
    { href: socials.whatsapp ? `https://wa.me/${socials.whatsapp.replace(/^0/, "213")}` : "", label: "WhatsApp" },
  ].filter((l) => l.href);
  return (
    <footer className="border-t border-slate-200 bg-white" data-testid="store-footer">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 text-center">
        <p className="font-extrabold text-brand">{name}</p>
        {about && <p className="mx-auto max-w-2xl text-sm whitespace-pre-line text-slate-600">{about}</p>}
        {links.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500">{t.followUs}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {links.map((l) => (
                <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-1.5 text-sm font-semibold text-slate-700 hover:border-brand hover:text-brand">
                  {l.label === "WhatsApp" && <MessageCircle size={14} />}
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-slate-400">
          © {name} · {t.poweredBy}
        </p>
      </div>
    </footer>
  );
}
