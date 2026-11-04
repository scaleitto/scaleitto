import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  Crown,
  Download,
  Headphones,
  LayoutGrid,
  Package,
  PhoneCall,
  Radar,
  Settings,
  Sheet,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Tag,
  Truck,
  Users,
  Webhook,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Dictionary, Locale } from "@/i18n";
import { dir } from "@/i18n";
import { limitKeys } from "@/lib/enums";
import type { Limits } from "@/server/db/schema";
import { limitLine, priceParts } from "@/features/plans/labels";
import { LanguageSwitcher } from "@/ui/LanguageSwitcher";
import { LogoMark } from "@/ui/Logo";

// The platform's public homepage (design-system/scaleitto/pages/homepage.md), modelled on ayor's: a centred hero with
// a deep-indigo call to action, a product screen, a bento of pastel cards that each show a real part of the product,
// integrations, delivery, the confirmation team, and plan cards with a comparison table. Every screen is drawn in
// HTML/CSS from the dictionary (no images to load), and only shows features that exist.

export type HomePlan = { code: string; name: string; priceMonthly: number; orderPack: number | null; limits: Limits; features: string[] };

// The plan the homepage highlights (plan codes are fixed, see the admin plans editor)
const RECOMMENDED = "rocket";

const inkButton =
  "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-7 py-3.5 text-base font-medium text-white transition hover:bg-[#1d1650] active:scale-[.98] focus-visible:ring-4 focus-visible:ring-accent/30 focus-visible:outline-none";
const softButton = "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-fg transition hover:bg-accent/10 focus-visible:ring-4 focus-visible:ring-accent/30 focus-visible:outline-none";
// The two-tone headings: the first line in violet, the second in ink
const violetText = "text-ink";

function Mark({ size = "size-9" }: { size?: string }) {
  return <LogoMark className={size} />;
}

function Heading({ top, bottom, center = false }: { top: string; bottom: string; center?: boolean }) {
  return (
    <h2 className={`text-[2.1rem] leading-[1.15] font-bold tracking-tight text-balance sm:text-5xl ${center ? "text-center" : ""}`}>
      <span className={`block ${violetText}`}>{top}</span>
      <span className="block text-ink">{bottom}</span>
    </h2>
  );
}

// A section head: the title on one side, the text and an action on the other
function SectionHead({ top, bottom, text, action }: { top: string; bottom: string; text: string; action: ReactNode }) {
  return (
    <div className="grid items-end gap-6 lg:grid-cols-[1.2fr_1fr] lg:gap-12" data-reveal>
      <Heading top={top} bottom={bottom} />
      <div className="space-y-5">
        <p className="text-lg leading-relaxed text-ink">{text}</p>
        {action}
      </div>
    </div>
  );
}

export function MarketingHome({ lang, t, plans, contact }: { lang: Locale; t: Dictionary; plans: HomePlan[]; contact?: string }) {
  const l = t.landing;
  const register = `/${lang}/register`;
  const Arrow = dir(lang) === "rtl" ? ArrowLeft : ArrowRight;
  const nav = [
    ["#features", l.nav.features],
    ["#apps", l.nav.apps],
    ...(plans.length ? [["#pricing", l.nav.pricing]] : []),
  ];
  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-fg">
      <header className="sticky top-0 z-30 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href={`/${lang}`} className="flex items-center gap-2.5">
            <Mark />
            <span className="text-xl font-bold tracking-tight text-ink">{t.brand}</span>
          </Link>
          <nav className="hidden items-center gap-8 text-[15px] text-muted md:flex">
            {nav.map(([href, label]) => (
              <a key={href} href={href} className="transition-colors hover:text-ink">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <LanguageSwitcher current={lang} />
            {/* Phones: no room for both actions, the sign-in link waits for wider screens */}
            <span className="hidden sm:contents">
              <Link href={`/${lang}/login`} className={softButton}>
                {l.login}
              </Link>
            </span>
            <Link href={register} className="inline-flex items-center rounded-[10px] bg-ink px-3.5 py-2.5 text-sm font-medium whitespace-nowrap text-white transition hover:brightness-150 sm:px-5">
              {l.start}
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero, centred like ayor's: announcement, two-tone title, one dark call to action */}
        <section className="relative px-4 pt-10 text-center sm:pt-14" data-hero>
          <h1 className="mx-auto mt-2 max-w-4xl text-[2.2rem] leading-[1.1] font-bold tracking-tight text-balance sm:text-6xl lg:text-7xl">
            <span className={`block pb-1 ${violetText}`}>{l.titleTop}</span>
            <span className="block text-ink">{l.titleBottom}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink sm:text-xl">{l.subtitle}</p>
          <div className="mt-9">
            <Link href={register} className={inkButton}>
              {l.cta}
            </Link>
          </div>
        </section>

        {/* The facts band (where ayor shows its customers: we only state what is true) */}
        <div className="mt-12 bg-[#f4f2ff]">
          <ul className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 py-5 text-base text-ink">
            {l.facts.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <CheckCircle2 size={17} className="text-accent" aria-hidden /> {f}
              </li>
            ))}
          </ul>
        </div>

        <section className="mx-auto max-w-6xl px-4 pt-12 sm:pt-16" data-reveal>
          <DashboardScreen t={t} />
        </section>

        {/* Features: a bento of pastel cards, each with a small screen of that part of the product */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-24 sm:pt-32">
          <SectionHead
            top={l.featuresTop}
            bottom={l.featuresBottom}
            text={l.featuresText}
            action={
              <a href="#apps" className={inkButton}>
                {l.discover}
              </a>
            }
          />
          <Bento t={t} />
        </section>

        {/* Integrations */}
        <section id="apps" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-24 sm:pt-32">
          <SectionHead
            top={l.appsTitle}
            bottom=""
            text={l.appsText}
            action={
              <Link href={register} className={inkButton}>
                {l.discover}
              </Link>
            }
          />
          <Apps t={t} />
        </section>

        {/* Delivery */}
        <section className="mx-auto max-w-6xl px-4 pt-24 sm:pt-32">
          <SectionHead
            top={l.deliveryTitle}
            bottom=""
            text={l.deliveryText}
            action={
              <Link href={register} className={inkButton}>
                {l.deliveryCta}
              </Link>
            }
          />
          <DeliveryCollage t={t} />
        </section>

        {/* The confirmation team: three phone screens, like ayor's app section */}
        <section className="mx-auto max-w-6xl px-4 pt-24 sm:pt-32">
          <div className="mx-auto max-w-3xl text-center" data-reveal>
            <h2 className={`text-[2.1rem] leading-[1.15] font-bold tracking-tight text-balance sm:text-5xl ${violetText}`}>{l.teamTitle}</h2>
            <p className="mt-5 text-lg leading-relaxed text-ink">{l.teamText}</p>
          </div>
          <TeamPhones t={t} />
        </section>

        {plans.length > 0 && <Pricing lang={lang} t={t} plans={plans} contact={contact} />}

        <section className="px-4 pt-24 pb-24 sm:pt-32">
          <div data-reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-[32px] bg-ink px-6 py-16 text-center text-white sm:py-20">
            <h2 className="relative text-3xl font-bold tracking-tight text-balance sm:text-5xl">{l.ctaTitle}</h2>
            <p className="relative mx-auto mt-4 max-w-lg text-lg text-white/85">{l.ctaText}</p>
            <Link href={register} className="relative mt-9 inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-base font-medium text-ink transition hover:bg-[#efedff] focus-visible:ring-4 focus-visible:ring-white/40 focus-visible:outline-none">
              {l.cta}
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-[#f4f2ff]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="space-y-4">
            <span className="flex items-center gap-2.5 text-lg font-bold text-ink">
              <Mark /> {t.brand}
            </span>
            <p className="max-w-sm text-ink">{l.footer.tagline}</p>
          </div>
          <FooterLinks
            title={l.footer.platform}
            links={[
              ["#features", l.nav.features],
              ["#apps", l.nav.apps],
              ...(plans.length ? [["#pricing", l.nav.pricing]] : []),
            ]}
          />
          <FooterLinks
            title={l.footer.account}
            links={[
              [register, l.footer.register],
              [`/${lang}/login`, l.login],
            ]}
          />
        </div>
        <p className="px-4 pb-8 text-center text-sm text-ink">
          © {t.brand}. {l.rights}
        </p>
      </footer>
    </div>
  );
}

function FooterLinks({ title, links }: { title: string; links: string[][] }) {
  return (
    <div>
      <p className="font-semibold text-ink">{title}</p>
      <ul className="mt-4 space-y-3 text-ink">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="transition-colors hover:text-ink">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}


const statusTone = {
  new: "bg-[#fff4e5] text-warning",
  confirmed: "bg-[#ecfdf3] text-[#047857]",
  delivered: "bg-[#efedff] text-accent",
  returned: "bg-[#fdecec] text-danger",
} as const;

// The product screen under the hero: the dashboard home with its sidebar, sales, a chart and the latest orders
function DashboardScreen({ t }: { t: Dictionary }) {
  const l = t.landing;
  const m = l.mock;
  const side: [LucideIcon, string][] = [
    [LayoutGrid, t.sections.overview.title],
    [Package, t.sections.products.title],
    [ShoppingCart, t.sections.orders.title],
    [Truck, t.sections.delivery.title],
    [Headphones, t.sections.callCenters.title],
    [Sparkles, t.sections.landingPages.title],
    [BarChart3, t.sections.analytics.title],
    [Settings, t.sections.settings.title],
  ];
  const bars = [38, 52, 44, 66, 58, 80, 72];
  const statuses: (keyof typeof statusTone)[] = ["new", "confirmed", "delivered", "returned"];
  return (
    <div className="relative" aria-hidden data-ui>
      <span className="pointer-events-none absolute -inset-x-6 -top-6 bottom-10 -z-10 rounded-[40px] bg-[#efedff]" />
      <div className="overflow-hidden rounded-[22px] border border-[#e4e1f5] bg-white">
        <div className="flex items-center gap-1.5 border-b border-[#efedf7] bg-[#fbfaff] px-4 py-3">
          <span className="size-2.5 rounded-full bg-[#ff6159]" />
          <span className="size-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
          <span className="mx-auto h-5 w-48 rounded-md bg-[#f0eef8]" />
        </div>
        <div className="grid md:grid-cols-[210px_1fr]">
          <aside className="hidden border-e border-[#efedf7] bg-[#fbfaff] p-4 md:block">
            <span className="mb-5 flex items-center gap-2 font-bold text-ink">
              <Mark size="size-7" /> {t.brand}
            </span>
            <ul className="space-y-1 text-sm">
              {side.map(([Icon, label], i) => (
                <li key={label} className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${i === 0 ? "bg-[#efedff] font-semibold text-accent" : "text-muted"}`}>
                  <Icon size={16} /> {label}
                </li>
              ))}
            </ul>
          </aside>
          <div className="space-y-4 p-4 sm:p-6">
            <p className="text-lg font-bold text-ink">{m.hello}</p>
            <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
              <div className="relative overflow-hidden rounded-2xl bg-ink p-5 text-white">
                <p className="relative text-sm text-white/70">{m.revenue}</p>
                <p className="relative mt-1 text-3xl font-bold tabular-nums sm:text-4xl" dir="ltr">
                  97 400 <span className="text-lg font-medium text-white/70">DZD</span>
                </p>
                <div className="relative mt-5 flex h-20 items-end gap-2">
                  {bars.map((h, i) => (
                    <span key={i} className="flex-1 rounded-t-md bg-[#a99ff8]" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Stat label={m.orders} value="76" change="+26%" />
                <Stat label={m.visitors} value="1 579" change="+18%" />
                <div className="col-span-2 rounded-2xl border border-[#efedf7] p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">{m.rate}</span>
                    <span className="font-bold text-ink tabular-nums">72%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f0eef8]">
                    <span className="block h-full w-[72%] rounded-full bg-accent" />
                  </div>
                </div>
              </div>
            </div>
            <ul className="divide-y divide-white rounded-2xl border border-[#efedf7]">
              {l.sampleOrders.map(([name, city, amount], i) => (
                <li key={name} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="w-12 shrink-0 font-semibold text-muted tabular-nums" dir="ltr">
                    #{1043 - i}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{name}</span>
                    <span className="block text-xs text-muted">{city}</span>
                  </span>
                  <span className="hidden font-semibold text-ink tabular-nums sm:block">{amount}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${statusTone[statuses[i]]}`}>{m[statuses[i]]}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, change }: { label: string; value: string; change: string }) {
  return (
    <div className="rounded-2xl border border-[#efedf7] p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink tabular-nums" dir="ltr">
        {value}
      </p>
      <p className="mt-1 text-xs font-semibold text-[#047857] tabular-nums" dir="ltr">
        {change}
      </p>
    </div>
  );
}

function CardText({ title, text, light = false }: { title: string; text: string; light?: boolean }) {
  return (
    <div className="relative">
      <h3 className={`text-2xl font-bold tracking-tight ${light ? "text-white" : "text-ink"}`}>{title}</h3>
      <p className={`mt-2 leading-relaxed ${light ? "text-white/85" : "text-ink"}`}>{text}</p>
    </div>
  );
}

// The features bento: rows of cards with their own pastel or night look
function Bento({ t }: { t: Dictionary }) {
  const c = t.landing.cards;
  return (
    <div className="mt-12 space-y-4">
      {/* The store banner */}
      <div className="grid overflow-hidden rounded-[28px] border border-[#e4e1f5] md:grid-cols-2">
        <div className="flex flex-col justify-center gap-3 bg-[#dcd6ff] p-7 sm:p-9">
          <CardText title={c.store.title} text={c.store.text} />
        </div>
        <StoreScreen t={t} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.35fr]" data-reveal>
        {/* Abandoned carts, with their source */}
        <div className="flex flex-col gap-6 rounded-[28px] bg-[#c9cffc] p-6 sm:p-7">
          <div aria-hidden data-ui>
            <CartsTable t={t} />
          </div>
          <CardText title={c.carts.title} text={c.carts.text} />
        </div>
        {/* Image landing pages */}
        <div className="relative flex flex-col gap-6 overflow-hidden rounded-[28px] bg-[#140c4a] p-6 sm:p-7">
          <CardText title={c.posters.title} text={c.posters.text} light />
          <PosterStack t={t} />
        </div>
        {/* AI landing pages */}
        <div className="relative flex flex-col gap-6 overflow-hidden rounded-[28px] bg-ink p-6 sm:p-7">
          <CardText title={c.ai.title} text={c.ai.text} light />
          <AiScreen t={t} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr_1fr]" data-reveal>
        {/* Analytics */}
        <div className="flex flex-col gap-6 rounded-[28px] bg-[#f6f5ff] p-6 sm:p-7">
          <AnalyticsScreen t={t} />
          <CardText title={c.analytics.title} text={c.analytics.text} />
        </div>
        {/* Stock and variants */}
        <div className="flex flex-col gap-6 rounded-[28px] bg-[#bdeee2] p-6 sm:p-7">
          <CardText title={c.stock.title} text={c.stock.text} />
          <StockScreen t={t} />
        </div>
        {/* Fake-order protection, drawn as a receipt */}
        <div className="flex flex-col gap-6 rounded-[28px] bg-[#f9d5e0] p-6 sm:p-7">
          <CardText title={c.guard.title} text={c.guard.text} />
          <GuardTicket t={t} />
        </div>
      </div>
    </div>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/70 bg-white p-4 ${className}`}>{children}</div>;
}

function StoreScreen({ t }: { t: Dictionary }) {
  const l = t.landing;
  const tiles = ["bg-[#ffe1cc]", "bg-[#d9e7ff]", "bg-[#e3f8ec]"];
  return (
    <div className="relative bg-white p-6 sm:p-8" aria-hidden data-ui>
      <div className="rounded-2xl border border-[#efedf7] p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-bold text-ink">
            <span className="size-6 rounded-lg bg-[#ffb36b]" /> Atlas Shop
          </span>
          <ShoppingCart size={16} className="text-muted" />
        </div>
        <p className="mt-4 text-sm font-semibold text-ink">{l.cards.store.best}</p>
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {tiles.map((tile, i) => (
            <div key={tile}>
              <div className={`flex aspect-square items-center justify-center rounded-xl ${tile}`}>
                {i === 0 ? <WatchIcon /> : i === 1 ? <Headphones size={26} className="text-[#3b5bdb]" /> : <Package size={26} className="text-[#2f9e44]" />}
              </div>
              <span className="mt-1.5 block h-2 w-3/4 rounded bg-[#efedf7]" />
              <span className="mt-1 block h-2 w-1/2 rounded bg-[#e0dcf5]" />
            </div>
          ))}
        </div>
        <div className="mt-4 flex h-9 items-center justify-center rounded-xl bg-[#ffb36b] text-sm font-bold text-[#3b2410]">{l.mock.order}</div>
      </div>
    </div>
  );
}

function WatchIcon() {
  return (
    <span className="flex size-10 items-center justify-center rounded-[12px] border-[3px] border-[#c2410c]/80 bg-white/60">
      <span className="h-3 w-0.5 origin-bottom -translate-y-1 rotate-45 rounded bg-[#c2410c]" />
    </span>
  );
}

function CartsTable({ t }: { t: Dictionary }) {
  const c = t.landing.cards.carts;
  const rows: [string, string, string, boolean][] = [
    ["Facebook", "bg-[#e7f0ff] text-[#1d4ed8]", c.abandoned, false],
    ["TikTok", "bg-[#f1f1f1] text-ink", c.converted, true],
    ["Instagram", "bg-[#fde8f1] text-[#be185d]", c.converted, true],
    ["Google", "bg-[#e8f5ec] text-[#15803d]", c.abandoned, false],
    [c.other, "bg-[#f4f3fa] text-muted", c.abandoned, false],
  ];
  return (
    <Panel className="p-0 text-xs">
      <div className="flex justify-between border-b border-[#f0eef8] px-4 py-2.5 font-semibold text-ink">
        <span>{c.source}</span>
        <span>{c.status}</span>
      </div>
      <ul className="divide-y divide-white">
        {rows.map(([source, tone, status, won]) => (
          <li key={source} className="flex items-center justify-between px-4 py-2.5">
            <span className={`rounded-full px-2.5 py-0.5 font-semibold ${tone}`} dir="ltr">
              {source}
            </span>
            <span className={`rounded-md px-2 py-0.5 font-semibold ${won ? "bg-[#ecfdf3] text-[#047857]" : "bg-[#fdecec] text-danger"}`}>{status}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// Three designed images stacked like the page they make
function PosterStack({ t }: { t: Dictionary }) {
  const looks = ["bg-[#5b45e0]", "bg-[#b45309]", "bg-[#0f766e]"];
  const texts = t.landing.cards.ai.chips;
  return (
    <div className="relative mx-auto mt-auto h-56 w-full max-w-[15rem]" aria-hidden data-ui>
      {looks.map((look, i) => (
        <div
          key={look}
          className={`absolute inset-x-0 mx-auto flex h-44 w-36 flex-col justify-between rounded-2xl ${look} p-3 text-white ring-1 ring-white/20`}
          style={{ top: `${i * 14}px`, transform: `translateX(${(i - 1) * 46}px) rotate(${(i - 1) * 7}deg)`, zIndex: i === 1 ? 3 : 1 }}
        >
          <span className="text-sm leading-tight font-bold">{texts[i]}</span>
          <span className="mx-auto mb-1">
            <WatchIcon />
          </span>
        </div>
      ))}
      <Sparkles size={22} className="absolute end-0 bottom-2 text-[#c9c1ff]" />
    </div>
  );
}

// The AI page generator: a phone with the "generate" header and the sections being written
function AiScreen({ t }: { t: Dictionary }) {
  const a = t.landing.cards.ai;
  return (
    <div className="relative mx-auto mt-auto w-full max-w-sm" aria-hidden data-ui>
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#4f3bd6]">
        <Sparkles size={26} className="text-white" />
      </div>
      <div className="mx-auto mt-4 w-56 overflow-hidden rounded-t-[26px] border-x-4 border-t-4 border-[#a99ff8]/60 bg-white">
        <p className="bg-[#5b45e0] px-3 py-3 text-center text-sm font-bold text-white">{a.generate}</p>
        <div className="grid grid-cols-2 gap-2 p-3">
          {a.chips.map((chip, i) => (
            <span key={chip} className={`flex h-12 items-center justify-center rounded-lg border text-[11px] font-semibold ${i === 0 ? "border-accent bg-[#efedff] text-accent" : "border-[#efedf7] text-muted"}`}>
              {chip}
            </span>
          ))}
        </div>
      </div>
      {/* Floating section chips */}
      <span className="absolute start-0 top-24 -rotate-12 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-accent">{a.chips[1]}</span>
      <span className="absolute end-0 top-32 rotate-12 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-accent">{a.chips[3]}</span>
    </div>
  );
}

function AnalyticsScreen({ t }: { t: Dictionary }) {
  const c = t.landing.cards.analytics;
  return (
    <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr]" aria-hidden data-ui>
      <Panel>
        <p className="text-sm font-bold text-ink">{c.chart}</p>
        <svg viewBox="0 0 200 90" className="mt-3 h-28 w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="home-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#7c6cf2" stopOpacity=".35" />
              <stop offset="100%" stopColor="#7c6cf2" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 70 C20 66 30 40 50 46 S80 72 100 50 S140 14 160 26 S190 40 200 12 L200 90 L0 90 Z" fill="url(#home-area)" />
          <path d="M0 70 C20 66 30 40 50 46 S80 72 100 50 S140 14 160 26 S190 40 200 12" fill="none" stroke="#6d5cf0" strokeWidth="2.5" />
        </svg>
        <p className="mt-2 text-xs font-semibold text-[#047857]">{c.change}</p>
      </Panel>
      <Panel className="space-y-2.5">
        <p className="text-sm font-bold text-ink">{c.best}</p>
        {c.products.map((p, i) => (
          <div key={p} className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs ${i === 0 ? "bg-[#efedff]" : ""}`}>
            {i === 0 ? <Crown size={15} className="text-accent" /> : <span className="w-[15px] text-center text-muted tabular-nums">{i + 1}</span>}
            <span className={`font-semibold ${i === 0 ? "text-accent" : "text-ink"}`}>{p}</span>
          </div>
        ))}
      </Panel>
    </div>
  );
}

function StockScreen({ t }: { t: Dictionary }) {
  const c = t.landing.cards.stock;
  const [black, white, m, l] = c.values;
  return (
    <div className="mt-auto space-y-3" aria-hidden data-ui>
      <Panel>
        <p className="text-sm font-bold text-ink">{c.stock}</p>
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2 text-xs">
          <span className="rounded-lg border border-[#efedf7] px-3 py-2 text-muted" dir="ltr">
            WATCH-01
          </span>
          <span className="rounded-lg border border-[#efedf7] px-3 py-2 font-semibold text-ink tabular-nums">48</span>
        </div>
      </Panel>
      <Panel className="space-y-2 text-xs">
        {[
          [c.color, [black, white]],
          [c.size, [m, l]],
        ].map(([label, values]) => (
          <div key={label as string} className="flex items-center gap-2">
            <span className="w-14 text-muted">{label as string}</span>
            {(values as string[]).map((v) => (
              <span key={v} className="rounded-md bg-[#efedff] px-2 py-1 font-semibold text-accent">
                {v}
              </span>
            ))}
          </div>
        ))}
      </Panel>
    </div>
  );
}

function GuardTicket({ t }: { t: Dictionary }) {
  const c = t.landing.cards.guard;
  return (
    <div className="relative mt-auto rounded-2xl bg-white px-5 pt-5 pb-7" aria-hidden data-ui>
      <div className="flex items-center gap-3 border-b border-dashed border-[#f1d9de] pb-3">
        <ShieldCheck size={22} className="text-accent" />
        <span className="font-bold text-ink">{t.brand}</span>
      </div>
      <ul className="mt-3 space-y-2.5 text-sm">
        {c.items.map((item) => (
          <li key={item} className="flex items-center justify-between">
            <span className="text-ink">{item}</span>
            <Check size={16} className="text-[#047857]" />
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between border-t border-[#f1d9de] pt-3 text-sm">
        <span className="text-muted">{c.blocked}</span>
        <span className="font-bold text-danger tabular-nums">23</span>
      </div>
      {/* The torn bottom of the receipt */}
      <span className="absolute inset-x-3 -bottom-2 flex justify-between">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className="size-4 rounded-full bg-[#f9d5e0]" />
        ))}
      </span>
    </div>
  );
}

// Integrations: a pastel top with the app's tile, then what it does
function Apps({ t }: { t: Dictionary }) {
  // Each app's own colour, on its mark only
  const looks: [LucideIcon, string][] = [
    [Sheet, "bg-[#1e9e5a]"],
    [Tag, "bg-[#2f7cf6]"],
    [Radar, "bg-[#5b45e0]"],
    [Webhook, "bg-[#d97706]"],
    [Download, "bg-[#4d7c0f]"],
  ];
  // A list set in large type on one tinted field (no row of identical cards)
  return (
    <ul className="mt-12 grid gap-x-12 gap-y-9 rounded-[28px] bg-[#f4f2ff] p-7 sm:p-10 md:grid-cols-2" data-reveal>
      {t.landing.apps.map(([name, text], i) => {
        const [Icon, tile] = looks[i];
        return (
          <li key={name} className="flex items-start gap-4">
            <span className={`mt-1 flex size-11 shrink-0 items-center justify-center rounded-xl ${tile} text-white`} aria-hidden>
              <Icon size={22} />
            </span>
            <span className="min-w-0">
              <h3 className="text-2xl font-bold tracking-tight text-ink" dir="auto">
                {name}
              </h3>
              <p className="mt-1.5 text-base leading-relaxed text-ink">{text}</p>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// Delivery: the couriers' cards and the "send confirmed orders" settings, tilted like ayor's collage
function DeliveryCollage({ t }: { t: Dictionary }) {
  const l = t.landing;
  const d = l.deliveryCard;
  const carriers: [string, string, boolean][] = [
    ["Yalidine", "bg-[#e11d48]", true],
    ["ZR Express", "bg-[#f59e0b]", true],
    ["NOEST", "bg-[#0ea5e9]", false],
    ["Ecotrack", "bg-[#16a34a]", false],
    ["DHD", "bg-[#7c3aed]", false],
    ["Procolis", "bg-[#334155]", false],
  ];
  return (
    <div className="relative mt-12 [perspective:1600px]" aria-hidden data-ui data-reveal>
      <div className="grid gap-4 md:grid-cols-[1fr_1.5fr] md:[transform:rotateX(14deg)_rotateZ(-3deg)]">
        <Panel className="space-y-3 border-[#ebe8f7]">
          <p className="flex items-center gap-2 font-bold text-ink">
            <Truck size={18} className="text-accent" /> {d.title}
          </p>
          <div className="rounded-xl border border-[#efedf7] p-3 text-sm">
            <p className="text-xs text-muted">{d.type}</p>
            <p className="mt-1 font-semibold text-ink">{d.both}</p>
          </div>
          <div className="rounded-xl border border-[#efedf7] p-3 text-sm">
            <p className="text-xs text-muted">{d.wilayas}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {d.wilayaNames.map((w) => (
                <span key={w} className="rounded-md bg-[#efedff] px-2 py-0.5 text-xs font-semibold text-accent">
                  {w}
                </span>
              ))}
            </div>
          </div>
          <p className="flex items-center gap-2 rounded-xl bg-[#ecfdf3] px-3 py-2 text-sm font-semibold text-[#047857]">
            <CheckCircle2 size={16} /> 18 {d.ready}
          </p>
        </Panel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {carriers.map(([name, color, on]) => (
            <Panel key={name} className="flex flex-col items-center gap-2 border-[#ebe8f7] text-center">
              <span className={`flex size-12 items-center justify-center rounded-2xl ${color} text-lg font-bold text-white`}>{name.charAt(0)}</span>
              <span className="text-sm font-bold text-ink" dir="ltr">
                {name}
              </span>
              <span className={`w-full rounded-lg py-1.5 text-xs font-semibold ${on ? "bg-[#ecfdf3] text-[#047857]" : "border border-[#e4e1f5] text-accent"}`}>{on ? l.connected : l.connect}</span>
            </Panel>
          ))}
        </div>
      </div>
    </div>
  );
}

// The confirmation team, on three phones: sharing, the call, the performance
function TeamPhones({ t }: { t: Dictionary }) {
  const l = t.landing;
  const m = l.teamMock;
  const icons: [LucideIcon, string][] = [
    [Users, "bg-[#f59e0b]"],
    [PhoneCall, "bg-[#16a34a]"],
    [BarChart3, "bg-[#e11d48]"],
  ];
  const screens = [
    <div key="share" className="space-y-2.5">
      {m.agents.map(([name, n], i) => (
        <div key={name} className="flex items-center gap-2.5 rounded-xl bg-[#f7f6ff] p-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-[#5b45e0] text-xs font-bold text-white">{name.charAt(0)}</span>
          <span className="flex-1">
            <span className="block text-xs font-bold text-ink">{name}</span>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[#e4e1f5]">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${[70, 52, 64][i]}%` }} />
            </span>
          </span>
          <span className="text-xs font-bold text-ink tabular-nums">{n}</span>
        </div>
      ))}
      <p className="text-center text-[11px] text-muted">{m.open}</p>
    </div>,
    <div key="call" className="space-y-2.5">
      <p className="text-xs font-bold text-ink">{m.guide}</p>
      {m.guideLines.map((line, i) => (
        <p key={line} className="flex items-start gap-2 rounded-lg bg-[#f7f6ff] p-2 text-[11px] text-ink">
          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">{i + 1}</span>
          {line}
        </p>
      ))}
      <p className="flex items-center justify-center gap-1.5 rounded-lg bg-[#16a34a] py-2 text-[11px] font-bold text-white">
        <Check size={13} /> {m.send}
      </p>
    </div>,
    <div key="stats" className="space-y-2.5">
      {[
        [m.rate, "78%", 78],
        [m.attendance, "96%", 96],
      ].map(([label, value, w]) => (
        <div key={label as string} className="rounded-xl bg-[#f7f6ff] p-2.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-muted">{label as string}</span>
            <span className="font-bold text-ink tabular-nums">{value as string}</span>
          </div>
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[#e4e1f5]">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${w}%` }} />
          </span>
        </div>
      ))}
      <div className="flex items-center justify-between rounded-xl bg-[#f7f6ff] p-2.5 text-[11px]">
        <span className="text-muted">{m.speed}</span>
        <span className="font-bold text-ink">{m.speedValue}</span>
      </div>
    </div>,
  ];
  return (
    <ul className="mt-12 grid gap-6 sm:grid-cols-3" aria-hidden data-ui data-reveal>
      {l.team.map(([label, hint], i) => {
        const [Icon, tone] = icons[i];
        return (
          <li key={label} className="flex flex-col items-center gap-5">
            <div className="flex h-80 w-full items-end justify-center overflow-hidden rounded-[28px] bg-[#f7f6ff] px-6 pt-8">
              <div className="h-full w-full max-w-[220px] rounded-t-[30px] border-x-[6px] border-t-[6px] border-ink bg-white px-3.5 pt-6">
                <span className="mx-auto mb-4 block h-4 w-20 rounded-full bg-ink" />
                {screens[i]}
              </div>
            </div>
            <p className="flex items-center gap-2.5 text-xl font-bold text-ink">
              <span className={`flex size-8 items-center justify-center rounded-lg ${tone} text-white`}>
                <Icon size={17} />
              </span>
              {label}
            </p>
            <p className="-mt-3 text-sm text-muted">{hint}</p>
          </li>
        );
      })}
    </ul>
  );
}

// The plans as stored by the platform admin (prices and limits are never written by hand here), then the custom plan
function Pricing({ lang, t, plans, contact }: { lang: Locale; t: Dictionary; plans: HomePlan[]; contact?: string }) {
  const l = t.landing;
  const p = t.plans;
  const register = `/${lang}/register`;
  const custom = p.custom;
  const contactHref = contact ? `https://wa.me/${contact}?text=${encodeURIComponent(custom.whatsapp)}` : register;
  return (
    <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-24 sm:pt-32">
      <div className="mx-auto max-w-2xl text-center" data-reveal>
        <h2 className={`text-[2.1rem] leading-[1.15] font-bold tracking-tight text-balance sm:text-5xl ${violetText}`}>{l.pricingTitle}</h2>
        <p className="mt-5 text-lg text-ink">{l.pricingText}</p>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5" data-testid="home-pricing" data-reveal>
        {plans.map((plan) => {
          const picked = plan.code === RECOMMENDED;
          const tag = plan.orderPack ? p.payg : picked ? p.recommended : null;
          const price = priceParts(plan, t);
          return (
            <div
              key={plan.code}
              className={`relative flex flex-col items-center rounded-[22px] px-5 pt-8 pb-6 text-center ${picked ? "bg-ink text-white" : "bg-[#f4f2ff]"}`}
              data-plan={plan.code}
            >
              <h3 className={`text-2xl font-bold ${picked ? "text-white" : "text-ink"}`}>{plan.name}</h3>
              <p className={`mt-4 text-3xl font-bold tracking-tight tabular-nums ${picked ? "text-white" : "text-ink"}`}>{price.amount}</p>
              <p className={`mt-1 min-h-5 text-sm ${picked ? "text-white/85" : "text-ink"}`}>{price.note}</p>
              <Link href={register} className={`mt-6 w-full rounded-xl py-3 text-sm font-medium transition active:scale-[.98] ${picked ? "bg-white text-ink hover:bg-[#efedff]" : "bg-ink text-white hover:bg-[#1d1650]"}`}>
                {l.choose}
              </Link>
              {/* What sets this plan apart, said with its tagline (no badge above the price) */}
              <p className={`mt-4 text-sm ${picked ? "text-white/85" : "text-ink"}`}>
                {tag && <b className={`block font-semibold ${picked ? "text-[#c9c2ff]" : "text-accent"}`}>{tag}</b>}
                {(p.taglines as Record<string, string>)[plan.code] ?? ""}
              </p>
            </div>
          );
        })}
        <div className="flex flex-col items-center rounded-[22px] bg-[#f4f2ff] px-5 pt-8 pb-6 text-center" data-plan="custom">
          <h3 className="text-2xl font-bold text-ink">{custom.name}</h3>
          <p className="mt-4 text-3xl font-bold tracking-tight text-ink">{custom.price}</p>
          <p className="mt-1 min-h-5" />
          <a href={contactHref} target={contact ? "_blank" : undefined} rel={contact ? "noreferrer" : undefined} className="mt-6 w-full rounded-xl bg-ink py-3 text-sm font-medium text-white transition hover:bg-[#1d1650] active:scale-[.98]">
            {custom.contact}
          </a>
          <p className="mt-4 text-sm text-ink">{custom.tagline}</p>
        </div>
      </div>
      <Compare t={t} plans={plans} />
    </section>
  );
}

function Compare({ t, plans }: { t: Dictionary; plans: HomePlan[] }) {
  const l = t.landing;
  const p = t.plans;
  return (
    <div id="compare" className="mt-16 scroll-mt-24">
      <h3 className="text-center text-2xl font-bold text-ink">{l.compareTitle}</h3>
      <div className="mt-6 overflow-x-auto rounded-[22px] bg-[#f4f2ff]">
        <table className="w-full min-w-[640px] text-sm" data-testid="plan-compare">
          <thead>
            <tr className="text-ink">
              <th className="p-4 text-start font-semibold" />
              {plans.map((plan) => (
                <th key={plan.code} className="p-4 font-bold">
                  {plan.name}
                </th>
              ))}
              <th className="p-4 font-bold">{p.custom.name}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white">
            {limitKeys.map((k) => (
              <tr key={k}>
                <td className="p-4 text-ink">{p.limits[k]}</td>
                {plans.map((plan) => {
                  const line = limitLine(plan, k, t);
                  return (
                    <td key={plan.code} className="p-4 text-center font-semibold text-ink tabular-nums">
                      {line.value || line.label}
                    </td>
                  );
                })}
                <td className="p-4 text-center text-muted">{p.custom.price}</td>
              </tr>
            ))}
            <tr>
              <td className="p-4 text-ink">{l.customDomain}</td>
              {plans.map((plan) => (
                <td key={plan.code} className="p-4 text-center">
                  {plan.features.includes("custom_domain") ? <Check size={18} className="mx-auto text-[#047857]" aria-label="✓" /> : <X size={18} className="mx-auto text-muted" aria-label="✕" />}
                </td>
              ))}
              <td className="p-4 text-center">
                <Check size={18} className="mx-auto text-[#047857]" aria-label="✓" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-center text-sm text-ink">{p.allFeatures}</p>
    </div>
  );
}
