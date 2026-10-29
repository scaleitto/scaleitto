import Link from "next/link";
import type { ReactNode } from "react";
import {
  BarChart3,
  CheckCircle2,
  Download,
  Globe,
  LayoutTemplate,
  MessageCircle,
  MousePointerClick,
  PackageCheck,
  Palette,
  PhoneCall,
  Radar,
  Sheet,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Truck,
  type LucideIcon,
} from "lucide-react";
import type { Dictionary, Locale } from "@/i18n";
import { fmt, formatPrice } from "@/lib/format";
import { limitKeys } from "@/lib/enums";
import type { Limits } from "@/server/db/schema";
import { buttonClass } from "@/ui";
import { LanguageSwitcher } from "@/ui/LanguageSwitcher";

// The platform's public homepage (design-system/scaleitto/pages/homepage.md). One bold object — the shipping label
// of a cash-on-delivery parcel, stamped "confirmed" — and quiet, real content everywhere else.
const INK = "bg-sidebar";

export type HomePlan = { code: string; name: string; priceMonthly: number; limits: Limits };

function Mark() {
  return <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#34d399] to-accent text-lg font-bold text-white shadow-sm">S</span>;
}

export function MarketingHome({ lang, t, plans }: { lang: Locale; t: Dictionary; plans: HomePlan[] }) {
  const l = t.landing;
  const register = `/${lang}/register`;
  const nav = [
    ["#journey", l.nav.journey],
    ["#features", l.nav.features],
    ...(plans.length ? [["#pricing", l.nav.pricing]] : []),
  ];
  return (
    <div className="min-h-screen overflow-x-hidden bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href={`/${lang}`} className="flex items-center gap-2.5">
            <Mark />
            <span className="text-xl font-bold tracking-tight">{t.brand}</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted md:flex">
            {nav.map(([href, label]) => (
              <a key={href} href={href} className="transition-colors hover:text-fg">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher current={lang} />
            {/* Phones: no room for both actions, the sign-in link waits for wider screens */}
            <span className="hidden sm:contents">
              <Link href={`/${lang}/login`} className={buttonClass("ghost", "whitespace-nowrap")}>
                {l.login}
              </Link>
            </span>
            <Link href={register} className={buttonClass("primary", "px-3 whitespace-nowrap sm:px-4")}>
              <span className="sm:hidden">{l.start}</span>
              <span className="hidden sm:inline">{l.cta}</span>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero: the promise, and the object every order of this business ends as — a stamped shipping label */}
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-12 pb-20 md:grid-cols-[1.15fr_1fr] md:pt-20 md:pb-28">
          <div>
            <h1 className="text-[2.4rem] leading-[1.12] font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.75rem]">{l.title}</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">{l.subtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={register} className={buttonClass("primary", "px-7 py-3.5 text-base shadow-[0_10px_24px_-10px_rgba(4,120,87,.6)]")}>
                {l.cta}
              </Link>
              <a href="#journey" className={buttonClass("secondary", "px-6 py-3.5 text-base")}>
                {l.how}
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-muted">
              {l.facts.map((f) => (
                <li key={f} className="flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-accent" aria-hidden /> {f}
                </li>
              ))}
            </ul>
          </div>
          <Waybill t={t} />
        </section>

        {/* The order's journey: a real sequence, drawn as one rail */}
        <section id="journey" className={`${INK} scroll-mt-16 text-white`}>
          <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
            <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">{l.journeyTitle}</h2>
            <ol className="relative mt-12 grid gap-8 ps-8 lg:grid-cols-6 lg:gap-6 lg:ps-0 lg:pt-10">
              {/* The rail: vertical on phones and tablets, horizontal on large screens */}
              <span aria-hidden className="absolute inset-y-1 start-[11px] w-px bg-white/15 lg:inset-x-0 lg:top-[11px] lg:bottom-auto lg:h-px lg:w-auto" />
              {l.journey.map(([title, hint], i) => {
                const Icon = journeyIcons[i];
                return (
                  <li key={title} className="relative">
                    <span aria-hidden className="absolute -start-8 top-0 flex size-6 items-center justify-center rounded-full bg-sidebar ring-1 ring-accent-bright/60 lg:start-0 lg:-top-10">
                      <span className="size-2 rounded-full bg-accent-bright" />
                    </span>
                    <p className="text-sm font-medium text-accent-bright tabular-nums">{i + 1}</p>
                    <p className="mt-1 flex items-center gap-2 text-lg font-bold">
                      <Icon size={18} className="text-white/60" aria-hidden /> {title}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/65">{hint}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* Three main features, alternating sides, each with a small screen made of real content */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-16 space-y-20 px-4 py-20 md:space-y-28 md:py-28">
          {l.rows.map(([title, text], i) => (
            <div key={title} className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
              <div className={i % 2 ? "md:order-2" : ""}>
                <h2 className="text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">{title}</h2>
                <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted">{text}</p>
              </div>
              <div className={i % 2 ? "md:order-1" : ""}>{[<PagesPicture key="p" t={t} />, <OrdersPicture key="o" t={t} />, <DeliveryPicture key="d" t={t} />][i]}</div>
            </div>
          ))}
        </section>

        <section className="border-y border-line bg-panel">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{l.moreTitle}</h2>
            <ul className="mt-8 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
              {l.more.map(([title, hint], i) => {
                const Icon = moreIcons[i];
                return (
                  <li key={title} className="flex gap-4 border-t border-line py-5">
                    <Icon size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                    <span>
                      <span className="block font-bold">{title}</span>
                      <span className="mt-0.5 block text-sm text-muted">{hint}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {plans.length > 0 && <Pricing lang={lang} t={t} plans={plans} />}

        {/* Closing: the ink band torn like the bottom of a shipping label */}
        <section className={`${INK} relative mt-4 text-white`}>
          <span aria-hidden className="perforation absolute inset-x-0 -top-2 h-4" />
          <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-16 text-center md:py-20">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{l.ctaTitle}</h2>
            <p className="mt-3 max-w-lg text-white/70">{l.ctaText}</p>
            <Link href={register} className="mt-8 inline-flex items-center justify-center rounded-[10px] bg-white px-8 py-3.5 text-base font-bold text-sidebar transition-colors hover:bg-emerald-50 focus-visible:ring-4 focus-visible:ring-accent-bright/50 focus-visible:outline-none">
              {l.cta}
            </Link>
          </div>
        </section>
      </main>

      <footer className={`${INK} border-t border-white/10 text-white/60`}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm">
          <span className="flex items-center gap-2 font-bold text-white">
            <Mark /> {t.brand}
          </span>
          <span>
            © {t.brand}. {l.rights}
          </span>
        </div>
      </footer>
    </div>
  );
}

const journeyIcons: LucideIcon[] = [MousePointerClick, LayoutTemplate, ShoppingBag, PhoneCall, Truck, BarChart3];
const moreIcons: LucideIcon[] = [ShieldCheck, ShoppingCart, MessageCircle, Radar, Sheet, BarChart3, Globe, Palette, Download];

// A barcode drawn from the order number (decorative)
function Barcode({ value }: { value: string }) {
  const bars = [...value.repeat(4)].flatMap((d, i) => [1 + (Number(d) % 3), 1 + ((Number(d) + i) % 2)]);
  let x = 0;
  return (
    <svg viewBox={`0 0 ${bars.reduce((a, b) => a + b, 0)} 40`} preserveAspectRatio="none" className="h-10 w-full" aria-hidden>
      {bars.map((w, i) => {
        const rect = i % 2 === 0 ? <rect key={i} x={x} y="0" width={w} height="40" fill="currentColor" /> : null;
        x += w;
        return rect;
      })}
    </svg>
  );
}

// The hero object: a cash-on-delivery shipping label on a kraft parcel, with the "confirmed" stamp
function Waybill({ t }: { t: Dictionary }) {
  const l = t.landing;
  const w = l.waybill;
  const rows = [
    [w.to, l.sampleCustomer],
    [w.city, l.sampleCity],
    [w.item, l.mock.product],
  ];
  return (
    <div className="relative mx-auto w-full max-w-[25rem] py-6" aria-hidden>
      {/* The parcel */}
      <div className="absolute inset-x-6 inset-y-0 rotate-[4deg] rounded-[18px] bg-[#d8c3a0] shadow-[inset_0_0_0_1px_rgba(0,0,0,.06)]">
        <span className="absolute inset-y-0 start-1/2 w-10 -translate-x-1/2 bg-[#cbb48c] rtl:translate-x-1/2" />
      </div>
      {/* The label */}
      <div className="ticket-in relative -rotate-[2deg] rounded-[6px] bg-panel p-5 shadow-[0_2px_4px_rgba(11,42,31,.08),0_28px_60px_-24px_rgba(11,42,31,.45)]">
        <div className="flex items-center justify-between border-b-2 border-fg pb-3">
          <span className="text-sm font-bold">{w.title}</span>
          <span className="text-2xl font-bold tabular-nums" dir="ltr">
            #1043
          </span>
        </div>
        <dl className="divide-y divide-dashed divide-line text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2.5">
              <dt className="text-muted">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-2 flex items-end justify-between gap-4 rounded-[4px] bg-fg px-3 py-2.5 text-white">
          <span className="text-xs text-white/70">{w.cod}</span>
          <span className="text-xl font-bold tabular-nums">{l.sampleOrders[0][2]}</span>
        </div>
        <div className="mt-4 text-fg">
          <Barcode value="1043" />
          <p className="mt-1 text-center text-[11px] tracking-[0.3em] text-muted tabular-nums" dir="ltr">
            1043 0661 2345 67
          </p>
        </div>
        {/* The stamp lands once on load */}
        <span className="stamp-in absolute -end-3 bottom-14 flex -rotate-12 items-center gap-1.5 rounded-[6px] border-[3px] border-accent bg-panel/90 px-3 py-1.5 text-base font-bold text-accent shadow-sm sm:-end-8">
          <PackageCheck size={18} /> {l.mock.confirmed}
        </span>
      </div>
    </div>
  );
}

function Screen({ children }: { children: ReactNode }) {
  return <div className="rounded-[18px] border border-line bg-panel p-4 shadow-[0_1px_2px_rgba(16,24,40,.05),0_28px_56px_-28px_rgba(11,42,31,.3)] sm:p-5">{children}</div>;
}

// AI image landing pages: three designed images with their text, as the page shows them
function PagesPicture({ t }: { t: Dictionary }) {
  const looks = ["from-[#0f3d2e] to-[#0b2a1f]", "from-[#f4b740] to-[#e08a1e]", "from-[#1e3a8a] to-[#312e81]"];
  return (
    <Screen>
      <Sparkles size={18} className="mb-3 text-accent" aria-hidden />
      <div className="grid grid-cols-3 gap-2.5" aria-hidden>
        {t.landing.posterSamples.map((text, i) => (
          <div key={text} className={`relative flex aspect-[2/3] flex-col justify-between overflow-hidden rounded-xl bg-gradient-to-b ${looks[i]} p-2.5 text-white`}>
            <p className="text-[13px] leading-tight font-bold sm:text-sm">{text}</p>
            {/* The product in each image: a watch face */}
            <span className="mx-auto mb-2 flex size-12 items-center justify-center rounded-[14px] border-[3px] border-white/85 bg-black/25 sm:size-14">
              <span className="h-3 w-0.5 origin-bottom -translate-y-1 rotate-45 rounded bg-white" />
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex h-10 items-center justify-center rounded-xl bg-accent text-sm font-bold text-white">{t.landing.mock.order}</div>
    </Screen>
  );
}

// The orders list: who ordered, from where, how much, the status and the agent in charge
function OrdersPicture({ t }: { t: Dictionary }) {
  const m = t.landing.mock;
  const statuses = [
    [m.new, "bg-warning/10 text-warning"],
    [m.confirmed, "bg-accent/10 text-accent"],
    [m.confirmed, "bg-accent/10 text-accent"],
    [m.delivered, "bg-info/10 text-info"],
  ];
  return (
    <Screen>
      <ul className="divide-y divide-line" aria-hidden>
        {t.landing.sampleOrders.map(([name, city, amount], i) => (
          <li key={name} className="flex items-center gap-3 py-3 text-sm">
            <span className="w-11 shrink-0 font-semibold text-muted tabular-nums" dir="ltr">
              #{1043 - i}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{name}</span>
              <span className="block text-xs text-muted">{city}</span>
            </span>
            <span className="hidden font-semibold tabular-nums sm:block">{amount}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${statuses[i][1]}`}>{statuses[i][0]}</span>
          </li>
        ))}
      </ul>
    </Screen>
  );
}

// Tracking a parcel through the delivery companies the platform connects to
function DeliveryPicture({ t }: { t: Dictionary }) {
  const steps = [t.landing.journey[2][0], t.landing.journey[3][0], t.landing.journey[4][0], t.landing.mock.delivered];
  const carriers = ["Yalidine", "ZR Express", "NOEST", "DHD", "Ecotrack", "Procolis"];
  return (
    <Screen>
      <ol className="flex items-start" aria-hidden>
        {steps.map((step, i) => (
          <li key={step} className="relative flex flex-1 flex-col items-center gap-2 text-center">
            {i > 0 && <span className={`absolute end-1/2 top-[18px] h-0.5 w-full ${i < 3 ? "bg-accent" : "bg-line"}`} />}
            <span className={`relative flex size-9 items-center justify-center rounded-full ${i < 3 ? "bg-accent text-white" : "border-2 border-dashed border-accent bg-panel text-accent"}`}>
              {i < 3 ? <CheckCircle2 size={17} /> : <PackageCheck size={17} />}
            </span>
            <span className="text-xs font-semibold">{step}</span>
          </li>
        ))}
      </ol>
      <ul className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4" aria-hidden>
        {carriers.map((c) => (
          <li key={c} className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted" dir="ltr">
            {c}
          </li>
        ))}
      </ul>
    </Screen>
  );
}

// The plan the homepage highlights (plan codes are fixed, see the admin plans editor)
const RECOMMENDED = "pro";

// The active plans as stored by the platform admin (prices and limits are never written by hand here)
function Pricing({ lang, t, plans }: { lang: Locale; t: Dictionary; plans: HomePlan[] }) {
  const l = t.landing;
  const p = t.plans;
  return (
    <section id="pricing" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-20 md:py-28">
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{l.pricingTitle}</h2>
      <p className="mt-3 max-w-xl text-lg text-muted">{l.pricingText}</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5" data-testid="home-pricing">
        {plans.map((plan) => {
          const picked = plan.code === RECOMMENDED;
          return (
            <div key={plan.code} className={`relative flex flex-col rounded-[18px] border bg-panel p-6 lg:p-5 ${picked ? "border-accent shadow-[0_18px_40px_-24px_rgba(4,120,87,.55)] ring-1 ring-accent" : "border-line"}`} data-plan={plan.code}>
              {picked && <span className="absolute -top-3 start-6 rounded-full bg-accent px-3 py-0.5 text-xs font-bold text-white">{l.recommended}</span>}
              <h3 className="text-lg font-bold">{plan.name}</h3>
              <p className="mt-1 min-h-10 text-sm leading-snug text-muted">{(p.taglines as Record<string, string>)[plan.code] ?? ""}</p>
              <p className="mt-4 text-2xl font-bold tracking-tight whitespace-nowrap tabular-nums lg:text-xl">{plan.priceMonthly ? fmt(p.perMonth, { price: formatPrice(plan.priceMonthly, t.common.currency) }) : p.free}</p>
              <ul className="mt-5 flex-1 space-y-2.5 border-t border-line pt-5 text-sm">
                {limitKeys.map((k) => (
                  <li key={k} className="flex items-start gap-2">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                    <span>
                      <span className="font-semibold tabular-nums">{plan.limits[k] === -1 ? t.common.unlimited : (plan.limits[k] ?? 0).toLocaleString("fr-FR")}</span> {p.planLimits[k]}
                    </span>
                  </li>
                ))}
              </ul>
              <Link href={`/${lang}/register`} className={buttonClass(picked || !plan.priceMonthly ? "primary" : "secondary", "mt-6 py-3")}>
                {l.choose}
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
