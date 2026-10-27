// Storefront building blocks. Plain components (no server or browser-only code) so the real store
// and the live preview in Store Design render exactly the same thing.
import Link from "next/link";
import type { ReactNode } from "react";
import { BadgeCheck, ImageOff, Megaphone, MessageCircle, Phone, Truck, Zap } from "lucide-react";
import { dir, type Locale } from "@/i18n/config";
import type { StoreText } from "@/i18n/store";
import { formatPrice } from "@/lib/format";
import type { StoreDesign } from "@/features/design/types";
import { themeStyle, type Theme } from "@/features/themes/themes";
import type { PolicyKind } from "@/lib/enums";

export function StoreFrame({ locale, color, theme, children, className = "" }: { locale: Locale; color: string; theme: Theme; children: ReactNode; className?: string }) {
  return (
    <div data-testid="store-frame" data-theme={theme.key} lang={locale} dir={dir(locale)} className={`flex flex-col bg-s-bg text-s-text ${className}`} style={themeStyle(theme, color)}>
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

export function StoreHeader({ name, logoUrl, phone, homeHref, align = "start" }: { name: string; logoUrl: string | null; phone: string | null; homeHref: string; align?: Theme["layout"]["header"] }) {
  return (
    <header className="sticky top-0 z-20 border-b border-s-line bg-s-surface/95 backdrop-blur">
      <div className={`mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 ${align === "center" ? "flex-col justify-center sm:relative sm:flex-row" : "justify-between"}`}>
        <Link href={homeHref} className="flex min-w-0 items-center gap-2 text-lg font-extrabold text-brand">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="size-10 rounded-lg object-contain" data-testid="store-logo" />
          )}
          <span className="truncate">{name}</span>
        </Link>
        {phone && (
          <a href={`tel:${phone}`} dir="ltr" className={`flex items-center gap-1.5 text-sm font-semibold text-s-muted ${align === "center" ? "sm:absolute sm:end-4" : ""}`}>
            <Phone size={15} /> {phone}
          </a>
        )}
      </div>
    </header>
  );
}

export function Hero({ hero, variant = "card" }: { hero: StoreDesign["hero"]; variant?: Theme["layout"]["hero"] }) {
  const full = variant === "full";
  return (
    <section className={`relative overflow-hidden bg-brand text-white ${full ? "-mx-4 sm:mx-0" : "rounded-[var(--s-radius)]"}`} data-testid="hero">
      {hero.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={hero.image} alt="" className="absolute inset-0 size-full object-cover" />
      )}
      <div className={`relative flex flex-col justify-center gap-3 p-6 sm:p-10 ${full ? "min-h-72 items-center text-center sm:min-h-96" : "min-h-56 items-start sm:min-h-72"} ${hero.image ? "bg-black/45" : ""}`}>
        {hero.title && <h1 className="max-w-xl text-3xl leading-tight font-extrabold sm:text-4xl">{hero.title}</h1>}
        {hero.subtitle && <p className="max-w-xl text-base text-white/90 sm:text-lg">{hero.subtitle}</p>}
        {hero.buttonText && (
          <a href="#products" className="mt-2 rounded-[var(--s-radius-btn)] bg-white px-6 py-3 font-extrabold text-brand shadow-lg transition hover:scale-105">
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
        <li key={label} className="flex flex-col items-center gap-2 rounded-[var(--s-radius)] bg-s-surface p-3 text-center text-xs font-semibold text-s-muted shadow-[var(--s-shadow)] sm:flex-row sm:p-4 sm:text-start sm:text-sm">
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

export function ProductGrid({
  title,
  products,
  base,
  currency,
  t,
  layout = { columns: 4, image: "square" },
}: {
  title: string;
  products: GridProduct[];
  base: string;
  currency: string;
  t: StoreText;
  layout?: Pick<Theme["layout"], "columns" | "image">;
}) {
  return (
    <section id="products" className="scroll-mt-20 space-y-4">
      <h2 className="text-2xl font-extrabold">{title || t.products}</h2>
      {products.length === 0 ? (
        <p className="rounded-[var(--s-radius)] bg-s-surface p-10 text-center text-s-muted">{t.empty}</p>
      ) : (
        <ul className={`grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 ${layout.columns === 4 ? "lg:grid-cols-4" : ""}`}>
          {products.map((p) => {
            const off = p.compareAtPrice && p.compareAtPrice > p.price ? Math.round(((p.compareAtPrice - p.price) / p.compareAtPrice) * 100) : 0;
            return (
              <li key={p.id}>
                <Link href={`${base}/p/${encodeURIComponent(p.slug)}`} className="group block overflow-hidden rounded-[var(--s-radius)] border border-s-card-border bg-s-surface shadow-[var(--s-shadow)] transition hover:shadow-lg">
                  <div className={`relative flex items-center justify-center overflow-hidden bg-s-bg ${layout.image === "portrait" ? "aspect-[4/5]" : "aspect-square"}`}>
                    {p.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0]} alt={p.name} className="size-full object-cover transition group-hover:scale-105" />
                    ) : (
                      <ImageOff className="text-s-muted/50" size={32} />
                    )}
                    {off > 0 && <span dir="ltr" className="absolute start-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                        -{off}%
                      </span>}
                  </div>
                  <div className="space-y-1 p-3">
                    <h3 className="line-clamp-2 text-sm font-semibold">{p.name}</h3>
                    <p className="flex flex-wrap items-baseline gap-2">
                      <span className="font-extrabold text-brand">{formatPrice(p.price, currency)}</span>
                      {p.compareAtPrice ? <span className="text-xs text-s-muted line-through">{formatPrice(p.compareAtPrice, currency)}</span> : null}
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

export function StoreFooter({ name, about, socials, policies = [], t }: { name: string; about: string; socials: StoreDesign["socials"]; policies?: { kind: PolicyKind; href: string }[]; t: StoreText }) {
  const links = [
    { href: socials.facebook, label: "Facebook" },
    { href: socials.instagram, label: "Instagram" },
    { href: socials.tiktok, label: "TikTok" },
    { href: socials.whatsapp ? `https://wa.me/${socials.whatsapp.replace(/^0/, "213")}` : "", label: "WhatsApp" },
  ].filter((l) => l.href);
  return (
    <footer className="border-t border-s-line bg-s-surface" data-testid="store-footer">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 text-center">
        <p className="font-extrabold text-brand">{name}</p>
        {about && <p className="mx-auto max-w-2xl text-sm whitespace-pre-line text-s-muted">{about}</p>}
        {links.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-s-muted">{t.followUs}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {links.map((l) => (
                <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-s-line px-4 py-1.5 text-sm font-semibold text-s-muted hover:border-brand hover:text-brand">
                  {l.label === "WhatsApp" && <MessageCircle size={14} />}
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        )}
        {policies.length > 0 && (
          <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm" data-testid="policy-links">
            {policies.map((p) => (
              <a key={p.kind} href={p.href} className="text-s-muted hover:text-brand hover:underline">
                {t.policies[p.kind]}
              </a>
            ))}
          </nav>
        )}
        <p className="text-xs text-s-muted">
          © {name} · {t.poweredBy}
        </p>
      </div>
    </footer>
  );
}
