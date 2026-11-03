// Zimam's analytics tabs (server components): orders, products, impressions, call center.
import type { ReactNode } from "react";
import Link from "next/link";
import { CircleCheck, ClipboardCheck, Clock, Eye, Filter, Headphones, Lightbulb, MapPin, MoreHorizontal, Package, Percent, Plus, ShoppingCart, TrendingUp, Truck, Users, Wallet, type LucideIcon } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt, formatPrice } from "@/lib/format";
import { wilayaTitle } from "@/lib/wilayas";
import { Card, buttonClass } from "@/ui";
import type { Analytics } from "./compute";
import { change, distributionStatuses } from "./compute";
import { BarChart, Donut, FunnelShape, LineChart, Spark } from "./charts";
import { WilayaMap } from "./WilayaMap";

type A = Dictionary["analytics"];
export const rate = (v: number | null) => (v == null ? "-" : `${v.toFixed(1)}%`);
const dayLabel = (day: string, lang: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString(lang === "ar" ? "ar-DZ" : lang, { month: "short", day: "numeric", timeZone: "UTC" });

// The status colors of the distribution ring (theme tokens)
const statusColors: Record<(typeof distributionStatuses)[number], string> = {
  pending: "var(--color-violet)",
  call_back: "var(--color-info)",
  confirmed: "var(--color-accent)",
  in_transit: "#3b82f6",
  delivered: "#10b981",
  returned: "var(--color-danger)",
  cancelled: "var(--color-muted)",
  flagged: "#991b1b",
};

function Box({ title, hint, action, children, className = "", testId }: { title: string; hint?: string; action?: ReactNode; children: ReactNode; className?: string; testId?: string }) {
  return (
    <Card className={`space-y-4 ${className}`} data-testid={testId}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function Kpi({ id, icon: Icon, label, value, spark, sub, delta }: { id: string; icon: LucideIcon; label: string; value: ReactNode; spark?: number[]; sub?: string; delta?: number | null }) {
  return (
    <Card className="flex flex-col gap-3" data-kpi={id}>
      <span className="flex items-center gap-2.5 text-sm font-medium text-muted">
        <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent">
          <Icon size={17} />
        </span>
        {label}
      </span>
      <span className="flex items-end justify-between gap-3">
        <span className="text-3xl font-bold tabular-nums" data-value>
          {value}
        </span>
        {spark && <Spark values={spark} />}
      </span>
      {sub && (
        <span className="flex items-center justify-between text-xs text-muted">
          {sub}
          <span className={delta == null ? "" : delta >= 0 ? "font-semibold text-accent" : "font-semibold text-danger"} dir="ltr">
            {delta == null ? "–" : `${delta > 0 ? "+" : ""}${delta}%`}
          </span>
        </span>
      )}
    </Card>
  );
}

const vs = (a: A, days: number) => (days === 1 ? a.vsYesterday : fmt(a.vsBefore, { n: days }));

// ── Orders ───────────────────────────────────────────
export function OrdersTab({ data, lang, t }: { data: Analytics; lang: string; t: Dictionary }) {
  const a = t.analytics;
  const o = data.orders;
  const labels = o.daily.map((d) => dayLabel(d.day, lang));
  const sub = vs(a, o.daily.length);
  const stepIcons = { orders: Package, confirmed: ClipboardCheck, shipped: Truck, delivered: CircleCheck };
  const insightIcons = { pending: Clock, dropoff: Filter, waiting: Clock, noConfirm: MapPin };
  const stepName = (k: string) => a.funnelSteps[k as keyof A["funnelSteps"]] ?? k;
  return (
    <div className="space-y-6" data-tab-panel="orders">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi id="orders" icon={ShoppingCart} label={a.kpis.orders} value={o.kpis.orders.value} spark={o.daily.map((d) => d.orders)} sub={sub} delta={change(o.kpis.orders.value, o.kpis.orders.previous)} />
        <Kpi id="sales" icon={Wallet} label={a.kpis.sales} value={formatPrice(o.kpis.sales.value, t.common.currency)} spark={o.daily.map((d) => d.sales)} sub={sub} delta={change(o.kpis.sales.value, o.kpis.sales.previous)} />
        <Kpi id="delivery" icon={Truck} label={a.kpis.delivery} value={rate(o.kpis.delivery.value)} sub={sub} delta={change(o.kpis.delivery.value, o.kpis.delivery.previous)} />
        <Kpi id="avgDaily" icon={TrendingUp} label={a.kpis.avgDaily} value={o.kpis.avgDaily.value} sub={sub} delta={change(o.kpis.avgDaily.value, o.kpis.avgDaily.previous)} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Box title={a.ordersOverTime} testId="orders-over-time">
          <BarChart labels={labels} current={o.daily.map((d) => d.orders)} previous={o.daily.map((d) => d.previous)} names={[a.current, a.previous]} />
        </Box>
        <Box title={a.distribution} testId="status-distribution">
          <div className="flex flex-wrap items-center gap-6">
            <Donut parts={o.statuses.map((s) => ({ value: s.n, color: statusColors[s.status] }))} center={o.total} sub={a.ordersWord} />
            <ul className="min-w-44 flex-1 space-y-1.5 text-sm">
              {o.statuses.map((s) => (
                <li key={s.status} className="flex items-center gap-2" data-status={s.status}>
                  <span className="size-2.5 rounded-sm" style={{ background: statusColors[s.status] }} />
                  <span className="flex-1">{t.orders.statuses[s.status]}</span>
                  <span className="w-8 text-end tabular-nums">{s.n}</span>
                  <span className="w-12 text-end text-muted tabular-nums">{o.total ? Math.round((s.n / o.total) * 100) : 0}%</span>
                </li>
              ))}
            </ul>
          </div>
        </Box>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Box title={a.funnel} hint={a.funnelHint} testId="funnel">
          <FunnelShape steps={o.funnel.map((s) => ({ n: s.n, rate: s.rate }))} />
          <ol className="grid grid-cols-4 gap-2 text-center">
            {o.funnel.map((s) => {
              const Icon = stepIcons[s.key];
              return (
                <li key={s.key} className="flex flex-col items-center gap-1.5" data-step={s.key}>
                  <span className="grid size-11 place-items-center rounded-full bg-accent text-white">
                    <Icon size={19} />
                  </span>
                  <span className="text-xs font-semibold">{a.funnelSteps[s.key]}</span>
                  <span className="text-xl font-bold tabular-nums">{s.n}</span>
                  <span className="text-xs text-muted tabular-nums">{rate(s.rate)}</span>
                </li>
              );
            })}
          </ol>
        </Box>
        <Card className="space-y-4 border-accent/25 bg-accent/10" data-testid="insights">
          <h2 className="font-semibold">{a.insights}</h2>
          {o.insights.length === 0 ? (
            <p className="text-sm text-muted">{a.noInsights}</p>
          ) : (
            <ul className="space-y-4">
              {o.insights.map((i) => {
                const Icon = insightIcons[i.key];
                const v = { ...i.values } as Record<string, string | number>;
                if (i.key === "dropoff") {
                  v.from = stepName(String(v.from));
                  v.to = stepName(String(v.to));
                }
                if (i.key === "noConfirm") v.names = String(v.codes).split(",").map((c) => wilayaTitle(Number(c), lang)).join("، ");
                const text = a.insight[i.key];
                return (
                  <li key={i.key} className="flex gap-3" data-insight={i.key}>
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-panel text-warning">
                      <Icon size={15} />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{fmt(text.title, v)}</span>
                      <span className="block text-xs text-muted">{fmt(text.text, v)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Box title={a.wilayas} testId="wilayas-map">
          <WilayaMap counts={Object.fromEntries(o.wilayas.map((w) => [w.code, w.orders]))} lang={lang} label={a.wilayas} attribution={a.mapAttribution} />
        </Box>
        <Box title={a.wilayasTable} testId="wilayas">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted uppercase">
                <tr className="border-b border-line">
                  {(["wilaya", "orders", "confirmed", "delivered", "returnRate"] as const).map((k) => (
                    <th key={k} className={`p-2.5 font-semibold ${k === "wilaya" ? "text-start" : "text-end"}`}>
                      {a.columns[k]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {o.wilayas.map((w) => (
                  <tr key={w.code} className="border-b border-line last:border-0" data-wilaya={w.code}>
                    <td className="p-2.5">{wilayaTitle(w.code, lang)}</td>
                    <td className="p-2.5 text-end tabular-nums">{w.orders}</td>
                    <td className="p-2.5 text-end tabular-nums">{w.confirmed}</td>
                    <td className="p-2.5 text-end tabular-nums">{w.delivered}</td>
                    <td className="p-2.5 text-end tabular-nums">{rate(w.returnRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Box>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Box title={a.salesOverTime} testId="sales-over-time">
          <LineChart labels={labels} series={[{ name: a.kpis.sales, values: o.daily.map((d) => d.sales), color: "var(--color-accent)" }]} />
        </Box>
        <Box title={a.deliveryPerformance} testId="delivery-performance">
          <LineChart
            labels={labels}
            series={[
              { name: a.delivered, values: o.daily.map((d) => d.delivered), color: "var(--color-accent)" },
              { name: a.returned, values: o.daily.map((d) => d.returned), color: "var(--color-danger)" },
            ]}
          />
        </Box>
      </div>
    </div>
  );
}

// ── Products ─────────────────────────────────────────
export function ProductsTab({ data, lang, t, productsHref }: { data: Analytics; lang: string; t: Dictionary; productsHref: string }) {
  const a = t.analytics;
  const p = data.products;
  const labels = p.daily.map((d) => dayLabel(d.day, lang));
  const bandColors = { excellent: "var(--color-accent)", good: "var(--color-warning)", low: "var(--color-danger)" };
  const rated = p.bands.excellent + p.bands.good + p.bands.low;
  return (
    <div className="space-y-6" data-tab-panel="products">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi id="products" icon={Package} label={a.kpis.products} value={p.kpis.products} />
        <Kpi id="visitors" icon={Eye} label={a.kpis.visitors} value={p.kpis.visitors} spark={p.daily.map((d) => d.visitors)} />
        <Kpi id="productOrders" icon={ShoppingCart} label={a.kpis.productOrders} value={p.kpis.orders} spark={p.daily.map((d) => d.orders)} />
        <Kpi id="orderRate" icon={Percent} label={a.kpis.orderRate} value={rate(p.kpis.orderRate)} spark={p.daily.map((d) => d.rate)} />
        <Kpi id="avgDaily" icon={TrendingUp} label={a.kpis.avgDaily} value={p.kpis.avgDaily} />
      </div>
      <Box title={a.orderRateOverview} testId="order-rate">
        <LineChart labels={labels} series={[{ name: a.kpis.orderRate, values: p.daily.map((d) => d.rate), color: "var(--color-accent)" }]} format={(n) => `${Math.round(n)}%`} wide />
      </Box>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Box title={a.productsDistribution} testId="bands">
          <Donut parts={(["excellent", "good", "low"] as const).map((b) => ({ value: p.bands[b], color: bandColors[b] }))} center={rated} sub={a.productWord} />
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {(["excellent", "good", "low"] as const).map((b) => (
              <li key={b} className="flex items-center gap-2" data-band={b}>
                <span className="size-2.5 rounded-sm" style={{ background: bandColors[b] }} />
                <span className="flex-1">{a.bands[b]}</span>
                <span className="tabular-nums">{p.bands[b]}</span>
                <span className="text-muted tabular-nums">{rated ? Math.round((p.bands[b] / rated) * 100) : 0}%</span>
              </li>
            ))}
          </ul>
        </Box>
        <Box title={a.productsPerformance} testId="products-table">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted uppercase">
                <tr className="border-b border-line">
                  {(["product", "visitors", "orders", "orderRate", "deliveryRate", "trend", "actions"] as const).map((k) => (
                    <th key={k} className={`p-2.5 font-semibold ${k === "product" ? "text-start" : "text-end"}`}>
                      {a.columns[k]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {p.rows.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0" data-product={r.name}>
                    <td className="p-2.5">
                      <span className="flex items-center gap-2.5">
                        {r.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.image} alt="" className="size-9 rounded-md object-cover" />
                        ) : (
                          <span className="grid size-9 place-items-center rounded-md bg-panel-2 text-muted">
                            <Package size={16} />
                          </span>
                        )}
                        <span className="font-medium">{r.name}</span>
                      </span>
                    </td>
                    <td className="p-2.5 text-end tabular-nums">{r.visitors}</td>
                    <td className="p-2.5 text-end tabular-nums">{r.orders}</td>
                    <td className="p-2.5 text-end tabular-nums" data-col="orderRate">
                      {rate(r.orderRate)}
                    </td>
                    <td className="p-2.5 text-end tabular-nums">{rate(r.deliveryRate)}</td>
                    <td className="p-2.5">
                      <span className="flex justify-end">
                        <Spark values={r.spark} color="#3b82f6" />
                      </span>
                    </td>
                    <td className="p-2.5 text-end">
                      <details className="relative inline-block text-start" data-testid="product-actions">
                        <summary className="grid size-8 cursor-pointer list-none place-items-center rounded-lg border border-line hover:bg-panel-2" aria-label={a.columns.actions}>
                          <MoreHorizontal size={16} />
                        </summary>
                        <div className="absolute end-0 z-10 mt-1 w-44 rounded-xl border border-line bg-panel p-1 shadow-lg">
                          <Link href={`${productsHref}/${r.id}`} className="block rounded-lg px-3 py-2 text-sm hover:bg-panel-2">
                            {a.editProduct}
                          </Link>
                          <Link href={`${productsHref}/${r.id}#preview`} className="block rounded-lg px-3 py-2 text-sm hover:bg-panel-2">
                            {a.viewProduct}
                          </Link>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Tip text={a.productsTip} />
        </Box>
      </div>
    </div>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 rounded-xl bg-violet-soft px-4 py-3 text-sm text-fg">
      <Lightbulb size={16} className="shrink-0 text-violet" /> {text}
    </p>
  );
}

// ── Impressions ──────────────────────────────────────
export function ImpressionsTab({ data, lang, t, trend, trendHref }: { data: Analytics; lang: string; t: Dictionary; trend: "impressions" | "visitors"; trendHref: (k: "impressions" | "visitors") => string }) {
  const a = t.analytics;
  const im = data.impressions;
  const labels = im.daily.map((d) => dayLabel(d.day, lang));
  const sub = vs(a, im.daily.length);
  return (
    <div className="space-y-6" data-tab-panel="impressions">
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi id="impressions" icon={Eye} label={a.kpis.impressions} value={im.kpis.impressions.value} spark={im.daily.map((d) => d.impressions)} sub={sub} delta={change(im.kpis.impressions.value, im.kpis.impressions.previous)} />
        <Kpi id="totalVisitors" icon={Users} label={a.kpis.totalVisitors} value={im.kpis.visitors.value} spark={im.daily.map((d) => d.visitors)} sub={sub} delta={change(im.kpis.visitors.value, im.kpis.visitors.previous)} />
        <Kpi id="avgOrderRate" icon={Percent} label={a.kpis.avgOrderRate} value={rate(im.kpis.orderRate.value)} sub={sub} delta={change(im.kpis.orderRate.value, im.kpis.orderRate.previous)} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Box title={a.sources} testId="sources">
          {im.sources.length === 0 ? (
            <p className="text-sm text-muted">{a.noVisits}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {im.sources.map((s) => (
                <li key={s.source} className="flex items-center gap-2" data-source={s.source}>
                  <span className="size-2.5 rounded-sm bg-info" />
                  <span className="flex-1 truncate" dir="ltr">
                    {s.source === "direct" ? a.direct : s.source}
                  </span>
                  <span className="tabular-nums">{s.visitors}</span>
                  <span className="w-14 text-end text-muted tabular-nums">{s.share}%</span>
                </li>
              ))}
            </ul>
          )}
        </Box>
        <Box
          title={a.dailyTrend}
          testId="daily-trend"
          action={
            <span className="inline-flex rounded-lg border border-line p-0.5 text-xs font-semibold" data-testid="trend-switch">
              {(["impressions", "visitors"] as const).map((k) => (
                <Link key={k} href={trendHref(k)} aria-current={trend === k ? "true" : undefined} className={`rounded-md px-2.5 py-1.5 ${trend === k ? "bg-accent text-white" : "text-fg-2 hover:bg-panel-2"}`} data-trend={k}>
                  {a.trend[k]}
                </Link>
              ))}
            </span>
          }
        >
          <LineChart
            labels={labels}
            series={[trend === "impressions" ? { name: a.kpis.impressions, values: im.daily.map((d) => d.impressions), color: "var(--color-accent)" } : { name: a.kpis.totalVisitors, values: im.daily.map((d) => d.visitors), color: "#3b82f6" }]}
          />
        </Box>
      </div>
      <Tip text={a.sourcesTip} />
    </div>
  );
}

// ── Call center ──────────────────────────────────────
export function TeamTab({ data, teamHref, t }: { data: Analytics; teamHref: string; t: Dictionary }) {
  const a = t.analytics;
  if (data.team.length === 0)
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line py-14 text-center" data-tab-panel="team">
        <Headphones size={30} className="text-muted" />
        <p className="font-semibold">{a.noAgents}</p>
        <p className="text-sm text-muted">{a.noAgentsHint}</p>
        <Link href={teamHref} className={buttonClass("primary")}>
          <Plus size={16} /> {a.addAgent}
        </Link>
      </div>
    );
  return (
    <Box title={a.teamTitle} testId="team-table">
      <div className="overflow-x-auto" data-tab-panel="team">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted uppercase">
            <tr className="border-b border-line">
              {(["agent", "assigned", "confirmed", "cancelled", "pending", "confirmation", "deliveryRate"] as const).map((k) => (
                <th key={k} className={`p-2.5 font-semibold ${k === "agent" ? "text-start" : "text-end"}`}>
                  {a.columns[k]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.team.map((m) => (
              <tr key={m.userId} className="border-b border-line last:border-0" data-agent={m.name}>
                <td className="p-2.5 font-medium">{m.name}</td>
                <td className="p-2.5 text-end tabular-nums">{m.assigned}</td>
                <td className="p-2.5 text-end tabular-nums">{m.confirmed}</td>
                <td className="p-2.5 text-end tabular-nums">{m.cancelled}</td>
                <td className="p-2.5 text-end tabular-nums">{m.pending}</td>
                <td className="p-2.5 text-end tabular-nums">{rate(m.confirmation)}</td>
                <td className="p-2.5 text-end tabular-nums">{rate(m.delivery)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Box>
  );
}
