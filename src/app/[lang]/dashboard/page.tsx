import Link from "next/link";
import { CalendarDays, CircleCheck, Clock, Package, Palette, ScanLine, ShoppingCart, Truck, Wallet } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { formatPrice } from "@/lib/format";
import { Card } from "@/ui";
import { overviewStats } from "@/features/analytics/overview";

export default async function OverviewPage({ params }: PageProps<"/[lang]/dashboard">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { user, shop } = await requireSection(lang, "overview");
  const stats = await overviewStats(shop.id);
  const o = t.overview;
  const tiles = [
    { key: "today", icon: ShoppingCart, label: o.stats.today, value: String(stats.today), tone: "bg-emerald-50 text-emerald-700" },
    { key: "waiting", icon: Clock, label: o.stats.waiting, value: String(stats.waiting), tone: "bg-amber-50 text-amber-700" },
    { key: "month", icon: CalendarDays, label: o.stats.month, value: String(stats.month), tone: "bg-sky-50 text-sky-700" },
    { key: "delivered", icon: Wallet, label: o.stats.delivered, value: formatPrice(stats.delivered, t.common.currency), tone: "bg-violet-50 text-violet-700" },
  ];
  const steps = [
    { key: "products", icon: Package, label: o.steps.products },
    { key: "delivery", icon: Truck, label: o.steps.delivery },
    { key: "storeDesign", icon: Palette, label: o.steps.design },
    { key: "pixels", icon: ScanLine, label: o.steps.pixels },
  ] as const;
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f5132] via-[#13804f] to-[#22c55e] p-6 text-white shadow-lg shadow-emerald-900/10 sm:p-8" data-testid="welcome">
        <div className="pointer-events-none absolute -end-16 -top-16 size-64 rounded-full bg-white/10" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 end-24 size-56 rounded-full bg-white/5" aria-hidden />
        <p className="relative text-sm font-medium text-white/80">{shop.name}</p>
        <h1 className="relative mt-1 text-2xl font-extrabold sm:text-3xl">
          {o.welcome} {user.name}
        </h1>
        <p className="relative mt-2 max-w-xl text-sm text-white/85">{o.subtitle}</p>
        <Link href={sectionHref(lang, "orders")} className="relative mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-[#0f5132] shadow transition hover:-translate-y-0.5">
          <ShoppingCart size={16} /> {o.openOrders}
        </Link>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="overview-stats">
        {tiles.map(({ key, icon: Icon, label, value, tone }) => (
          <Card key={key} className="flex items-center gap-3" data-stat={key}>
            <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
              <Icon size={20} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs text-muted">{label}</span>
              <span className="block text-xl font-extrabold" data-value>
                {value}
              </span>
            </span>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <CircleCheck size={18} className="text-accent" /> {o.getStarted}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {steps.map(({ key, icon: Icon, label }) => (
            <Link key={key} href={sectionHref(lang, key)} className="group flex items-center gap-3 rounded-xl border border-line bg-panel p-4 text-sm font-semibold transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md">
              <span className="flex size-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Icon size={18} aria-hidden />
              </span>
              {label}
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
