import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, Calendar, ChevronRight, ClipboardList, Crosshair, FileText, Package, PackageCheck, ShieldAlert, ShoppingBag, Truck, Wallet, type LucideIcon } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { fmt, formatPrice } from "@/lib/format";
import { algeriaParts } from "@/lib/time";
import { wilayas } from "@/lib/wilayas";
import { Card, buttonClass } from "@/ui";
import { chartRanges, overviewData, overviewPeriods, type ChartRange, type OverviewPeriod } from "@/features/analytics/overview";
import { HideAmounts } from "@/features/analytics/OverviewControls";
import { statusPill } from "@/features/orders/statuses";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "—";

// The dashboard home (Zimam's): greeting with what is waiting, the period's four numbers, what needs the merchant,
// the sales chart, best sellers, the latest orders and the four set-up steps
export default async function OverviewPage({ params, searchParams }: PageProps<"/[lang]/dashboard">) {
  const lang = asLocale((await params).lang);
  const sp = await searchParams;
  const t = getDictionary(lang);
  const { user, shop } = await requireSection(lang, "overview");
  await connection();
  const now = new Date();
  const period: OverviewPeriod = overviewPeriods.includes(sp.period as OverviewPeriod) ? (sp.period as OverviewPeriod) : "today";
  const chart: ChartRange = chartRanges.includes(Number(sp.chart) as ChartRange) ? (Number(sp.chart) as ChartRange) : 7;
  const data = await overviewData(shop.id, period, chart, now);
  const o = t.overview;
  const cur = t.common.currency;
  const hour = Math.floor(algeriaParts(now).minutes / 60);
  const greeting = hour < 12 ? o.morning : hour < 18 ? o.afternoon : o.evening;
  const orders = sectionHref(lang, "orders");
  const href = (next: Partial<{ period: string; chart: number }>) => `?${new URLSearchParams({ period: next.period ?? period, chart: String(next.chart ?? chart) })}`;
  const dateFmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-DZ" : lang === "fr" ? "fr-DZ" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const timeFmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-DZ" : lang === "fr" ? "fr-DZ" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Algiers" });
  const summary = [data.todayOrders ? fmt(o.today, { n: data.todayOrders }) : o.noOrdersToday, data.tasks.length ? fmt(o.waiting, { n: data.tasks.length, minutes: data.minutes }) : o.nothingWaiting].join(" — ");

  const kpis: { key: keyof typeof data.kpis; icon: LucideIcon; tone: string; value: string; sub: string }[] = [
    { key: "orders", icon: ShoppingBag, tone: "bg-accent-soft text-accent-ink", value: String(data.kpis.orders.value), sub: fmt(o.sub.pending, { n: data.kpis.orders.sub }) },
    { key: "sales", icon: Wallet, tone: "bg-violet-soft text-violet", value: formatPrice(data.kpis.sales.value, cur), sub: fmt(o.sub.perOrder, { amount: formatPrice(data.kpis.sales.sub, cur) }) },
    { key: "confirmed", icon: ClipboardList, tone: "bg-warning-soft text-warning", value: String(data.kpis.confirmed.value), sub: fmt(o.sub.cancelled, { n: data.kpis.confirmed.sub }) },
    { key: "delivered", icon: Truck, tone: "bg-info-soft text-info", value: String(data.kpis.delivered.value), sub: data.kpis.delivered.sub ? fmt(o.sub.returned, { n: data.kpis.delivered.sub }) : o.sub.noReturns },
  ];
  const taskIcons = { pending: ShoppingBag, toShip: PackageCheck, flagged: ShieldAlert } as const;
  const taskHref = { pending: `${orders}?status=pending`, toShip: `${orders}?status=confirmed`, flagged: `${orders}?status=flagged` } as const;

  // The chart: a line with its area, left to right in every language
  const W = 600;
  const H = 200;
  const max = Math.max(1, ...data.chart.days.map((d) => d.sales));
  const x = (i: number) => (data.chart.days.length === 1 ? W / 2 : (i / (data.chart.days.length - 1)) * W);
  const y = (v: number) => H - (v / max) * (H - 10);
  const line = data.chart.days.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.sales).toFixed(1)}`).join(" ");
  const labelEvery = Math.ceil(data.chart.days.length / 8);

  const steps = [
    { key: "pixels", done: data.steps.pixels, icon: Crosshair, href: sectionHref(lang, "pixels") },
    { key: "products", done: data.steps.products, icon: Package, href: `${sectionHref(lang, "products")}/new` },
    { key: "delivery", done: data.steps.delivery, icon: Truck, href: sectionHref(lang, "delivery") },
    { key: "landing", done: data.steps.landing, icon: FileText, href: `${sectionHref(lang, "landingPages")}` },
  ] as const;
  const doneSteps = steps.filter((s) => s.done).length;

  return (
    <div className="space-y-5">
      <section className="relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-2xl border border-line bg-gradient-to-r from-accent-soft via-panel to-panel p-6" data-testid="welcome">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{fmt(greeting, { name: user.name })}</h1>
          <p className="mt-1.5 text-sm text-muted" data-testid="summary">
            {summary}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HideAmounts show={o.showAmounts} hide={o.hideAmounts} />
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-line bg-panel px-3.5 py-2 text-sm font-semibold shadow-sm [&::-webkit-details-marker]:hidden" data-testid="period">
              <Calendar size={15} className="text-muted" /> {o.periods[period]}
            </summary>
            <div className="absolute end-0 top-11 z-20 w-40 rounded-xl border border-line bg-panel p-1 shadow-lift">
              {overviewPeriods.map((p) => (
                <Link key={p} href={href({ period: p })} className={`block rounded-lg px-3 py-2 text-sm hover:bg-panel-2 ${p === period ? "font-semibold text-accent-ink" : ""}`} data-period={p}>
                  {o.periods[p]}
                </Link>
              ))}
            </div>
          </details>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="overview-stats">
        {kpis.map(({ key, icon: Icon, tone, value, sub }) => {
          const change = data.kpis[key].change;
          return (
            <Card key={key} className="space-y-3" data-stat={key}>
              <p className="flex items-center gap-2.5 text-sm font-medium text-fg-2">
                <span className={`grid size-9 place-items-center rounded-xl ${tone}`}>
                  <Icon size={17} aria-hidden />
                </span>
                {o.kpis[key]}
              </p>
              <p className="text-3xl font-bold tabular-nums" data-value data-amount>
                {value}
              </p>
              <p className="flex items-center justify-between gap-2 text-xs text-muted">
                <span data-amount>{sub}</span>
                <span className={change === null ? "" : change >= 0 ? "font-semibold text-accent" : "font-semibold text-danger"} title={o.vsPrev}>
                  {change === null ? "—" : `${change >= 0 ? "+" : ""}${change}%`}
                </span>
              </p>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="space-y-3" data-testid="attention">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">{o.attention}</h2>
              <p className="text-xs text-muted">{o.attentionHint}</p>
            </div>
            {data.minutes > 0 && <span className="text-xs whitespace-nowrap text-muted">≈ {fmt(o.minutes, { n: data.minutes })}</span>}
          </div>
          {data.tasks.length === 0 ? (
            <p className="rounded-xl bg-panel-2 p-4 text-sm text-muted">{o.allClear}</p>
          ) : (
            <ul className="space-y-2">
              {data.tasks.map((task) => {
                const Icon = taskIcons[task.key];
                return (
                  <li key={task.key} className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft p-3" data-todo={task.key}>
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-panel text-warning">
                      <Icon size={17} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{fmt(o.tasks[task.key][0], { n: task.n })}</span>
                      <span className="block text-xs text-fg-2">{o.tasks[task.key][1]}</span>
                    </span>
                    <Link href={taskHref[task.key]} className={buttonClass("secondary", "py-1.5 text-xs")}>
                      {o.tasks[task.key][2]} <ChevronRight size={14} className="rtl:rotate-180" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="space-y-3" data-testid="sales-chart">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">{o.salesTitle}</h2>
            <div className="flex rounded-lg border border-line p-0.5 text-xs font-semibold">
              {chartRanges.map((n) => (
                <Link key={n} href={href({ chart: n })} className={`rounded-md px-2.5 py-1 ${n === chart ? "bg-panel-2 text-fg" : "text-muted"}`} data-chart={n}>
                  {fmt(o.lastDays, { n })}
                </Link>
              ))}
            </div>
          </div>
          <p className="flex flex-wrap items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums" data-amount data-testid="chart-total">
              {formatPrice(data.chart.total, cur)}
            </span>
            <span className={`text-sm font-semibold ${data.chart.change === null ? "text-muted" : data.chart.change >= 0 ? "text-accent" : "text-danger"}`}>{data.chart.change === null ? "—" : `${data.chart.change >= 0 ? "+" : ""}${data.chart.change}%`}</span>
            <span className="text-xs text-muted" data-amount>
              {fmt(o.vsBefore, { amount: formatPrice(data.chart.previous, cur), n: chart })}
            </span>
          </p>
          <div dir="ltr">
            <svg viewBox={`-8 -8 ${W + 16} ${H + 16}`} className="h-52 w-full overflow-visible" preserveAspectRatio="none" role="img" aria-label={o.salesTitle}>
              <defs>
                <linearGradient id="overview-area" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((f) => (
                <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="var(--color-line)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
              ))}
              <path d={`${line} L${x(data.chart.days.length - 1)},${H} L${x(0)},${H} Z`} fill="url(#overview-area)" />
              <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            </svg>
            <div className="mt-1 flex justify-between text-[11px] text-muted tabular-nums">
              {data.chart.days.map((d, i) => (i % labelEvery === 0 || i === data.chart.days.length - 1 ? <span key={d.day}>{dateFmt.format(new Date(`${d.day}T12:00:00Z`))}</span> : null))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="space-y-3" data-testid="best-sellers">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{o.best}</h2>
            <Link href={sectionHref(lang, "products")} className="text-sm font-semibold text-accent hover:underline">
              {o.allProducts}
            </Link>
          </div>
          {data.best.length === 0 ? (
            <p className="text-sm text-muted">{o.noProducts}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] tracking-wide text-muted uppercase">
                  <th className="py-2 text-start font-semibold">{o.cols.product}</th>
                  <th className="py-2 text-end font-semibold">{o.cols.orders}</th>
                  <th className="py-2 text-end font-semibold">{o.cols.revenue}</th>
                </tr>
              </thead>
              <tbody>
                {data.best.map((b) => (
                  <tr key={b.id} className="border-t border-line" data-best={b.name}>
                    <td className="py-2.5">
                      <span className="flex items-center gap-3">
                        {b.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.image} alt="" className="size-10 rounded-lg border border-line object-cover" />
                        ) : (
                          <span className="grid size-10 place-items-center rounded-lg bg-panel-2 text-muted">
                            <Package size={16} />
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{b.name}</span>
                          <span className="block truncate text-xs text-muted">
                            {b.sku}
                            {b.orders === 0 ? ` · ${o.notSelling}` : ""}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="py-2.5 text-end tabular-nums">{b.orders}</td>
                    <td className="py-2.5 text-end font-semibold tabular-nums" data-amount>
                      {formatPrice(b.revenue, cur)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="space-y-3" data-testid="latest-orders">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{o.latest}</h2>
            <Link href={orders} className="text-sm font-semibold text-accent hover:underline">
              {o.viewAll}
            </Link>
          </div>
          {data.latest.length === 0 ? (
            <p className="text-sm text-muted">{o.noOrders}</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.latest.map((r) => {
                const w = wilayas.find((x) => x.code === r.wilaya);
                return (
                  <li key={r.id}>
                    <Link href={`${orders}/${r.id}`} className="flex items-center gap-3 py-2.5 text-sm hover:bg-panel-2/60" data-order={r.number}>
                      <span className="w-28 shrink-0">
                        <span className="block font-semibold tabular-nums">#{r.number}</span>
                        <span className="block text-xs text-muted">{timeFmt.format(r.createdAt)}</span>
                      </span>
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-violet-soft text-xs font-semibold text-violet">{initials(r.customerName)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{r.customerName || "—"}</span>
                        <span className="block truncate text-xs text-muted">
                          {fmt(o.items, { n: r.items })}
                          {w ? ` · ${lang === "ar" ? w.ar : w.fr}` : ""}
                        </span>
                      </span>
                      <span className={`hidden rounded-full px-2.5 py-0.5 text-xs font-semibold sm:inline ${statusPill[r.status]}`}>{t.orders.statuses[r.status]}</span>
                      <span className="w-24 text-end font-semibold tabular-nums" data-amount>
                        {formatPrice(r.total, cur)}
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-muted rtl:rotate-180" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {doneSteps < steps.length && (
        <section className="grid gap-4 rounded-2xl border border-line bg-gradient-to-r from-panel via-panel to-accent-soft p-5 lg:grid-cols-[1fr_3fr]" data-testid="checklist">
          <div className="flex flex-col justify-center gap-2">
            <h2 className="text-xl font-bold">{fmt(o.progress, { done: doneSteps, left: steps.length - doneSteps })}</h2>
            <p className="text-sm text-muted">{o.progressHint}</p>
            <div className="h-1.5 overflow-hidden rounded-full bg-panel-2">
              <div className="h-full rounded-full bg-accent" style={{ width: `${(doneSteps / steps.length) * 100}%` }} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {steps.map(({ key, done, icon: Icon, href: to }) => (
              <div key={key} className={`flex flex-col gap-2 rounded-xl border border-line bg-panel p-4 ${done ? "opacity-60" : ""}`} data-step={key} data-done={done}>
                <p className="flex items-start justify-between gap-2 text-sm font-semibold">
                  {o.steps[key][0]}
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line text-muted">
                    <Icon size={15} />
                  </span>
                </p>
                <p className="flex-1 text-xs text-muted">{o.steps[key][1]}</p>
                {done ? (
                  <span className="text-xs font-semibold text-accent">✓ {o.done}</span>
                ) : (
                  <Link href={to} className={buttonClass("secondary", "self-start py-1.5 text-xs")}>
                    {o.steps[key][2]} <ArrowRight size={13} className="rtl:rotate-180" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
