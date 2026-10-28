// Storefront building blocks. Plain components (no server or browser-only code) so the real store
// and the live preview in Store Design render exactly the same thing. Each theme picks a header, hero
// and product card style (src/features/themes/themes.ts); colors come only from the s-* tokens.
import Link from "next/link";
import type { ReactNode } from "react";
import { BadgeCheck, ImageOff, Megaphone, MessageCircle, Phone, ShoppingBag, Truck, Zap } from "lucide-react";
import { dir, type Locale } from "@/i18n/config";
import type { StoreText } from "@/i18n/store";
import { formatPrice } from "@/lib/format";
import type { StoreDesign } from "@/features/design/types";
import { themeStyle, type Theme } from "@/features/themes/themes";
import type { PolicyKind } from "@/lib/enums";

const whatsappHref = (n: string) => `https://wa.me/${n.replace(/[^\d]/g, "").replace(/^0/, "213")}`;
export const discountOf = (price: number, compareAt: number | null) => (compareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : 0);

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

// The shop's logo, or its first letter on the main color
function Logo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  return logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt="" className="size-10 shrink-0 rounded-[calc(var(--s-radius)/2)] object-contain" data-testid="store-logo" />
  ) : (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-[calc(var(--s-radius)/2)] bg-brand text-lg font-extrabold text-white">{name.trim().charAt(0).toUpperCase()}</span>
  );
}

export function StoreHeader({
  name,
  logoUrl,
  phone,
  whatsapp = "",
  homeHref,
  align = "start",
  t,
}: {
  name: string;
  logoUrl: string | null;
  phone: string | null;
  whatsapp?: string;
  homeHref: string;
  align?: Theme["layout"]["header"];
  t?: StoreText;
}) {
  const center = align === "center";
  const contact = (
    <div className="flex items-center gap-2">
      {whatsapp && (
        <a href={whatsappHref(whatsapp)} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="flex size-9 items-center justify-center rounded-full bg-[#25d366] text-white">
          <MessageCircle size={17} />
        </a>
      )}
      {phone && (
        <a href={`tel:${phone}`} dir="ltr" className="flex items-center gap-1.5 rounded-full border border-s-edge px-3 py-1.5 text-sm font-semibold text-s-text hover:border-brand hover:text-brand">
          <Phone size={14} /> <span className="hidden sm:inline">{phone}</span>
        </a>
      )}
    </div>
  );
  return (
    <header className="sticky top-0 z-20 border-b border-s-edge bg-s-surface/90 backdrop-blur-md" data-testid="store-header">
      <div className={`mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 ${center ? "justify-between sm:grid sm:grid-cols-3" : "justify-between"}`}>
        {center && t && (
          <nav className="hidden items-center gap-5 text-sm font-semibold text-s-muted sm:flex">
            <Link href={homeHref} className="hover:text-brand">
              {t.home}
            </Link>
            <a href={`${homeHref === "/" ? "" : homeHref}#products`} className="hover:text-brand">
              {t.products}
            </a>
          </nav>
        )}
        <Link href={homeHref} className={`flex min-w-0 items-center gap-2.5 ${center ? "sm:justify-self-center" : ""}`}>
          <Logo name={name} logoUrl={logoUrl} />
          <span className="truncate text-lg font-extrabold tracking-tight">{name}</span>
        </Link>
        <div className={`flex items-center gap-5 ${center ? "sm:justify-self-end" : ""}`}>
          {!center && t && (
            <nav className="hidden items-center gap-5 text-sm font-semibold text-s-muted md:flex">
              <Link href={homeHref} className="hover:text-brand">
                {t.home}
              </Link>
              <a href={`${homeHref === "/" ? "" : homeHref}#products`} className="hover:text-brand">
                {t.products}
              </a>
            </nav>
          )}
          {contact}
        </div>
      </div>
    </header>
  );
}

function HeroButton({ text, light = false }: { text: string; light?: boolean }) {
  return (
    <a
      href="#products"
      className={`inline-flex items-center gap-2 rounded-[var(--s-radius-btn)] px-7 py-3.5 text-base font-extrabold shadow-lg transition hover:-translate-y-0.5 ${light ? "bg-white text-brand" : "bg-brand text-white shadow-brand/25"}`}
    >
      <ShoppingBag size={18} /> {text}
    </a>
  );
}

export function Hero({ hero, variant = "split", t }: { hero: StoreDesign["hero"]; variant?: Theme["layout"]["hero"]; t?: StoreText }) {
  const text = (light: boolean, centered: boolean) => (
    <div className={`flex flex-col gap-4 ${centered ? "items-center text-center" : "items-start text-start"}`}>
      {hero.title && <h1 className="max-w-2xl text-3xl leading-tight font-extrabold tracking-tight sm:text-5xl">{hero.title}</h1>}
      {hero.subtitle && <p className={`max-w-xl text-base sm:text-lg ${light ? "text-white/85" : "text-s-muted"}`}>{hero.subtitle}</p>}
      {hero.buttonText && <HeroButton text={hero.buttonText} light={light} />}
      {t && (
        <p className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold ${centered ? "justify-center" : ""} ${light ? "text-white/85" : "text-s-muted"}`}>
          <span className="flex items-center gap-1.5">
            <BadgeCheck size={16} className={light ? "" : "text-brand"} /> {t.cod}
          </span>
          <span className="flex items-center gap-1.5">
            <Truck size={16} className={light ? "" : "text-brand"} /> {t.fastDelivery}
          </span>
        </p>
      )}
    </div>
  );
  // Merchant photos keep their shape: no cropping in the split and minimal heroes
  const photo = hero.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={hero.image} alt="" fetchPriority="high" className="h-auto max-h-[70vh] w-full rounded-[var(--s-radius)] object-contain shadow-[var(--s-shadow)]" />
  ) : null;

  if (variant === "split")
    return (
      <section className="grid items-center gap-8 py-4 md:grid-cols-2 md:py-10" data-testid="hero" data-variant="split">
        {text(false, false)}
        {photo ?? <div className="hidden aspect-[4/3] rounded-[var(--s-radius)] bg-gradient-to-br from-brand/25 to-brand/5 md:block" />}
      </section>
    );
  if (variant === "minimal")
    return (
      <section className="space-y-8 py-8 sm:py-14" data-testid="hero" data-variant="minimal">
        {text(false, true)}
        {photo && <div className="mx-auto max-w-4xl">{photo}</div>}
      </section>
    );
  // full = across the page, card = rounded banner; both put the text over the photo or the main color
  const full = variant === "full";
  return (
    <section className={`relative overflow-hidden bg-gradient-to-br from-brand to-brand/70 text-white ${full ? "-mx-4 -mt-6 sm:mx-0 sm:mt-0 sm:rounded-[var(--s-radius)]" : "rounded-[var(--s-radius)]"}`} data-testid="hero" data-variant={variant}>
      {hero.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={hero.image} alt="" fetchPriority="high" className="absolute inset-0 size-full object-cover" />
      )}
      <div className={`relative flex flex-col justify-end p-6 sm:p-12 ${full ? "min-h-[26rem] sm:min-h-[32rem]" : "min-h-72 sm:min-h-80"} ${hero.image ? "bg-gradient-to-t from-black/75 via-black/35 to-black/5" : ""}`}>
        {text(true, full)}
      </div>
    </section>
  );
}

export function TrustBadges({ t }: { t: StoreText }) {
  const badges = [
    { icon: BadgeCheck, label: t.cod, hint: t.codHint },
    { icon: Truck, label: t.fastDelivery, hint: t.deliveryHint },
    { icon: Zap, label: t.easyOrder, hint: t.easyHint },
  ];
  return (
    <ul className="grid grid-cols-3 gap-2 sm:gap-4" data-testid="badges">
      {badges.map(({ icon: Icon, label, hint }) => (
        <li key={label} className="flex flex-col items-center gap-2 rounded-[var(--s-radius)] border border-s-card-border bg-s-surface p-3 text-center shadow-[var(--s-shadow)] sm:flex-row sm:gap-3 sm:p-4 sm:text-start">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand sm:size-11">
            <Icon size={20} />
          </span>
          <span className="min-w-0">
            <span className="block text-xs leading-tight font-bold sm:text-sm">{label}</span>
            <span className="hidden text-xs text-s-muted sm:block">{hint}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// How cash-on-delivery ordering works, in three real steps
export function OrderSteps({ t }: { t: StoreText }) {
  return (
    <section className="space-y-5" data-testid="order-steps">
      <h2 className="text-center text-2xl font-extrabold tracking-tight">{t.howTo}</h2>
      <ol className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        {t.steps.map((step, i) => (
          <li key={step.title} className="flex items-center gap-4 rounded-[var(--s-radius)] border border-s-card-border bg-s-surface p-4 shadow-[var(--s-shadow)] sm:flex-col sm:p-6 sm:text-center">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-extrabold text-white">{i + 1}</span>
            <span className="min-w-0 space-y-1">
              <span className="block font-bold">{step.title}</span>
              <span className="block text-sm text-s-muted">{step.hint}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export type GridProduct = { id: string; slug: string; name: string; price: number; compareAtPrice: number | null; images: string[] };

function ProductCard({ p, href, currency, t, layout }: { p: GridProduct; href: string; currency: string; t: StoreText; layout: Pick<Theme["layout"], "image" | "cards"> }) {
  const off = discountOf(p.price, p.compareAtPrice);
  const minimal = layout.cards === "minimal";
  const box = minimal ? "" : `overflow-hidden rounded-[var(--s-radius)] bg-s-surface ${layout.cards === "outline" ? "border border-s-edge" : "border border-s-card-border shadow-[var(--s-shadow)]"}`;
  return (
    <Link href={href} className={`group flex h-full flex-col transition hover:-translate-y-0.5 ${box}`} data-card={layout.cards}>
      <div className={`relative flex items-center justify-center overflow-hidden bg-s-bg ${minimal ? "rounded-[var(--s-radius)]" : ""} ${layout.image === "portrait" ? "aspect-[4/5]" : "aspect-square"}`}>
        {p.images[0] ? (
          <>
            {/* The whole photo is shown (no cropping); a second photo, if any, appears on hover */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.images[0]} alt={p.name} loading="lazy" className={`size-full object-contain transition duration-300 ${p.images[1] ? "group-hover:opacity-0" : "group-hover:scale-105"}`} />
            {p.images[1] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.images[1]} alt="" loading="lazy" className="absolute inset-0 size-full object-contain opacity-0 transition duration-300 group-hover:opacity-100" />
            )}
          </>
        ) : (
          <ImageOff className="text-s-muted/50" size={32} />
        )}
        {off > 0 && (
          <span dir="ltr" className="absolute start-2 top-2 rounded-full bg-red-600 px-2.5 py-1 text-xs font-extrabold text-white shadow">
            -{off}%
          </span>
        )}
      </div>
      <div className={`flex flex-1 flex-col gap-1.5 ${minimal ? "pt-3" : "p-3 sm:p-4"}`}>
        <h3 className="line-clamp-2 text-sm leading-snug font-semibold sm:text-base">{p.name}</h3>
        <p className="mt-auto flex flex-wrap items-baseline gap-x-2">
          <span className="text-base font-extrabold text-brand sm:text-lg">{formatPrice(p.price, currency)}</span>
          {off > 0 && p.compareAtPrice ? <span className="text-xs text-s-muted line-through">{formatPrice(p.compareAtPrice, currency)}</span> : null}
        </p>
        {layout.cards === "elevated" && (
          <span className="mt-1 flex items-center justify-center gap-1.5 rounded-[var(--s-radius-btn)] bg-brand py-2 text-sm font-bold text-white transition group-hover:brightness-110">
            <ShoppingBag size={15} /> {t.viewProduct}
          </span>
        )}
      </div>
    </Link>
  );
}

export function ProductGrid({
  title,
  products,
  base,
  currency,
  t,
  layout = { columns: 4, image: "square", cards: "elevated" },
}: {
  title: string;
  products: GridProduct[];
  base: string;
  currency: string;
  t: StoreText;
  layout?: Pick<Theme["layout"], "columns" | "image" | "cards">;
}) {
  return (
    <section id="products" className="scroll-mt-20 space-y-5">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title || t.products}</h2>
        <span className="h-1 w-12 shrink-0 rounded-full bg-brand" aria-hidden />
      </div>
      {products.length === 0 ? (
        <p className="rounded-[var(--s-radius)] bg-s-surface p-10 text-center text-s-muted">{t.empty}</p>
      ) : (
        <ul className={`grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 ${layout.columns === 4 ? "lg:grid-cols-4" : ""}`}>
          {products.map((p) => (
            <li key={p.id}>
              <ProductCard p={p} href={`${base}/p/${encodeURIComponent(p.slug)}`} currency={currency} t={t} layout={layout} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function StoreFooter({
  name,
  about,
  socials,
  policies = [],
  phone = null,
  t,
}: {
  name: string;
  about: string;
  socials: StoreDesign["socials"];
  policies?: { kind: PolicyKind; href: string }[];
  phone?: string | null;
  t: StoreText;
}) {
  const links = [
    { href: socials.facebook, label: "Facebook" },
    { href: socials.instagram, label: "Instagram" },
    { href: socials.tiktok, label: "TikTok" },
    { href: socials.whatsapp ? whatsappHref(socials.whatsapp) : "", label: "WhatsApp" },
  ].filter((l) => l.href);
  return (
    <footer className="mt-10 border-t border-s-edge bg-s-surface" data-testid="store-footer">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div className="space-y-3">
          <p className="text-lg font-extrabold">{name}</p>
          {about && <p className="text-sm leading-relaxed whitespace-pre-line text-s-muted">{about}</p>}
        </div>
        {policies.length > 0 && (
          <nav className="space-y-2 text-sm" data-testid="policy-links">
            <p className="font-bold">{t.links}</p>
            {policies.map((p) => (
              <a key={p.kind} href={p.href} className="block text-s-muted hover:text-brand hover:underline">
                {t.policies[p.kind]}
              </a>
            ))}
          </nav>
        )}
        {(phone || links.length > 0) && (
          <div className="space-y-3 text-sm">
            <p className="font-bold">{t.contact}</p>
            {phone && (
              <a href={`tel:${phone}`} dir="ltr" className="flex items-center gap-2 text-s-muted hover:text-brand">
                <Phone size={15} /> {phone}
              </a>
            )}
            {links.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-s-muted">{t.followUs}</p>
                <div className="flex flex-wrap gap-2">
                  {links.map((l) => (
                    <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-s-edge px-3.5 py-1.5 text-sm font-semibold text-s-muted hover:border-brand hover:text-brand">
                      {l.label === "WhatsApp" && <MessageCircle size={14} />}
                      {l.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <p className="border-t border-s-edge px-4 py-4 text-center text-xs text-s-muted">
        © {name} · {t.poweredBy}
      </p>
    </footer>
  );
}
