import Link from "next/link";
import { CalendarDays, ChevronLeft, CircleCheck, Clock, Package, Palette, ScanLine, ShoppingCart, Truck, Wallet } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { formatPrice } from "@/lib/format";
import { Card, buttonClass } from "@/ui";
import { overviewStats } from "@/features/analytics/overview";

export default async function OverviewPage({ params }: PageProps<"/[lang]/dashboard">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { user, shop } = await requireSection(lang, "overview");
  const stats = await overviewStats(shop.id);
  const o = t.overview;
  const tiles = [
    { key: "today", icon: ShoppingCart, label: o.stats.today, value: String(stats.today), tone: "text-accent" },
    // Orders waiting for a call: the one number in the attention color when there is work to do
    { key: "waiting", icon: Clock, label: o.stats.waiting, value: String(stats.waiting), tone: stats.waiting ? "text-warning" : "text-muted" },
    { key: "month", icon: CalendarDays, label: o.stats.month, value: String(stats.month), tone: "text-info" },
    { key: "delivered", icon: Wallet, label: o.stats.delivered, value: formatPrice(stats.delivered, t.common.currency), tone: "text-accent" },
  ];
  const steps = [
    { key: "products", icon: Package, label: o.steps.products },
    { key: "delivery", icon: Truck, label: o.steps.delivery },
    { key: "storeDesign", icon: Palette, label: o.steps.design },
    { key: "pixels", icon: ScanLine, label: o.steps.pixels },
  ] as const;
  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5" data-testid="welcome">
        <div>
          <p className="text-sm font-medium text-muted">{shop.name}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-[1.7rem]">
            {o.welcome} {user.name}
          </h1>
          <p className="mt-1.5 text-sm text-muted">{o.subtitle}</p>
        </div>
        <Link href={sectionHref(lang, "orders")} className={buttonClass("primary")}>
          <ShoppingCart size={16} /> {o.openOrders}
        </Link>
      </section>

      {/* The day at a glance: one strip, four numbers */}
      <Card className="grid grid-cols-2 p-0 lg:grid-cols-4" data-testid="overview-stats">
        {tiles.map(({ key, icon: Icon, label, value, tone }, i) => (
          <div key={key} className={`space-y-2 border-line p-5 ${i < 2 ? "border-b lg:border-b-0" : ""} ${i % 2 === 0 ? "border-e" : ""} ${i === 1 ? "lg:border-e" : ""}`} data-stat={key}>
            <span className="flex items-center gap-2 text-sm text-muted">
              <Icon size={16} className={tone} aria-hidden /> {label}
            </span>
            <span className={`block text-2xl font-bold tabular-nums sm:text-[1.75rem] ${key === "waiting" && stats.waiting ? "text-warning" : "text-fg"}`} data-value>
              {value}
            </span>
          </div>
        ))}
      </Card>

      <Card>
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <CircleCheck size={18} className="text-accent" /> {o.getStarted}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {steps.map(({ key, icon: Icon, label }) => (
            <Link key={key} href={sectionHref(lang, key)} className="group flex items-center gap-3 rounded-[12px] border border-line bg-panel p-4 text-sm font-semibold transition-colors duration-150 hover:border-accent/50 hover:bg-accent/[0.03]">
              <span className="flex size-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Icon size={18} aria-hidden />
              </span>
              <span className="flex-1">{label}</span>
              <ChevronLeft size={16} className="text-muted transition-colors group-hover:text-accent ltr:rotate-180" aria-hidden />
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
