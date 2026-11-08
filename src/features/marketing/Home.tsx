import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, BarChart3, Boxes, Check, CheckCircle2, CreditCard, LayoutTemplate, Layers, MapPin, Megaphone, MessageCircle, PackageCheck, PhoneCall, Radar, Sheet, ShieldCheck, ShoppingBag, ShoppingCart, Store, Tag, Target, Truck, UserCheck, Users, X, type LucideIcon } from "lucide-react";
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
        <section className="relative overflow-hidden bg-[#F6F8FC]">
          <span aria-hidden className="pointer-events-none absolute -top-48 -start-40 size-[560px] rounded-full bg-[#2DD4BF]/20 blur-3xl" />
          <span aria-hidden className="pointer-events-none absolute -bottom-56 end-[-10rem] size-[520px] rounded-full bg-[#5CC2FF]/20 blur-3xl" />
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

        {/* The journey of an order: a real sequence, so the steps are numbered */}
        <section className="mx-auto max-w-6xl px-4 pt-24 sm:pt-32">
          <SectionHead title={l.journeyTitle} text={l.journeyText} center />
          <Journey steps={l.journey} />
        </section>

        {/* Features: colourful cards, each with a small screen of that part of the product */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-24 sm:pt-32">
          <SectionHead
            title={`${l.featuresTop} ${l.featuresBottom}`.trim()}
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
          <div className="mx-auto max-w-6xl rounded-[40px] bg-[#F1F7FD] px-5 py-12 sm:px-10 sm:py-16">
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
          <DeliveryArt t={t} />
        </section>

        {/* The confirmation team: three phone screens */}
        <section className="mx-auto max-w-6xl px-4 pt-24 sm:pt-32">
          <SectionHead title={l.teamTitle} text={l.teamText} center />
          <TeamCards t={t} />
        </section>

        {plans.length > 0 && <Pricing lang={lang} t={t} plans={plans} contact={contact} />}

        {/* Call to action: the brand's violet field with parcels on their way */}
        <section className="px-4 pt-24 pb-24 sm:pt-32">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[40px] bg-gradient-to-br from-[#0F9488] via-[#0E7C8C] to-[#1D4ED8] px-6 py-16 text-center text-white sm:py-20">
            <span aria-hidden className="pointer-events-none absolute -top-24 -start-16 size-72 rounded-full bg-[#2DD4BF]/50 blur-2xl" />
            <span aria-hidden className="pointer-events-none absolute -bottom-28 -end-10 size-80 rounded-full bg-[#60A5FA]/40 blur-2xl" />
            <h2 className={`${display} relative text-3xl font-bold text-balance sm:text-5xl`}>{l.ctaTitle}</h2>
            <p className="relative mx-auto mt-4 max-w-lg text-lg text-white/90">{l.ctaText}</p>
            <Link href={register} className="relative mt-9 inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-semibold text-[#1B1446] transition hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-white/40 focus-visible:outline-none">
              {l.cta} <Arrow size={18} aria-hidden />
            </Link>
            <ul className="relative mx-auto mt-10 flex max-w-xl flex-wrap justify-center gap-2.5">
              {l.facts.map((f) => (
                <li key={f} className="flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-medium ring-1 ring-white/25">
                  <Check size={15} aria-hidden /> {f}
                </li>
              ))}
            </ul>
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
  [16, "#0F9488"],
  [31, "#12C59A"],
  [25, "#FFB23E"],
  [19, "#FF6F61"],
  [6, "#4CB3FF"],
  [47, "#5B3FF0"],
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
            <path key={code} d={d} fill={lit.get(code) ?? "#DFE6F1"} fillOpacity={lit.has(code) ? 0.9 : 1} stroke="#fff" strokeWidth={1.4} strokeLinejoin="round" />
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

// A flat icon on a gradient tile (no 3D): the page's one icon style, from the dashboard's own icon set
function IconTile({ icon: Icon, tone, size = "md" }: { icon: LucideIcon; tone: string; size?: "sm" | "md" | "lg" }) {
  const box = size === "lg" ? "size-16 rounded-[20px]" : size === "sm" ? "size-11 rounded-xl" : "size-14 rounded-2xl";
  const glyph = size === "lg" ? 30 : size === "sm" ? 21 : 26;
  return (
    <span className={`relative flex shrink-0 items-center justify-center bg-gradient-to-br text-white ${box} ${tone}`} aria-hidden>
      <span className="absolute inset-x-1.5 top-1 h-1/3 rounded-full bg-white/20 blur-[2px]" />
      <Icon size={glyph} strokeWidth={2.2} className="relative" />
    </span>
  );
}

// Colour pairs for the tiles (gradient + a soft shadow of the same hue)
const tiles = {
  coral: "from-[#FF8A7A] to-[#F2554A] shadow-[0_12px_24px_-12px_rgba(242,85,74,.7)]",
  apricot: "from-[#FFC261] to-[#F59E0B] shadow-[0_12px_24px_-12px_rgba(245,158,11,.7)]",
  violet: "from-[#7B63FF] to-[#5B3FF0] shadow-[0_12px_24px_-12px_rgba(91,63,240,.7)]",
  mint: "from-[#34D9AE] to-[#0EA57F] shadow-[0_12px_24px_-12px_rgba(14,165,127,.7)]",
  sky: "from-[#5CC2FF] to-[#2C8EF0] shadow-[0_12px_24px_-12px_rgba(44,142,240,.7)]",
  teal: "from-[#2DD4BF] to-[#0F9488] shadow-[0_12px_24px_-12px_rgba(15,148,136,.7)]",
  pink: "from-[#FF7EB6] to-[#E5487F] shadow-[0_12px_24px_-12px_rgba(229,72,127,.7)]",
  green: "from-[#4ADE80] to-[#16A34A] shadow-[0_12px_24px_-12px_rgba(22,163,74,.7)]",
  blue: "from-[#60A5FA] to-[#2563EB] shadow-[0_12px_24px_-12px_rgba(37,99,235,.7)]",
  amber: "from-[#FBBF24] to-[#D97706] shadow-[0_12px_24px_-12px_rgba(217,119,6,.7)]",
  slate: "from-[#64748B] to-[#334155] shadow-[0_12px_24px_-12px_rgba(51,65,85,.7)]",
  white: "from-white/25 to-white/10 ring-1 ring-white/30",
} as const;

// The journey of an order, ad to analytics: numbered stops
function Journey({ steps }: { steps: string[][] }) {
  const looks: [LucideIcon, keyof typeof tiles][] = [
    [Megaphone, "coral"],
    [LayoutTemplate, "apricot"],
    [ShoppingBag, "violet"],
    [PhoneCall, "mint"],
    [Truck, "sky"],
    [BarChart3, "teal"],
  ];
  return (
    <ol className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {steps.map(([title, text], i) => {
        const [icon, tone] = looks[i % looks.length];
        return (
          <li key={title} className="group relative rounded-[28px] bg-white p-7 ring-1 ring-[#1B1446]/[.07] transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_60px_-34px_rgba(27,20,70,.35)]">
            <div className="flex items-center justify-between">
              <IconTile icon={icon} tone={tiles[tone]} />
              <span className={`${display} text-4xl font-bold text-[#1B1446]/10`}>{String(i + 1).padStart(2, "0")}</span>
            </div>
            <h3 className={`${display} mt-6 text-xl font-bold text-[#1B1446]`}>{title}</h3>
            <p className="mt-2 leading-relaxed text-[#3d3766]">{text}</p>
          </li>
        );
      })}
    </ol>
  );
}

// One feature card: its own colour field, an icon tile, the title and text
function FeatureCard({ icon, tile, title, text, tone, wide = false, children }: { icon: LucideIcon; tile: string; title: string; text: string; tone: string; wide?: boolean; children?: ReactNode }) {
  const light = tone.includes("text-white");
  return (
    <div className={`group relative flex flex-col overflow-hidden rounded-[30px] p-7 sm:p-8 ${tone} ${wide ? "lg:col-span-2" : ""}`}>
      <span aria-hidden className={`absolute -end-24 -top-24 size-72 rounded-full ${light ? "bg-white/10" : "bg-white/60"}`} />
      <div className="relative transition duration-300 group-hover:-translate-y-0.5">
        <IconTile icon={icon} tone={tile} size="lg" />
      </div>
      <h3 className={`${display} relative mt-6 text-2xl font-bold`}>{title}</h3>
      <p className={`relative mt-3 max-w-lg leading-relaxed ${light ? "text-white/90" : "text-[#3d3766]"}`}>{text}</p>
      {children}
    </div>
  );
}

// Features: colour fields of different sizes, one clear icon each
function Bento({ t }: { t: Dictionary }) {
  const c = t.landing.cards;
  return (
    <div className="mt-12 grid gap-5 lg:grid-cols-3">
      <FeatureCard icon={Store} tile={tiles.white} title={c.store.title} text={c.store.text} tone="bg-gradient-to-br from-[#0F9488] to-[#0B6B63] text-white" wide />
      <FeatureCard icon={LayoutTemplate} tile={tiles.white} title={c.ai.title} text={c.ai.text} tone="bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white">
        <ul className="relative mt-5 flex flex-wrap gap-2">
          {c.ai.chips.map((chip) => (
            <li key={chip} className="rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white ring-1 ring-white/25">
              {chip}
            </li>
          ))}
        </ul>
      </FeatureCard>
      <FeatureCard icon={CreditCard} tile={tiles.amber} title={c.payments.title} text={c.payments.text} tone="bg-[#FFF3DD] text-[#1B1446]" />
      <FeatureCard icon={ShoppingCart} tile={tiles.sky} title={c.carts.title} text={c.carts.text} tone="bg-[#E4F2FF] text-[#1B1446]" />
      <FeatureCard icon={BarChart3} tile={tiles.violet} title={c.analytics.title} text={c.analytics.text} tone="bg-[#EFECFF] text-[#1B1446]" />
      <FeatureCard icon={Boxes} tile={tiles.mint} title={c.stock.title} text={c.stock.text} tone="bg-[#DDF7EE] text-[#1B1446]" />
      <FeatureCard icon={ShieldCheck} tile={tiles.coral} title={c.guard.title} text={c.guard.text} tone="bg-[#FFE9E5] text-[#1B1446]" wide>
        <ul className="relative mt-5 grid gap-2 sm:grid-cols-2">
          {c.guard.items.map((item) => (
            <li key={item} className="flex items-center gap-2 font-medium text-[#1B1446]">
              <CheckCircle2 size={18} className="shrink-0 text-[#0b8f6f]" aria-hidden /> {item}
            </li>
          ))}
        </ul>
      </FeatureCard>
    </div>
  );
}

// Apps: the platform's real, ready apps (names and texts from the dashboard's Apps page) plus Sheets and pixels
function Apps({ t }: { t: Dictionary }) {
  const a = t.apps.cards;
  const [sheets, , pixels] = t.landing.apps;
  const list: [LucideIcon, keyof typeof tiles, string, string][] = [
    [MessageCircle, "green", a.whatsapp.name, a.whatsapp.card],
    [CreditCard, "blue", a.payments.name, a.payments.card],
    [ShieldCheck, "coral", a.fakeGuard.name, a.fakeGuard.card],
    [ShoppingCart, "apricot", a.abandoned.name, a.abandoned.card],
    [UserCheck, "violet", a.agentAssign.name, a.agentAssign.card],
    [Truck, "sky", a.deliveryAssign.name, a.deliveryAssign.card],
    [MapPin, "pink", a.orderTracking.name, a.orderTracking.card],
    [Tag, "amber", a.promotions.name, a.promotions.card],
    [ShoppingBag, "teal", a.cart.name, a.cart.card],
    [Layers, "slate", a.wholesale.name, a.wholesale.card],
    [Sheet, "green", sheets[0], sheets[1]],
    [Radar, "violet", pixels[0], pixels[1]],
  ];
  return (
    <>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="home-apps">
        {list.map(([icon, tone, name, text]) => (
          <li key={name} className="group rounded-[24px] bg-white p-5 ring-1 ring-[#1B1446]/[.06] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-30px_rgba(27,20,70,.4)]">
            <IconTile icon={icon} tone={tiles[tone]} size="sm" />
            <h3 className={`${display} mt-4 text-[1.05rem] font-bold text-[#1B1446]`} dir="auto">
              {name}
            </h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-[#3d3766]">{text}</p>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-center font-semibold text-[#2C6FB8]">{t.landing.appsMore}</p>
    </>
  );
}

// Delivery: a route from the store to the customer, the courier companies under it
function DeliveryArt({ t }: { t: Dictionary }) {
  const d = t.landing.deliveryCard;
  const carriers = ["Yalidine", "ZR Express", "Ecotrack", "NOEST", "Procolis", "DHD"];
  return (
    <div className="relative overflow-hidden rounded-[36px] bg-gradient-to-br from-[#E4F2FF] to-[#DDF7EE] p-7 sm:p-10" aria-hidden>
      <div className="relative flex items-center justify-between gap-3">
        <IconTile icon={Store} tone={tiles.teal} size="lg" />
        <svg viewBox="0 0 200 40" className="h-10 flex-1" preserveAspectRatio="none">
          <path d="M4 20 C 50 0, 150 40, 196 20" fill="none" stroke="#0F9488" strokeWidth="3" strokeDasharray="7 8" strokeLinecap="round" className="sc-route" />
        </svg>
        <IconTile icon={Truck} tone={tiles.sky} size="lg" />
        <svg viewBox="0 0 200 40" className="h-10 flex-1" preserveAspectRatio="none">
          <path d="M4 20 C 50 40, 150 0, 196 20" fill="none" stroke="#2C8EF0" strokeWidth="3" strokeDasharray="7 8" strokeLinecap="round" className="sc-route" />
        </svg>
        <IconTile icon={MapPin} tone={tiles.coral} size="lg" />
      </div>
      <div className="relative mt-8 flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-[0_18px_40px_-26px_rgba(27,20,70,.5)]">
        <span className="flex items-center gap-2.5 font-semibold text-[#1B1446]">
          <PackageCheck size={20} className="text-[#0F9488]" /> {d.title}
        </span>
        <span className="rounded-full bg-[#12C59A] px-3 py-1 text-sm font-bold text-[#1B1446]">18 · {d.ready}</span>
      </div>
      <ul className="relative mt-5 flex flex-wrap gap-2">
        {carriers.map((name) => (
          <li key={name} className="rounded-full bg-white/80 px-3.5 py-1.5 text-sm font-semibold text-[#1B1446] ring-1 ring-[#1B1446]/[.06]">
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}

// The confirmation team: share, confirm, follow
function TeamCards({ t }: { t: Dictionary }) {
  const l = t.landing;
  const looks: [LucideIcon, keyof typeof tiles, string][] = [
    [Users, "apricot", "bg-[#FFF3DD]"],
    [PhoneCall, "mint", "bg-[#DDF7EE]"],
    [Target, "sky", "bg-[#E4F2FF]"],
  ];
  const agents = l.teamMock.agents;
  const tints = ["bg-[#F59E0B]", "bg-[#0EA57F]", "bg-[#2C8EF0]"];
  return (
    <div className="mt-12 grid gap-5 md:grid-cols-3">
      {l.team.map(([title, text], i) => {
        const [icon, tone, field] = looks[i % looks.length];
        return (
          <div key={title} className={`rounded-[30px] p-7 ${field}`}>
            <IconTile icon={icon} tone={tiles[tone]} size="lg" />
            <h3 className={`${display} mt-6 text-2xl font-bold text-[#1B1446]`}>{title}</h3>
            <p className="mt-2 leading-relaxed text-[#3d3766]">{text}</p>
            {i === 0 && (
              <div className="mt-5 flex -space-x-2 rtl:space-x-reverse" aria-hidden>
                {agents.map(([name], n) => (
                  <span key={name} className={`flex size-9 items-center justify-center rounded-full text-sm font-bold text-white ring-2 ring-white ${tints[n % 3]}`}>
                    {name.charAt(0)}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function WatchIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-12 text-[#c2410c]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <rect x="12" y="12" width="24" height="24" rx="7" />
      <path d="M18 12l2-6h8l2 6M18 36l2 6h8l2-6M24 19v6l4 2" />
    </svg>
  );
}

function Pricing({ lang, t, plans, contact }: { lang: Locale; t: Dictionary; plans: HomePlan[]; contact?: string }) {
  const l = t.landing;
  const p = t.plans;
  const register = `/${lang}/register`;
  const custom = p.custom;
  const contactHref = contact ? `https://wa.me/${contact}?text=${encodeURIComponent(custom.whatsapp)}` : register;
  return (
    <section id="pricing" className="scroll-mt-20 px-4 pt-24 sm:pt-32">
      <div className="mx-auto max-w-6xl rounded-[40px] bg-[#F6F7FB] px-4 py-12 sm:px-8 sm:py-16">
        <SectionHead title={l.pricingTitle} text={l.pricingText} center />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5" data-testid="home-pricing">
          {plans.map((plan) => {
            const picked = plan.code === RECOMMENDED;
            const tag = plan.orderPack ? p.payg : picked ? p.recommended : null;
            const price = priceParts(plan, t);
            return (
              <div
                key={plan.code}
                className={`relative flex flex-col items-center rounded-[26px] px-5 pt-8 pb-6 text-center ${picked ? "bg-white shadow-[0_28px_60px_-28px_rgba(91,63,240,.75)] ring-2 ring-[#5B3FF0] lg:-translate-y-3" : "bg-white ring-1 ring-[#1B1446]/[.06]"}`}
                data-plan={plan.code}
              >
                {tag && <span className={`absolute -top-3 rounded-full px-3 py-0.5 text-xs font-semibold ${picked ? "bg-[#5B3FF0] text-white" : "bg-[#EEEAFF] text-[#5B3FF0]"}`}>{tag}</span>}
                <h3 className={`${display} text-2xl font-bold text-[#2E1F8F]`}>{plan.name}</h3>
                <a href="#compare" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[#5B3FF0] hover:underline">
                  {l.compare}
                </a>
                <p className={`${display} mt-5 text-3xl font-bold text-[#1B1446] tabular-nums`}>{price.amount}</p>
                <p className="mt-1 min-h-5 text-sm text-[#3d3766]">{price.note}</p>
                <Link href={register} className={`mt-6 w-full rounded-full py-3 text-sm font-semibold transition active:scale-[.98] ${picked ? "bg-[#5B3FF0] text-white hover:bg-[#4B30E0]" : "bg-[#F5F2FF] text-[#1B1446] hover:bg-[#EEEAFF]"}`}>
                  {l.choose}
                </Link>
                <p className="mt-4 text-sm text-[#3d3766]">{(p.taglines as Record<string, string>)[plan.code] ?? ""}</p>
              </div>
            );
          })}
          <div className="flex flex-col items-center rounded-[26px] bg-white px-5 pt-8 pb-6 text-center ring-1 ring-[#1B1446]/[.06]" data-plan="custom">
            <h3 className={`${display} text-2xl font-bold text-[#2E1F8F]`}>{custom.name}</h3>
            <a href="#compare" className="mt-2 text-sm font-medium text-[#5B3FF0] hover:underline">
              {l.compare}
            </a>
            <p className={`${display} mt-5 text-3xl font-bold text-[#1B1446]`}>{custom.price}</p>
            <p className="mt-1 min-h-5 text-sm text-[#3d3766]" />
            <a href={contactHref} target={contact ? "_blank" : undefined} rel={contact ? "noreferrer" : undefined} className="mt-6 w-full rounded-full bg-[#F5F2FF] py-3 text-sm font-semibold text-[#1B1446] transition hover:bg-[#EEEAFF] active:scale-[.98]">
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
