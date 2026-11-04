// Storefront building blocks. Plain components (no server or browser-only code) so the real store
// and the live preview in Store Design render exactly the same thing. Each theme picks a header, hero
// and product card style (src/features/themes/themes.ts); colors come only from the s-* tokens.
import Link from "next/link";
import type { ReactNode } from "react";
import { BadgeCheck, ImageOff, MapPin, Megaphone, MessageCircle, Phone, RotateCcw, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import { dir, type Locale } from "@/i18n/config";
import type { StoreText } from "@/i18n/store";
import { formatPrice } from "@/lib/format";
import type { StoreDesign } from "@/features/design/types";
import { themeStyle, type Theme } from "@/features/themes/themes";
import type { PolicyKind } from "@/lib/enums";
import { resolveApps, type BadgeKey, type TrustBadge } from "@/features/apps/settings";

const whatsappHref = (n: string) => `https://wa.me/${n.replace(/[^\d]/g, "").replace(/^0/, "213")}`;
export const discountOf = (price: number, compareAt: number | null) => (compareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : 0);

export function StoreFrame({ locale, color, theme, children, className = "" }: { locale: Locale; color: string; theme: Theme; children: ReactNode; className?: string }) {
  return (
    <div data-testid="store-frame" data-theme={theme.key} lang={locale} dir={dir(locale)} className={`@container flex flex-col bg-s-bg text-s-text ${className}`} style={themeStyle(theme, color)}>
      {children}
    </div>
  );
}

export function AnnouncementBar({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 bg-brand px-4 py-2 text-center text-sm font-semibold text-brand-fg" data-testid="announcement">
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
    <span className="flex size-10 shrink-0 items-center justify-center rounded-[calc(var(--s-radius)/2)] bg-brand text-lg font-extrabold text-brand-fg">{name.trim().charAt(0).toUpperCase()}</span>
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
  extra,
  links,
}: {
  name: string;
  logoUrl: string | null;
  phone: string | null;
  whatsapp?: string;
  homeHref: string;
  align?: Theme["layout"]["header"];
  t?: StoreText;
  // Shown beside the contact buttons (the cart icon)
  extra?: ReactNode;
  // The menu (Store Design → Navigation): undefined = Home + Products, [] = no menu
  links?: { label: string; href: string }[];
}) {
  const center = align === "center";
  const menu = links ?? (t ? [{ label: t.home, href: homeHref }, { label: t.products, href: `${homeHref === "/" ? "" : homeHref}#products` }] : []);
  const navLinks = menu.map((l, i) => (
    <a key={i} href={l.href} className="hover:text-brand-ink">
      {l.label}
    </a>
  ));
  const contact = (
    <div className="flex items-center gap-2">
      {whatsapp && (
        <a href={whatsappHref(whatsapp)} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="flex size-9 items-center justify-center rounded-full bg-[#25d366] text-white">
          <MessageCircle size={17} />
        </a>
      )}
      {phone && (
        <a href={`tel:${phone}`} dir="ltr" className="flex items-center gap-1.5 rounded-full border border-s-edge px-3 py-1.5 text-sm font-semibold text-s-text hover:border-brand hover:text-brand-ink">
          <Phone size={14} /> <span className="hidden @min-[40rem]:inline">{phone}</span>
        </a>
      )}
    </div>
  );
  return (
    <header className="sticky top-0 z-20 border-b border-s-edge bg-s-surface/90 backdrop-blur-md" data-testid="store-header">
      <div className={`mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 ${center ? "justify-between @min-[40rem]:grid @min-[40rem]:grid-cols-3" : "justify-between"}`}>
        {center && (
          <nav className="hidden items-center gap-5 text-sm font-semibold text-s-muted @min-[40rem]:flex" data-testid="store-nav">
            {navLinks}
          </nav>
        )}
        <Link href={homeHref} className={`flex min-w-0 items-center gap-2.5 ${center ? "@min-[40rem]:justify-self-center" : ""}`}>
          <Logo name={name} logoUrl={logoUrl} />
          <span className="truncate text-lg font-extrabold tracking-tight">{name}</span>
        </Link>
        <div className={`flex items-center gap-5 ${center ? "@min-[40rem]:justify-self-end" : ""}`}>
          {!center && menu.length > 0 && (
            <nav className="hidden items-center gap-5 text-sm font-semibold text-s-muted @min-[48rem]:flex" data-testid="store-nav">
              {navLinks}
            </nav>
          )}
          {contact}
          {extra}
        </div>
      </div>
    </header>
  );
}

function HeroButton({ text, light = false }: { text: string; light?: boolean }) {
  return (
    <a
      href="#products"
      className={`inline-flex items-center gap-2 rounded-[var(--s-radius-btn)] px-7 py-3.5 text-base font-extrabold shadow-lg transition hover:-translate-y-0.5 ${light ? "bg-white text-brand-ink" : "bg-brand text-brand-fg shadow-brand/25"}`}
    >
      <ShoppingBag size={18} /> {text}
    </a>
  );
}

export function Hero({ hero, variant = "split", t }: { hero: StoreDesign["hero"]; variant?: Theme["layout"]["hero"]; t?: StoreText }) {
  const text = (light: boolean, centered: boolean) => (
    <div className={`flex flex-col gap-4 ${centered ? "items-center text-center" : "items-start text-start"}`}>
      {hero.title && <h1 className="max-w-2xl text-3xl leading-tight font-extrabold tracking-tight @min-[40rem]:text-5xl">{hero.title}</h1>}
      {hero.subtitle && <p className={`max-w-xl text-base @min-[40rem]:text-lg ${light ? "opacity-85" : "text-s-muted"}`}>{hero.subtitle}</p>}
      {hero.buttonText && <HeroButton text={hero.buttonText} light={light} />}
      {t && (
        <p className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold ${centered ? "justify-center" : ""} ${light ? "opacity-85" : "text-s-muted"}`}>
          <span className="flex items-center gap-1.5">
            <BadgeCheck size={16} className={light ? "" : "text-brand-ink"} /> {t.cod}
          </span>
          <span className="flex items-center gap-1.5">
            <Truck size={16} className={light ? "" : "text-brand-ink"} /> {t.fastDelivery}
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
      <section className="grid items-center gap-8 py-4 @min-[48rem]:grid-cols-2 @min-[48rem]:py-10" data-testid="hero" data-variant="split">
        {text(false, false)}
        {photo ?? <div className="hidden aspect-[4/3] rounded-[var(--s-radius)] bg-gradient-to-br from-brand/25 to-brand/5 @min-[48rem]:block" />}
      </section>
    );
  if (variant === "minimal")
    return (
      <section className="space-y-8 py-8 @min-[40rem]:py-14" data-testid="hero" data-variant="minimal">
        {text(false, true)}
        {photo && <div className="mx-auto max-w-4xl">{photo}</div>}
      </section>
    );
  // full = across the page, card = rounded banner; both put the text over the photo or the main color
  const full = variant === "full";
  return (
    <section className={`relative overflow-hidden bg-gradient-to-br from-brand to-brand/70 ${hero.image ? "text-white" : "text-brand-fg"} ${full ? "-mx-4 -mt-6 @min-[40rem]:mx-0 @min-[40rem]:mt-0 @min-[40rem]:rounded-[var(--s-radius)]" : "rounded-[var(--s-radius)]"}`} data-testid="hero" data-variant={variant}>
      {hero.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={hero.image} alt="" fetchPriority="high" className="absolute inset-0 size-full object-cover" />
      )}
      <div className={`relative flex flex-col justify-end p-6 @min-[40rem]:p-12 ${full ? "min-h-[26rem] @min-[40rem]:min-h-[32rem]" : "min-h-72 @min-[40rem]:min-h-80"} ${hero.image ? "bg-gradient-to-t from-black/75 via-black/35 to-black/5" : ""}`}>
        {text(true, full)}
      </div>
    </section>
  );
}

// The store's trust badges (Apps → Trust badges; an empty title / text = the store language's wording). Without
// settings (previews), the two that are true for every cash-on-delivery store.
export type BadgeItem = { key: BadgeKey; title: string; text: string };
export function trustBadgeItems(badges: TrustBadge[] | null, t: StoreText): BadgeItem[] {
  const defaults: Record<BadgeKey, [string, string]> = { payment: [t.cod, t.codHint], returns: [t.badges.returns, t.badges.returnsHint], guarantee: [t.badges.guarantee, t.badges.guaranteeHint], delivery: [t.fastDelivery, t.deliveryHint] };
  const list = badges ?? resolveApps(null).badges;
  return list.filter((b) => b.on).map((b) => ({ key: b.key, title: b.title || defaults[b.key][0], text: b.text || defaults[b.key][1] }));
}
const badgeIcons: Record<BadgeKey, typeof BadgeCheck> = { payment: BadgeCheck, returns: RotateCcw, guarantee: ShieldCheck, delivery: Truck };

export function TrustBadges({ t, items }: { t: StoreText; items?: BadgeItem[] }) {
  const badges = items ?? trustBadgeItems(null, t);
  if (!badges.length) return null;
  return (
    <ul className={`grid gap-2 @min-[40rem]:gap-3 ${badges.length === 1 ? "grid-cols-1" : badges.length === 3 ? "grid-cols-3" : "grid-cols-2"}`} data-testid="badges">
      {badges.map(({ key, title, text }) => {
        const Icon = badgeIcons[key];
        return (
          <li key={key} data-badge={key} className="flex flex-col items-center gap-2 rounded-[var(--s-radius)] border border-s-card-border bg-s-surface p-3 text-center shadow-[var(--s-shadow)] @min-[40rem]:flex-row @min-[40rem]:gap-3 @min-[40rem]:text-start">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand-ink">
              <Icon size={19} />
            </span>
            <span className="min-w-0">
              <span className="block text-xs leading-tight font-bold @min-[40rem]:text-sm">{title}</span>
              <span className="block text-[11px] text-s-muted @min-[40rem]:text-xs">{text}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// How cash-on-delivery ordering works, in three real steps
export function OrderSteps({ t }: { t: StoreText }) {
  return (
    <section className="space-y-5" data-testid="order-steps">
      <h2 className="text-center text-2xl font-extrabold tracking-tight">{t.howTo}</h2>
      <ol className="grid gap-3 @min-[40rem]:grid-cols-3 @min-[40rem]:gap-4">
        {t.steps.map((step, i) => (
          <li key={step.title} className="flex items-center gap-4 rounded-[var(--s-radius)] border border-s-card-border bg-s-surface p-4 shadow-[var(--s-shadow)] @min-[40rem]:flex-col @min-[40rem]:p-6 @min-[40rem]:text-center">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-extrabold text-brand-fg">{i + 1}</span>
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

export type GridProduct = { id: string; slug: string; name: string; price: number; compareAtPrice: number | null; images: string[]; collectionIds?: string[] | null };

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
      <div className={`flex flex-1 flex-col gap-1.5 ${minimal ? "pt-3" : "p-3 @min-[40rem]:p-4"}`}>
        <h3 className="line-clamp-2 text-sm leading-snug font-semibold @min-[40rem]:text-base">{p.name}</h3>
        <p className="mt-auto flex flex-wrap items-baseline gap-x-2">
          <span className="text-base font-extrabold text-brand-ink @min-[40rem]:text-lg">{formatPrice(p.price, currency)}</span>
          {off > 0 && p.compareAtPrice ? <span className="text-xs text-s-muted line-through">{formatPrice(p.compareAtPrice, currency)}</span> : null}
        </p>
        {layout.cards === "elevated" && (
          <span className="mt-1 flex items-center justify-center gap-1.5 rounded-[var(--s-radius-btn)] bg-brand py-2 text-sm font-bold text-brand-fg transition group-hover:brightness-110">
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
  anchor = true,
}: {
  title: string;
  products: GridProduct[];
  base: string;
  currency: string;
  t: StoreText;
  layout?: { columns: 2 | 3 | 4; image: Theme["layout"]["image"]; cards: Theme["layout"]["cards"] };
  // The first products section of a page is the "#products" the buttons and menu point to
  anchor?: boolean;
}) {
  return (
    <section id={anchor ? "products" : undefined} className="scroll-mt-20 space-y-5" data-section="products">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-2xl font-extrabold tracking-tight @min-[40rem]:text-3xl">{title || t.products}</h2>
        <span className="h-1 w-12 shrink-0 rounded-full bg-brand" aria-hidden />
      </div>
      {products.length === 0 ? (
        <p className="rounded-[var(--s-radius)] bg-s-surface p-10 text-center text-s-muted">{t.empty}</p>
      ) : (
        <ul className={`grid grid-cols-2 gap-3 @min-[40rem]:gap-5 ${layout.columns === 2 ? "" : "@min-[48rem]:grid-cols-3"} ${layout.columns === 4 ? "@min-[64rem]:grid-cols-4" : ""}`}>
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
  location = "",
  t,
}: {
  name: string;
  about: string;
  location?: string;
  socials: StoreDesign["socials"];
  policies?: { kind: PolicyKind; href: string }[];
  phone?: string | null;
  t: StoreText;
}) {
  const links = [
    { href: socials.facebook, label: "Facebook" },
    { href: socials.instagram, label: "Instagram" },
    { href: socials.tiktok, label: "TikTok" },
    { href: socials.telegram, label: "Telegram" },
    { href: socials.whatsapp ? whatsappHref(socials.whatsapp) : "", label: "WhatsApp" },
  ].filter((l) => l.href);
  return (
    <footer className="mt-10 border-t border-s-edge bg-s-surface" data-testid="store-footer">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 @min-[40rem]:grid-cols-3">
        <div className="space-y-3">
          <p className="text-lg font-extrabold">{name}</p>
          {about && <p className="text-sm leading-relaxed whitespace-pre-line text-s-muted">{about}</p>}
          {location && (
            <p className="flex items-center gap-1.5 text-sm text-s-muted" data-testid="store-location">
              <MapPin size={15} className="shrink-0" /> {location}
            </p>
          )}
        </div>
        {policies.length > 0 && (
          <nav className="space-y-2 text-sm" data-testid="policy-links">
            <p className="font-bold">{t.links}</p>
            {policies.map((p) => (
              <a key={p.kind} href={p.href} className="block text-s-muted hover:text-brand-ink hover:underline">
                {t.policies[p.kind]}
              </a>
            ))}
          </nav>
        )}
        {(phone || links.length > 0) && (
          <div className="space-y-3 text-sm">
            <p className="font-bold">{t.contact}</p>
            {phone && (
              <a href={`tel:${phone}`} dir="ltr" className="flex items-center gap-2 text-s-muted hover:text-brand-ink">
                <Phone size={15} /> {phone}
              </a>
            )}
            {links.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-s-muted">{t.followUs}</p>
                <div className="flex flex-wrap gap-2">
                  {links.map((l) => (
                    <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-s-edge px-3.5 py-1.5 text-sm font-semibold text-s-muted hover:border-brand hover:text-brand-ink">
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
