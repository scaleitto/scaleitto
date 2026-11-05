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
  Megaphone,
  MousePointerClick,
  Package,
  PhoneCall,
  Radar,
  Settings,
  Sheet,
  ShieldCheck,
  ShoppingBag,
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
import { liteMap } from "./map-lite";

// The platform's public homepage. Idea: orders arriving from the 69 wilayas. The hero is an illustration of the real map
// of Algeria (light outlines, map-lite.ts) with lit wilayas, delivery routes and order cards around a phone store; then
// the product screen, the journey of an order (a real sequence: ad → analytics), colourful feature cards that each show
// a real part of the product, apps, delivery, the confirmation team, plans and a violet call to action. Everything is
// drawn in HTML/SVG from the dictionary (no images to load) and only shows features that exist.
//
// Palette ("souk at dusk"): royal violet #5B3FF0 (the brand, actions), plum ink #1B1446 (text, never black), mint
// #12C59A (confirmed, money), apricot #FFB23E (parcels), coral #FF6F61 (protection), sky #4CB3FF (delivery), on white and
// lilac mist #F5F2FF. Headings in Readex Pro (--font-readex), text in the interface font.

export type HomePlan = { code: string; name: string; priceMonthly: number; orderPack: number | null; limits: Limits; features: string[] };

// The plan the homepage highlights (plan codes are fixed, see the admin plans editor)
const RECOMMENDED = "rocket";

const display = "font-[family-name:var(--font-readex)] tracking-tight";
const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[#5B3FF0] px-7 py-3.5 text-base font-semibold text-white shadow-[0_14px_30px_-12px_rgba(91,63,240,.65)] transition hover:-translate-y-0.5 hover:bg-[#4B30E0] focus-visible:ring-4 focus-visible:ring-[#5B3FF0]/30 focus-visible:outline-none active:translate-y-0";
const quietButton =
  "inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-base font-semibold text-[#1B1446] ring-1 ring-[#1B1446]/10 transition hover:ring-[#5B3FF0]/40 focus-visible:ring-4 focus-visible:ring-[#5B3FF0]/30 focus-visible:outline-none";
const headingClass = `${display} text-[2.1rem] leading-[1.15] font-bold text-balance text-[#1B1446] sm:text-5xl`;

function Mark({ size = "size-9" }: { size?: string }) {
  return <LogoMark className={size} />;
}

// A section head: the title and its text, then an action
function SectionHead({ title, text, action, center = false }: { title: string; text: string; action?: ReactNode; center?: boolean }) {
  return (
    <div className={`max-w-3xl ${center ? "mx-auto text-center" : ""}`}>
      <h2 className={headingClass}>{title}</h2>
      <p className="mt-5 text-lg leading-relaxed text-[#3d3766]">{text}</p>
      {action && <div className="mt-7">{action}</div>}
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
  const factDots = ["bg-[#12C59A]", "bg-[#FFB23E]", "bg-[#4CB3FF]"];
  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-[#1B1446]">
      <header className="sticky top-0 z-30 border-b border-[#1B1446]/5 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href={`/${lang}`} className="flex items-center gap-2.5">
            <Mark />
            <span className={`${display} text-xl font-bold`}>{t.brand}</span>
          </Link>
          <nav className="hidden items-center gap-8 text-[15px] font-medium text-[#3d3766] md:flex">
            {nav.map(([href, label]) => (
              <a key={href} href={href} className="transition-colors hover:text-[#5B3FF0]">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <LanguageSwitcher current={lang} />
            {/* Phones: no room for both actions, the sign-in link waits for wider screens */}
            <span className="hidden sm:contents">
              <Link href={`/${lang}/login`} className="rounded-full px-4 py-2.5 text-sm font-semibold text-[#1B1446] transition hover:bg-[#F5F2FF]">
                {l.login}
              </Link>
            </span>
            <Link href={register} className="inline-flex items-center rounded-full bg-[#5B3FF0] px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-white transition hover:bg-[#4B30E0] sm:px-5">
              {l.start}
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero: the promise on one side, orders arriving from across Algeria on the other */}
        <section className="relative overflow-hidden bg-[#F5F2FF]">
          <span aria-hidden className="pointer-events-none absolute -top-48 -start-40 size-[560px] rounded-full bg-[#5B3FF0]/20 blur-3xl" />
          <span aria-hidden className="pointer-events-none absolute -bottom-56 end-[-10rem] size-[520px] rounded-full bg-[#12C59A]/20 blur-3xl" />
          <span aria-hidden className="pointer-events-none absolute top-1/3 end-1/3 size-[260px] rounded-full bg-[#FFB23E]/20 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-16 sm:pt-14 lg:grid-cols-[1.15fr_1fr] lg:gap-4 lg:pt-20 lg:pb-24">
            <div className="text-center lg:text-start" data-hero>
              <h1 className={`${display} text-[2.4rem] leading-[1.1] font-bold text-balance sm:text-6xl lg:text-[3.6rem]`}>
                {l.titleTop} {l.titleBottom}
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[#3d3766] sm:text-xl lg:mx-0">{l.subtitle}</p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <Link href={register} className={primaryButton}>
                  {l.cta} <Arrow size={18} aria-hidden />
                </Link>
                <Link href={`/${lang}/login`} className={quietButton}>
                  {l.login}
                </Link>
              </div>
              <ul className="mt-9 flex flex-wrap justify-center gap-2.5 lg:justify-start">
                {l.facts.map((f, i) => (
                  <li key={f} className="flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-medium text-[#1B1446] ring-1 ring-[#1B1446]/5">
                    <span className={`size-2.5 rounded-full ${factDots[i % 3]}`} aria-hidden /> {f}
                  </li>
                ))}
              </ul>
            </div>
            <HeroArt t={t} />
          </div>
        </section>

        {/* The product: the dashboard screen on a violet stage */}
        <section className="relative isolate px-4 pt-16 sm:pt-24">
          <div aria-hidden className="absolute inset-x-4 top-44 bottom-[-3rem] -z-10 mx-auto max-w-6xl rounded-[48px] bg-gradient-to-br from-[#6B50FF] to-[#3A27B0]" />
          <div className="mx-auto max-w-5xl">
            <DashboardScreen t={t} />
          </div>
        </section>

        {/* The journey of an order: a real sequence, so the steps are numbered */}
        <section className="mx-auto max-w-6xl px-4 pt-24 sm:pt-32">
          <SectionHead title={l.journeyTitle} text={l.journeyText} center />
          <Journey steps={l.journey} />
        </section>

        {/* Features: colourful cards, each with a small screen of that part of the product */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-24 sm:pt-32">
          <SectionHead
            title={`${l.featuresTop} ${l.featuresBottom}`}
            text={l.featuresText}
            action={
              <a href="#apps" className={primaryButton}>
                {l.discover}
              </a>
            }
          />
          <Bento t={t} />
        </section>

        {/* Integrations, on a sky field */}
        <section id="apps" className="scroll-mt-20 px-4 pt-24 sm:pt-32">
          <div className="mx-auto max-w-6xl rounded-[40px] bg-[#EAF6FF] px-5 py-12 sm:px-10 sm:py-16">
            <SectionHead title={l.appsTitle} text={l.appsText} />
            <Apps t={t} />
          </div>
        </section>

        {/* Delivery */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-24 sm:pt-32 lg:grid-cols-[1fr_1.3fr]">
          <SectionHead
            title={l.deliveryTitle}
            text={l.deliveryText}
            action={
              <Link href={register} className={primaryButton}>
                {l.deliveryCta}
              </Link>
            }
          />
          <DeliveryCollage t={t} />
        </section>

        {/* The confirmation team: three phone screens */}
        <section className="mx-auto max-w-6xl px-4 pt-24 sm:pt-32">
          <SectionHead title={l.teamTitle} text={l.teamText} center />
          <TeamPhones t={t} />
        </section>

        {plans.length > 0 && <Pricing lang={lang} t={t} plans={plans} contact={contact} />}

        {/* Call to action: the brand's violet field with parcels on their way */}
        <section className="px-4 pt-24 pb-24 sm:pt-32">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[40px] bg-[#5B3FF0] px-6 py-16 text-center text-white sm:py-20">
            <span aria-hidden className="pointer-events-none absolute -top-24 -start-16 size-72 rounded-full bg-[#8B74FF]/60 blur-2xl" />
            <span aria-hidden className="pointer-events-none absolute -bottom-28 -end-10 size-80 rounded-full bg-[#12C59A]/40 blur-2xl" />
            <Parcels />
            <h2 className={`${display} relative text-3xl font-bold text-balance sm:text-5xl`}>{l.ctaTitle}</h2>
            <p className="relative mx-auto mt-4 max-w-lg text-lg text-white/90">{l.ctaText}</p>
            <Link href={register} className="relative mt-9 inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-semibold text-[#1B1446] transition hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-white/40 focus-visible:outline-none">
              {l.cta} <Arrow size={18} aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-[#1B1446] text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="space-y-4">
            <span className={`${display} flex items-center gap-2.5 text-lg font-bold`}>
              <Mark /> {t.brand}
            </span>
            <p className="max-w-sm text-white/80">{l.footer.tagline}</p>
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
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-6 text-sm text-white/70">
          <p>
            © {t.brand}. {l.rights}
          </p>
          <p>{l.mapCredit}</p>
        </div>
      </footer>
    </div>
  );
}

function FooterLinks({ title, links }: { title: string; links: string[][] }) {
  return (
    <div>
      <p className="font-semibold">{title}</p>
      <ul className="mt-4 space-y-3 text-white/80">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="transition-colors hover:text-white">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// The wilayas lit on the hero map, with their colour (Algiers, Oran, Constantine, Sétif, Béjaïa, Ghardaïa, Tamanrasset)
const litWilayas: [number, string][] = [
  [16, "#5B3FF0"],
  [31, "#12C59A"],
  [25, "#FFB23E"],
  [19, "#FF6F61"],
  [6, "#4CB3FF"],
  [47, "#8B74FF"],
  [30, "#12C59A"],
];

// Hero illustration: Algeria's 69 wilayas, routes between the lit ones, order cards and a phone store floating on top
function HeroArt({ t }: { t: Dictionary }) {
  const l = t.landing;
  const m = l.mock;
  const centre = (code: number) => {
    const w = liteMap.find(([c]) => c === code)!;
    return [w[2], w[3]] as const;
  };
  const [ax, ay] = centre(16);
  const routes = [31, 25, 47, 30].map((code) => {
    const [x, y] = centre(code);
    // A gentle arc from Algiers to each wilaya
    const mx = (ax + x) / 2 + (y - ay) * 0.18;
    const my = (ay + y) / 2 - Math.abs(x - ax) * 0.25;
    return `M${ax} ${ay} Q${mx.toFixed(0)} ${my.toFixed(0)} ${x} ${y}`;
  });
  const lit = new Map(litWilayas);
  const [first, second] = l.sampleOrders;
  return (
    <div className="relative mx-auto w-full max-w-[560px]" aria-hidden data-ui>
      <svg viewBox="0 0 600 596" className="w-full drop-shadow-[0_30px_40px_rgba(91,63,240,.18)]">
        <g>
          {liteMap.map(([code, d]) => (
            <path key={code} d={d} fill={lit.get(code) ?? "#E4DEFF"} fillOpacity={lit.has(code) ? 0.9 : 1} stroke="#fff" strokeWidth={1.4} strokeLinejoin="round" />
          ))}
        </g>
        {routes.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="#1B1446" strokeOpacity={0.55} strokeWidth={2} strokeDasharray="6 7" strokeLinecap="round" className="sc-route" style={{ animationDelay: `${i * 0.4}s` }} />
        ))}
        {litWilayas.map(([code, color]) => {
          const [x, y] = centre(code);
          return (
            <g key={code}>
              <circle cx={x} cy={y} r={14} fill={color} opacity={0.25} className="sc-pulse" style={{ transformOrigin: `${x}px ${y}px` }} />
              <circle cx={x} cy={y} r={6.5} fill="#fff" stroke={color} strokeWidth={3.5} />
            </g>
          );
        })}
      </svg>

      {/* Orders arriving */}
      <div className="absolute top-[40%] right-0 w-[11.5rem] sm:w-[13.5rem] rounded-2xl bg-white p-3.5 shadow-[0_18px_40px_-18px_rgba(27,20,70,.45)] sm:right-[-3%]">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#12C59A]/15 text-[#0b8f6f]">
            <ShoppingBag size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[#1B1446]">#1043 · {first[1]}</p>
            <p className="text-sm text-[#3d3766]" dir="auto">
              {first[2]}
            </p>
          </div>
        </div>
        <span className="mt-2.5 inline-flex rounded-full bg-[#12C59A] px-2.5 py-0.5 text-xs font-bold text-white">{m.confirmed}</span>
      </div>
      <div className="absolute bottom-[4%] left-0 w-[11rem] sm:w-[12.5rem] rounded-2xl bg-white p-3.5 shadow-[0_18px_40px_-18px_rgba(27,20,70,.45)] sm:left-[-4%]">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#FFB23E]/20 text-[#b26b00]">
            <Truck size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[#1B1446]">#1042 · {second[1]}</p>
            <p className="text-sm text-[#3d3766]" dir="auto">
              {second[2]}
            </p>
          </div>
        </div>
        <span className="mt-2.5 inline-flex rounded-full bg-[#4CB3FF] px-2.5 py-0.5 text-xs font-bold text-[#0b2a44]">{m.delivered}</span>
      </div>

      {/* The phone store */}
      <div className="absolute bottom-[-4%] right-[24%] hidden w-[9rem] rotate-[6deg] sm:block rounded-[26px] bg-[#1B1446] p-1.5 shadow-[0_30px_50px_-20px_rgba(27,20,70,.6)] sm:w-[10.5rem]">
        <div className="overflow-hidden rounded-[20px] bg-white">
          <div className="flex aspect-[4/3] items-center justify-center bg-[#FFE7C2]">
            <WatchIcon />
          </div>
          <div className="space-y-1.5 p-2.5">
            <p className="truncate text-xs font-bold text-[#1B1446]">{m.product}</p>
            <p className="text-xs font-bold text-[#5B3FF0]" dir="auto">
              4 500 DZD
            </p>
            <span className="block rounded-lg bg-[#5B3FF0] py-1.5 text-center text-xs font-bold text-white">{m.order}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// The journey of an order, ad to analytics: numbered stops on one coloured track
function Journey({ steps }: { steps: string[][] }) {
  const looks: [LucideIcon, string, string, string][] = [
    [Megaphone, "bg-[#FF6F61]", "text-white", "bg-[#FFEDEA]"],
    [MousePointerClick, "bg-[#FFB23E]", "text-[#1B1446]", "bg-[#FFF3DE]"],
    [ShoppingBag, "bg-[#5B3FF0]", "text-white", "bg-[#EEEAFF]"],
    [PhoneCall, "bg-[#12C59A]", "text-[#1B1446]", "bg-[#DDF7EF]"],
    [Truck, "bg-[#4CB3FF]", "text-[#1B1446]", "bg-[#E3F2FF]"],
    [BarChart3, "bg-[#8B74FF]", "text-white", "bg-[#F1EDFF]"],
  ];
  return (
    <ol className="relative mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {steps.map(([title, text], i) => {
        const [Icon, bg, ink, field] = looks[i % looks.length];
        return (
          <li key={title} className={`relative rounded-[28px] p-6 sm:p-7 ${field}`}>
            <div className="flex items-center gap-3">
              <span className={`flex size-12 items-center justify-center rounded-2xl ${bg} ${ink}`} aria-hidden>
                <Icon size={22} />
              </span>
              <span className={`${display} text-sm font-bold text-[#5B3FF0]`}>{i + 1}</span>
            </div>
            <h3 className={`${display} mt-5 text-xl font-bold text-[#1B1446]`}>{title}</h3>
            <p className="mt-2 leading-relaxed text-[#3d3766]">{text}</p>
          </li>
        );
      })}
    </ol>
  );
}

// Parcels drifting across the call to action (decorative)
function Parcels() {
  const boxes: [string, string, string][] = [
    ["start-[6%] top-[18%]", "bg-[#FFB23E]", "rotate-[-12deg]"],
    ["end-[8%] top-[14%]", "bg-[#12C59A]", "rotate-[10deg]"],
    ["start-[14%] bottom-[12%]", "bg-[#FF6F61]", "rotate-[8deg]"],
    ["end-[14%] bottom-[16%]", "bg-[#4CB3FF]", "rotate-[-8deg]"],
  ];
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 hidden sm:block">
      {boxes.map(([pos, bg, rot], i) => (
        <span key={i} className={`absolute ${pos} ${rot} flex size-14 items-center justify-center rounded-2xl ${bg} text-[#1B1446]/80`}>
          <Package size={26} />
        </span>
      ))}
    </span>
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
            <span className="mb-5 flex items-center gap-2 font-bold text-[#1B1446]">
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
            <p className="text-lg font-bold text-[#1B1446]">{m.hello}</p>
            <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
              <div className="relative overflow-hidden rounded-2xl bg-[#5B3FF0] p-5 text-white">
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
                    <span className="font-bold text-[#1B1446] tabular-nums">72%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f0eef8]">
                    <span className="block h-full w-[72%] rounded-full bg-accent" />
                  </div>
                </div>
              </div>
            </div>
            <ul className="divide-y divide-[#F0EDFB] rounded-2xl border border-[#efedf7]">
              {l.sampleOrders.map(([name, city, amount], i) => (
                <li key={name} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="w-12 shrink-0 font-semibold text-muted tabular-nums" dir="ltr">
                    #{1043 - i}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-[#1B1446]">{name}</span>
                    <span className="block text-xs text-muted">{city}</span>
                  </span>
                  <span className="hidden font-semibold text-[#1B1446] tabular-nums sm:block">{amount}</span>
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
      <p className="mt-1 text-2xl font-bold text-[#1B1446] tabular-nums" dir="ltr">
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
      <h3 className={`font-[family-name:var(--font-readex)] text-2xl font-bold tracking-tight ${light ? "text-white" : "text-[#1B1446]"}`}>{title}</h3>
      <p className={`mt-2 leading-relaxed ${light ? "text-white/85" : "text-[#1B1446]"}`}>{text}</p>
    </div>
  );
}

// The features bento: rows of cards with their own pastel or night look
function Bento({ t }: { t: Dictionary }) {
  const c = t.landing.cards;
  return (
    <div className="mt-12 space-y-4">
      {/* The store banner */}
      <div className="grid overflow-hidden rounded-[28px] bg-white ring-1 ring-[#1B1446]/5 md:grid-cols-2">
        <div className="flex flex-col justify-center gap-3 bg-gradient-to-br from-[#FFE7C2] to-[#FFD3A1] p-7 sm:p-9">
          <CardText title={c.store.title} text={c.store.text} />
        </div>
        <StoreScreen t={t} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.35fr]">
        {/* Abandoned carts, with their source */}
        <div className="flex flex-col gap-6 rounded-[28px] bg-gradient-to-b from-[#DDF0FF] to-[#BFE2FF] p-6 sm:p-7">
          <div aria-hidden data-ui>
            <CartsTable t={t} />
          </div>
          <CardText title={c.carts.title} text={c.carts.text} />
        </div>
        {/* Image landing pages */}
        <div className="relative flex flex-col gap-6 overflow-hidden rounded-[28px] bg-gradient-to-b from-[#6B50FF] to-[#4B30E0] p-6 sm:p-7">
          <CardText title={c.posters.title} text={c.posters.text} light />
          <PosterStack t={t} />
        </div>
        {/* AI landing pages */}
        <div className="relative flex flex-col gap-6 overflow-hidden rounded-[28px] bg-gradient-to-b from-[#3A27B0] to-[#22166F] p-6 sm:p-7">
          <CardText title={c.ai.title} text={c.ai.text} light />
          <AiScreen t={t} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr_1fr]">
        {/* Analytics */}
        <div className="flex flex-col gap-6 rounded-[28px] bg-gradient-to-b from-[#EDE9FF] to-[#DCD4FF] p-6 sm:p-7">
          <AnalyticsScreen t={t} />
          <CardText title={c.analytics.title} text={c.analytics.text} />
        </div>
        {/* Stock and variants */}
        <div className="flex flex-col gap-6 rounded-[28px] bg-gradient-to-b from-[#D4F6EC] to-[#B2EDDB] p-6 sm:p-7">
          <CardText title={c.stock.title} text={c.stock.text} />
          <StockScreen t={t} />
        </div>
        {/* Fake-order protection, drawn as a receipt */}
        <div className="flex flex-col gap-6 rounded-[28px] bg-gradient-to-b from-[#FFE6E2] to-[#FFCFC8] p-6 sm:p-7">
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
          <span className="flex items-center gap-2 text-sm font-bold text-[#1B1446]">
            <span className="size-6 rounded-lg bg-[#ffb36b]" /> Atlas Shop
          </span>
          <ShoppingCart size={16} className="text-muted" />
        </div>
        <p className="mt-4 text-sm font-semibold text-[#1B1446]">{l.cards.store.best}</p>
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
    ["TikTok", "bg-[#f1f1f1] text-[#1B1446]", c.converted, true],
    ["Instagram", "bg-[#fde8f1] text-[#be185d]", c.converted, true],
    ["Google", "bg-[#e8f5ec] text-[#15803d]", c.abandoned, false],
    [c.other, "bg-[#f4f3fa] text-muted", c.abandoned, false],
  ];
  return (
    <Panel className="p-0 text-xs">
      <div className="flex justify-between border-b border-[#f0eef8] px-4 py-2.5 font-semibold text-[#1B1446]">
        <span>{c.source}</span>
        <span>{c.status}</span>
      </div>
      <ul className="divide-y divide-[#F0EDFB]">
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
        <p className="text-sm font-bold text-[#1B1446]">{c.chart}</p>
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
        <p className="text-sm font-bold text-[#1B1446]">{c.best}</p>
        {c.products.map((p, i) => (
          <div key={p} className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs ${i === 0 ? "bg-[#efedff]" : ""}`}>
            {i === 0 ? <Crown size={15} className="text-accent" /> : <span className="w-[15px] text-center text-muted tabular-nums">{i + 1}</span>}
            <span className={`font-semibold ${i === 0 ? "text-accent" : "text-[#1B1446]"}`}>{p}</span>
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
        <p className="text-sm font-bold text-[#1B1446]">{c.stock}</p>
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2 text-xs">
          <span className="rounded-lg border border-[#efedf7] px-3 py-2 text-muted" dir="ltr">
            WATCH-01
          </span>
          <span className="rounded-lg border border-[#efedf7] px-3 py-2 font-semibold text-[#1B1446] tabular-nums">48</span>
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
        <span className="font-bold text-[#1B1446]">{t.brand}</span>
      </div>
      <ul className="mt-3 space-y-2.5 text-sm">
        {c.items.map((item) => (
          <li key={item} className="flex items-center justify-between">
            <span className="text-[#1B1446]">{item}</span>
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
  // Each app's own colour on its mark
  const looks: [LucideIcon, string][] = [
    [Sheet, "bg-[#1e9e5a]"],
    [Tag, "bg-[#2f7cf6]"],
    [Radar, "bg-[#5B3FF0]"],
    [Webhook, "bg-[#FF6F61]"],
    [Download, "bg-[#FFB23E]"],
  ];
  return (
    <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {t.landing.apps.map(([name, text], i) => {
        const [Icon, tile] = looks[i];
        return (
          <li key={name} className="rounded-[24px] bg-white p-6 shadow-[0_12px_30px_-20px_rgba(27,20,70,.35)] transition hover:-translate-y-1">
            <span className={`flex size-12 items-center justify-center rounded-2xl ${tile} text-white`} aria-hidden>
              <Icon size={24} />
            </span>
            <h3 className="mt-5 font-[family-name:var(--font-readex)] text-xl font-bold tracking-tight text-[#1B1446]" dir="auto">
              {name}
            </h3>
            <p className="mt-1.5 leading-relaxed text-[#3d3766]">{text}</p>
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
    <div className="relative mt-12 [perspective:1600px]" aria-hidden data-ui>
      <div className="grid gap-4 md:grid-cols-[1fr_1.5fr] md:[transform:rotateX(14deg)_rotateZ(-3deg)]">
        <Panel className="space-y-3 border-[#ebe8f7]">
          <p className="flex items-center gap-2 font-bold text-[#1B1446]">
            <Truck size={18} className="text-accent" /> {d.title}
          </p>
          <div className="rounded-xl border border-[#efedf7] p-3 text-sm">
            <p className="text-xs text-muted">{d.type}</p>
            <p className="mt-1 font-semibold text-[#1B1446]">{d.both}</p>
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
              <span className="text-sm font-bold text-[#1B1446]" dir="ltr">
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
            <span className="block text-xs font-bold text-[#1B1446]">{name}</span>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[#e4e1f5]">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${[70, 52, 64][i]}%` }} />
            </span>
          </span>
          <span className="text-xs font-bold text-[#1B1446] tabular-nums">{n}</span>
        </div>
      ))}
      <p className="text-center text-[11px] text-muted">{m.open}</p>
    </div>,
    <div key="call" className="space-y-2.5">
      <p className="text-xs font-bold text-[#1B1446]">{m.guide}</p>
      {m.guideLines.map((line, i) => (
        <p key={line} className="flex items-start gap-2 rounded-lg bg-[#f7f6ff] p-2 text-[11px] text-[#1B1446]">
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
            <span className="font-bold text-[#1B1446] tabular-nums">{value as string}</span>
          </div>
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[#e4e1f5]">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${w}%` }} />
          </span>
        </div>
      ))}
      <div className="flex items-center justify-between rounded-xl bg-[#f7f6ff] p-2.5 text-[11px]">
        <span className="text-muted">{m.speed}</span>
        <span className="font-bold text-[#1B1446]">{m.speedValue}</span>
      </div>
    </div>,
  ];
  return (
    <ul className="mt-12 grid gap-6 sm:grid-cols-3" aria-hidden data-ui>
      {l.team.map(([label, hint], i) => {
        const [Icon, tone] = icons[i];
        return (
          <li key={label} className="flex flex-col items-center gap-5">
            <div className="flex h-80 w-full items-end justify-center overflow-hidden rounded-[28px] bg-[#f7f6ff] px-6 pt-8">
              <div className="h-full w-full max-w-[220px] rounded-t-[30px] border-x-[6px] border-t-[6px] border-ink bg-white px-3.5 pt-6">
                <span className="mx-auto mb-4 block h-4 w-20 rounded-full bg-[#1B1446]" />
                {screens[i]}
              </div>
            </div>
            <p className="flex items-center gap-2.5 text-xl font-bold text-[#1B1446]">
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
    <section id="pricing" className="scroll-mt-20 px-4 pt-24 sm:pt-32">
      <div className="mx-auto max-w-6xl rounded-[40px] bg-[#F5F2FF] px-4 py-12 sm:px-8 sm:py-16">
        <SectionHead title={l.pricingTitle} text={l.pricingText} center />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5" data-testid="home-pricing">
          {plans.map((plan) => {
            const picked = plan.code === RECOMMENDED;
            const tag = plan.orderPack ? p.payg : picked ? p.recommended : null;
            const price = priceParts(plan, t);
            return (
              <div
                key={plan.code}
                className={`relative flex flex-col items-center rounded-[26px] px-5 pt-9 pb-6 text-center ${picked ? "bg-gradient-to-b from-[#6B50FF] to-[#4B30E0] text-white shadow-[0_24px_50px_-24px_rgba(91,63,240,.8)] lg:-translate-y-3" : "bg-white shadow-[0_12px_30px_-22px_rgba(27,20,70,.4)]"}`}
                data-plan={plan.code}
              >
                {tag && (
                  <span className={`absolute -top-3.5 rounded-full px-3.5 py-1 text-xs font-bold ${picked ? "bg-[#FFB23E] text-[#1B1446]" : "bg-[#12C59A] text-[#1B1446]"}`}>
                    {picked && <Crown size={12} className="me-1 inline" aria-hidden />}
                    {tag}
                  </span>
                )}
                <h3 className={`${display} text-2xl font-bold ${picked ? "text-white" : "text-[#1B1446]"}`}>{plan.name}</h3>
                <p className={`${display} mt-4 text-3xl font-bold tabular-nums ${picked ? "text-white" : "text-[#1B1446]"}`}>{price.amount}</p>
                <p className={`mt-1 min-h-5 text-sm ${picked ? "text-white/85" : "text-[#3d3766]"}`}>{price.note}</p>
                <Link href={register} className={`mt-6 w-full rounded-full py-3 text-sm font-semibold transition active:scale-[.98] ${picked ? "bg-white text-[#4B30E0] hover:bg-[#F5F2FF]" : "bg-[#5B3FF0] text-white hover:bg-[#4B30E0]"}`}>
                  {l.choose}
                </Link>
                <p className={`mt-4 text-sm ${picked ? "text-white/85" : "text-[#3d3766]"}`}>{(p.taglines as Record<string, string>)[plan.code] ?? ""}</p>
              </div>
            );
          })}
          <div className="flex flex-col items-center rounded-[26px] bg-white px-5 pt-9 pb-6 text-center shadow-[0_12px_30px_-22px_rgba(27,20,70,.4)]" data-plan="custom">
            <h3 className={`${display} text-2xl font-bold text-[#1B1446]`}>{custom.name}</h3>
            <p className={`${display} mt-4 text-3xl font-bold text-[#1B1446]`}>{custom.price}</p>
            <p className="mt-1 min-h-5" />
            <a href={contactHref} target={contact ? "_blank" : undefined} rel={contact ? "noreferrer" : undefined} className="mt-6 w-full rounded-full bg-[#1B1446] py-3 text-sm font-semibold text-white transition hover:bg-[#2B1D8F] active:scale-[.98]">
              {custom.contact}
            </a>
            <p className="mt-4 text-sm text-[#3d3766]">{custom.tagline}</p>
          </div>
        </div>
        <Compare t={t} plans={plans} />
      </div>
    </section>
  );
}

function Compare({ t, plans }: { t: Dictionary; plans: HomePlan[] }) {
  const l = t.landing;
  const p = t.plans;
  return (
    <div id="compare" className="mt-16 scroll-mt-24">
      <h3 className={`${display} text-center text-2xl font-bold text-[#1B1446]`}>{l.compareTitle}</h3>
      <div className="mt-6 overflow-x-auto rounded-[22px] bg-white">
        <table className="w-full min-w-[640px] text-sm" data-testid="plan-compare">
          <thead>
            <tr className="bg-[#EDE9FF] text-[#1B1446]">
              <th className="p-4 text-start font-semibold" />
              {plans.map((plan) => (
                <th key={plan.code} className="p-4 font-bold">
                  {plan.name}
                </th>
              ))}
              <th className="p-4 font-bold">{p.custom.name}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0EDFB]">
            {limitKeys.map((k) => (
              <tr key={k}>
                <td className="p-4 text-[#1B1446]">{p.limits[k]}</td>
                {plans.map((plan) => {
                  const line = limitLine(plan, k, t);
                  return (
                    <td key={plan.code} className="p-4 text-center font-semibold text-[#1B1446] tabular-nums">
                      {line.value || line.label}
                    </td>
                  );
                })}
                <td className="p-4 text-center text-muted">{p.custom.price}</td>
              </tr>
            ))}
            <tr>
              <td className="p-4 text-[#1B1446]">{l.customDomain}</td>
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
      <p className="mt-4 text-center text-sm text-[#1B1446]">{p.allFeatures}</p>
    </div>
  );
}
