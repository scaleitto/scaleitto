import Link from "next/link";
import {
  BarChart3,
  Bell,
  CheckCircle2,
  Globe,
  LayoutTemplate,
  MousePointerClick,
  PackageCheck,
  Palette,
  PhoneCall,
  Radar,
  Sheet,
  ShoppingBag,
  Sparkles,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Dictionary, Locale } from "@/i18n";
import { buttonClass } from "@/ui";
import { LanguageSwitcher } from "@/ui/LanguageSwitcher";

// The platform's public homepage. Deep green "ink" (the dashboard sidebar's color) on a pale sage page;
// the one moment of motion is the order notifications arriving on the phone in the hero.
const INK = "bg-[#0d2e22]";

function Mark() {
  return <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-accent text-lg font-extrabold text-white shadow-sm">S</span>;
}

export function MarketingHome({ lang, t }: { lang: Locale; t: Dictionary }) {
  const l = t.landing;
  const register = `/${lang}/register`;
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f3f6f2] text-fg">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-[#f3f6f2]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href={`/${lang}`} className="flex items-center gap-2.5">
            <Mark />
            <span className="text-xl font-extrabold tracking-tight">{t.brand}</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-muted md:flex">
            <a href="#journey" className="hover:text-fg">
              {l.nav.journey}
            </a>
            <a href="#features" className="hover:text-fg">
              {l.nav.features}
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher current={lang} />
            <Link href={`/${lang}/login`} className={buttonClass("ghost", "hidden whitespace-nowrap sm:inline-flex")}>
              {l.login}
            </Link>
            <Link href={register} className={buttonClass("primary", "px-3 whitespace-nowrap sm:px-4")}>
              <span className="sm:hidden">{l.start}</span>
              <span className="hidden sm:inline">{l.cta}</span>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero: the promise, and a phone receiving orders */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-16 md:grid-cols-[1.1fr_1fr] md:pt-20 md:pb-24">
          <div>
            <h1 className="text-[2.35rem] leading-[1.15] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-[3.6rem]">{l.title}</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">{l.subtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={register} className={buttonClass("primary", "px-7 py-3.5 text-base shadow-lg shadow-accent/25")}>
                {l.cta}
              </Link>
              <a href="#journey" className={buttonClass("secondary", "px-6 py-3.5 text-base")}>
                {l.how}
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-muted">
              {l.facts.map((f) => (
                <li key={f} className="flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-accent" /> {f}
                </li>
              ))}
            </ul>
          </div>
          <PhoneMock t={t} />
        </section>

        {/* The order's journey: a real sequence, so the steps are numbered */}
        <section id="journey" className={`${INK} scroll-mt-16 text-white`}>
          <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
            <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">{l.journeyTitle}</h2>
            <ol className="mt-10 grid gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
              {l.journey.map(([title, hint], i) => {
                const Icon = journeyIcons[i];
                return (
                  <li key={title} className="flex gap-4 bg-[#0d2e22] p-6">
                    <span className="text-3xl leading-none font-extrabold text-emerald-400/90 tabular-nums">{i + 1}</span>
                    <div className="space-y-1.5">
                      <p className="flex items-center gap-2 text-lg font-bold">
                        <Icon size={18} className="text-emerald-300" /> {title}
                      </p>
                      <p className="text-sm leading-relaxed text-white/65">{hint}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* Three main features, alternating sides, each with a small picture of the real screen */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-16 space-y-20 px-4 py-20 md:space-y-28 md:py-28">
          {l.rows.map(([title, text], i) => (
            <div key={title} className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
              <div className={i % 2 ? "md:order-2" : ""}>
                <h2 className="text-3xl leading-tight font-extrabold tracking-tight text-balance sm:text-4xl">{title}</h2>
                <p className="mt-4 text-lg leading-relaxed text-muted">{text}</p>
              </div>
              <div className={i % 2 ? "md:order-1" : ""}>{[<PagesPicture key="p" t={t} />, <OrdersPicture key="o" t={t} />, <DeliveryPicture key="d" />][i]}</div>
            </div>
          ))}
        </section>

        <section className="border-y border-line bg-panel">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{l.moreTitle}</h2>
            <ul className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {l.more.map(([title, hint], i) => {
                const Icon = moreIcons[i];
                return (
                  <li key={title} className="flex gap-4">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                      <Icon size={20} />
                    </span>
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

        <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <div className={`${INK} relative overflow-hidden rounded-3xl px-6 py-12 text-center text-white sm:px-12 sm:py-16`}>
            <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl" />
            <h2 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">{l.ctaTitle}</h2>
            <p className="relative mx-auto mt-3 max-w-lg text-white/70">{l.ctaText}</p>
            <Link href={register} className="relative mt-8 inline-flex items-center justify-center rounded-lg bg-white px-8 py-3.5 text-base font-bold text-[#0d2e22] shadow-lg transition hover:bg-emerald-50">
              {l.cta}
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted">
          <span className="flex items-center gap-2 font-bold text-fg">
            <Mark /> {t.brand}
          </span>
          <span>
            © {t.brand} · {l.rights}
          </span>
        </div>
      </footer>
    </div>
  );
}

const journeyIcons: LucideIcon[] = [MousePointerClick, LayoutTemplate, ShoppingBag, PhoneCall, Truck, BarChart3];
const moreIcons: LucideIcon[] = [Palette, Radar, Sheet, BarChart3, Globe, Users];

// A phone showing a product page, with orders arriving on top of it
function PhoneMock({ t }: { t: Dictionary }) {
  const m = t.landing.mock;
  const notes = [
    { label: m.new, n: 1043, tone: "bg-amber-400 text-amber-950", icon: Bell },
    { label: m.confirmed, n: 1042, tone: "bg-accent text-white", icon: PhoneCall },
    { label: m.delivered, n: 1038, tone: "bg-[#0d2e22] text-white", icon: PackageCheck },
  ];
  return (
    <div className="relative mx-auto w-full max-w-[22rem]" aria-hidden>
      <div className="absolute -inset-6 -z-0 rounded-[3rem] bg-gradient-to-br from-emerald-300/40 via-transparent to-amber-200/40 blur-2xl" />
      <div className="relative rounded-[2.6rem] border-[10px] border-[#0d2e22] bg-white shadow-2xl shadow-[#0d2e22]/25">
        <div className="mx-auto mt-2 h-1.5 w-16 rounded-full bg-black/10" />
        <div className="space-y-3 p-4">
          <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-gradient-to-br from-[#0d2e22] to-emerald-700">
            <div className="flex size-24 items-center justify-center rounded-[1.6rem] border-4 border-white/80 bg-black/30">
              <span className="text-xl font-extrabold text-emerald-300 tabular-nums">10:08</span>
            </div>
          </div>
          <p className="font-extrabold">{m.product}</p>
          <ul className="space-y-1 text-xs text-muted">
            {t.landing.sample.map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-accent" /> {s}
              </li>
            ))}
          </ul>
          <div className="space-y-2">
            <div className="h-9 rounded-lg border border-field-line bg-field" />
            <div className="h-9 rounded-lg border border-field-line bg-field" />
          </div>
          <div className="flex h-11 items-center justify-center rounded-xl bg-accent text-sm font-extrabold text-white">{m.order}</div>
        </div>
      </div>
      <ul className="absolute -end-2 top-1/2 w-52 space-y-2 sm:-end-14 sm:w-56">
        {notes.map(({ label, n, tone, icon: Icon }, i) => (
          <li key={n} className="notify-in flex items-center gap-3 rounded-2xl bg-white/95 p-2.5 shadow-xl shadow-black/10 ring-1 ring-black/5 backdrop-blur" style={{ animationDelay: `${0.4 + i * 0.45}s` }}>
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>
              <Icon size={16} />
            </span>
            <span className="text-sm leading-tight">
              <span className="block font-bold">{label}</span>
              <span className="text-xs text-muted tabular-nums" dir="ltr">
                #{n}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-line bg-panel p-4 shadow-[0_1px_2px_rgba(16,24,40,.05),0_24px_48px_-24px_rgba(13,46,34,.25)] sm:p-5">{children}</div>;
}

// Image landing page: a column of designed images being made
function PagesPicture({ t }: { t: Dictionary }) {
  return (
    <Frame>
      <div className="mb-3 flex items-center gap-2 text-sm font-bold">
        <Sparkles size={16} className="text-accent" /> AI
      </div>
      <div className="grid grid-cols-3 gap-3" aria-hidden>
        {["from-emerald-700 to-[#0d2e22]", "from-amber-300 to-amber-500", "from-sky-600 to-indigo-700"].map((g, i) => (
          <div key={g} className={`flex aspect-[2/3] flex-col justify-between rounded-xl bg-gradient-to-b ${g} p-2.5`}>
            <div className="space-y-1">
              <div className="h-2 w-4/5 rounded-full bg-white/90" />
              <div className="h-2 w-1/2 rounded-full bg-white/60" />
            </div>
            {i === 2 ? <div className="h-5 rounded-md bg-white/90" /> : <div className="mx-auto size-10 rounded-full bg-white/25" />}
          </div>
        ))}
      </div>
      <div className="mt-3 flex h-10 items-center justify-center rounded-xl bg-accent text-sm font-bold text-white">{t.landing.mock.order}</div>
    </Frame>
  );
}

// The orders list with statuses and the agent each order went to
function OrdersPicture({ t }: { t: Dictionary }) {
  const m = t.landing.mock;
  const rows = [
    { n: 1043, s: m.new, c: "bg-amber-400/15 text-warning", w: "w-24" },
    { n: 1042, s: m.confirmed, c: "bg-accent/15 text-accent", w: "w-20" },
    { n: 1041, s: m.confirmed, c: "bg-accent/15 text-accent", w: "w-28" },
    { n: 1038, s: m.delivered, c: "bg-sky-400/15 text-info", w: "w-16" },
  ];
  return (
    <Frame>
      <ul className="divide-y divide-line" aria-hidden>
        {rows.map((r, i) => (
          <li key={r.n} className="flex items-center gap-3 py-3">
            <span className="w-12 text-sm font-bold text-muted tabular-nums" dir="ltr">
              #{r.n}
            </span>
            <span className={`h-2.5 ${r.w} rounded-full bg-line`} />
            <span className={`ms-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.c}`}>{r.s}</span>
            <span className={`flex size-7 items-center justify-center rounded-full text-[11px] font-bold text-white ${["bg-emerald-600", "bg-sky-600", "bg-amber-500", "bg-violet-600"][i]}`}>
              {"ASMK"[i]}
            </span>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

// A parcel's tracking line
function DeliveryPicture() {
  return (
    <Frame>
      <div className="flex items-center gap-3" aria-hidden>
        {[ShoppingBag, PhoneCall, Truck, PackageCheck].map((Icon, i) => (
          <div key={i} className="flex flex-1 items-center gap-3 last:flex-none">
            <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${i < 3 ? "bg-accent text-white" : "border-2 border-dashed border-accent text-accent"}`}>
              <Icon size={18} />
            </span>
            {i < 3 && <span className={`h-1 flex-1 rounded-full ${i < 2 ? "bg-accent" : "bg-gradient-to-l from-line to-accent rtl:bg-gradient-to-r"}`} />}
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2" aria-hidden>
        {["bg-emerald-600", "bg-sky-600", "bg-amber-500", "bg-violet-600", "bg-rose-600", "bg-teal-600"].map((c, i) => (
          <div key={c} className="flex items-center gap-2 rounded-lg border border-line p-2">
            <span className={`size-6 rounded-md ${c}`} />
            <span className={`h-2 rounded-full bg-line ${["w-10", "w-8", "w-12"][i % 3]}`} />
          </div>
        ))}
      </div>
    </Frame>
  );
}
