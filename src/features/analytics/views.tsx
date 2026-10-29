// Analytics page blocks. Plain server components: the charts' hover tooltips are CSS only.
import Link from "next/link";
import type { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt, formatPrice } from "@/lib/format";
import { wilayaName } from "@/lib/wilayas";
import { Badge, Card, Input, buttonClass } from "@/ui";
import { statusTone } from "@/features/orders/statuses";
import { change, pct, type Analytics } from "./compute";
import { presets, type Range } from "./range";

export const rate = (v: number | null) => (v == null ? "—" : `${v}%`);

export function PeriodBar({ base, range, t }: { base: string; range: Range; t: Dictionary }) {
  const a = t.analytics;
  return (
    <div className="mb-6 flex flex-wrap items-end gap-3" data-testid="period-bar">
      <nav className="flex flex-wrap gap-1 rounded-lg bg-panel p-1 text-sm" aria-label="period">
        {presets.map((p) => (
          <Link
            key={p}
            href={p === "30d" ? base : `${base}?period=${p}`}
            aria-current={range.preset === p ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 font-medium whitespace-nowrap ${range.preset === p ? "bg-panel-2 text-fg" : "text-muted hover:text-fg"}`}
          >
            {a.periods[p]}
          </Link>
        ))}
      </nav>
      {/* A plain GET form: the period lives in the URL, so it can be shared and reloaded */}
      <form action={base} className={`flex flex-wrap items-end gap-2 rounded-lg p-1 text-sm ${range.preset === "custom" ? "bg-panel-2" : ""}`}>
        <input type="hidden" name="period" value="custom" />
        <label className="flex items-center gap-1.5 text-muted">
          {a.from}
          <Input type="date" name="from" defaultValue={range.fromDay} required dir="ltr" className="w-auto py-1.5" />
        </label>
        <label className="flex items-center gap-1.5 text-muted">
          {a.to}
          <Input type="date" name="to" defaultValue={range.toDay} required dir="ltr" className="w-auto py-1.5" />
        </label>
        <button type="submit" className={buttonClass("secondary", "py-1.5")}>
          {a.apply}
        </button>
      </form>
    </div>
  );
}

// Change against the previous period: in % for amounts, in percentage points for rates.
function Delta({ now, before, points = false, t }: { now: number | null; before: number | null; points?: boolean; t: Dictionary }) {
  const d = points ? (now == null || before == null ? null : Math.round((now - before) * 10) / 10) : change(now, before);
  if (d == null || (points && d === 0)) return null;
  const up = d >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${up ? "text-accent" : "text-danger"}`} title={t.analytics.vsPrevious} data-delta>
      {up ? <TrendingUp size={14} aria-hidden /> : <TrendingDown size={14} aria-hidden />}
      <bdi dir="ltr">{`${up ? "+" : ""}${d}${points ? "" : "%"}`}</bdi>
      {points && t.analytics.points}
    </span>
  );
}

export function Kpi({ id, label, value, hint, delta }: { id: string; label: string; value: ReactNode; hint?: string; delta?: ReactNode }) {
  return (
    <Card className="space-y-1.5 p-4" data-kpi={id}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <p className="text-2xl font-bold tabular-nums" data-value>
          {value}
        </p>
        {delta}
      </div>
      {hint && <p className="text-xs leading-relaxed text-muted">{hint}</p>}
    </Card>
  );
}

export function KpiGrid({ data, t }: { data: Analytics; t: Dictionary }) {
  const k = t.analytics.kpis;
  const s = data.totals;
  const p = data.previous;
  const cur = t.common.currency;
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi id="orders" label={k.orders} value={s.orders} delta={<Delta now={s.orders} before={p.orders} t={t} />} />
      <Kpi id="confirmation" label={k.confirmation} value={rate(s.confirmation)} hint={fmt(k.confirmationHint, { n: s.pending })} delta={<Delta now={s.confirmation} before={p.confirmation} points t={t} />} />
      <Kpi id="delivery" label={k.delivery} value={rate(s.delivery)} hint={k.deliveryHint} delta={<Delta now={s.delivery} before={p.delivery} points t={t} />} />
      <Kpi id="revenue" label={k.revenue} value={formatPrice(s.revenue, cur)} hint={k.revenueHint} delta={<Delta now={s.revenue} before={p.revenue} t={t} />} />
      <Kpi id="averageOrder" label={k.averageOrder} value={formatPrice(s.averageOrder, cur)} />
      <Kpi id="inDelivery" label={k.inDelivery} value={formatPrice(s.inDelivery, cur)} hint={k.inDeliveryHint} />
      <Kpi id="profit" label={k.profit} value={formatPrice(s.profit, cur)} hint={s.costMissing ? k.profitMissing : k.profitHint} />
      <Kpi id="recovered" label={k.recovered} value={rate(s.recoveryRate)} hint={fmt(k.recoveredHint, { n: s.recovered, total: s.leads })} />
    </div>
  );
}

// One-series bar chart. Bars grow from the baseline; each has a hover/focus tooltip.
// Kept left-to-right in every language, like the time axis people are used to.
function BarChart({ bars, label, testId }: { bars: { key: string; axis: string; value: number; tip: string[] }[]; label: string; testId: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const ticks = [max, Math.round(max / 2), 0].filter((v, i, all) => all.indexOf(v) === i);
  const every = Math.ceil(bars.length / 8);
  return (
    <div dir="ltr" className="flex gap-2" role="img" aria-label={label} data-testid={testId}>
      <div className="flex h-44 flex-col justify-between pb-5 text-end text-[11px] text-muted tabular-nums">
        {ticks.map((v) => (
          <span key={v} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">
            {v}
          </span>
        ))}
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="pointer-events-none absolute inset-x-0 top-0 bottom-5 flex flex-col justify-between">
          {ticks.map((v) => (
            <div key={v} className="border-t border-line/60" />
          ))}
        </div>
        <div className="relative flex h-44 items-end gap-[2px] pb-5">
          {bars.map((b, i) => (
            <div key={b.key} tabIndex={0} className="group relative flex h-full min-w-0 flex-1 items-end outline-none" data-bar={b.key} data-value={b.value}>
              <div className="w-full rounded-t-[4px] bg-accent/85 transition group-hover:bg-accent group-focus:bg-accent" style={{ height: `${(b.value / max) * 100}%`, minHeight: b.value ? 2 : 0 }} />
              {i % every === 0 && <span className="absolute top-full mt-1 -translate-x-1/2 text-[11px] whitespace-nowrap text-muted" style={{ left: "50%" }}>{b.axis}</span>}
              <div className={`pointer-events-none absolute top-0 z-10 hidden rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs whitespace-nowrap shadow-xl group-hover:block group-focus:block ${i < bars.length / 2 ? "left-full ms-1" : "right-full me-1"}`}>
                {b.tip.map((line, j) => (
                  <p key={j} className={j === 0 ? "font-semibold text-fg" : "text-muted"}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const shortDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

export function DailyChart({ data, t }: { data: Analytics; t: Dictionary }) {
  const a = t.analytics;
  const cur = t.common.currency;
  return (
    <Card className="mb-6 space-y-4">
      <div>
        <h2 className="font-semibold">{a.daily}</h2>
        <p className="text-xs text-muted">{a.dailyHint}</p>
      </div>
      <BarChart
        label={a.daily}
        testId="daily-chart"
        bars={data.daily.map((d) => ({
          key: d.day,
          axis: shortDay(d.day),
          value: d.orders,
          tip: [d.day, `${a.tooltip.orders}: ${d.orders}`, `${a.tooltip.confirmed}: ${d.confirmed}`, `${a.tooltip.delivered}: ${d.delivered}`, `${a.tooltip.revenue}: ${formatPrice(d.revenue, cur)}`],
        }))}
      />
      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-muted hover:text-fg">{a.table}</summary>
        <div className="mt-3 max-h-72 overflow-auto">
          <table className="w-full text-xs">
            <thead className="text-muted">
              <tr>
                <th className="p-1.5 text-start font-medium" />
                <th className="p-1.5 text-start font-medium">{a.funnelSteps.orders}</th>
                <th className="p-1.5 text-start font-medium">{a.funnelSteps.confirmed}</th>
                <th className="p-1.5 text-start font-medium">{a.funnelSteps.delivered}</th>
                <th className="p-1.5 text-start font-medium">{a.columns.revenue}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {data.daily.map((d) => (
                <tr key={d.day} className="border-t border-line">
                  <td className="p-1.5" dir="ltr">
                    {d.day}
                  </td>
                  <td className="p-1.5">{d.orders}</td>
                  <td className="p-1.5">{d.confirmed}</td>
                  <td className="p-1.5">{d.delivered}</td>
                  <td className="p-1.5">{formatPrice(d.revenue, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  );
}

export function HourlyChart({ data, t }: { data: Analytics; t: Dictionary }) {
  const a = t.analytics;
  const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-semibold">{a.hourly}</h2>
        <p className="text-xs text-muted">{a.hourlyHint}</p>
      </div>
      <BarChart label={a.hourly} testId="hourly-chart" bars={data.hourly.map((h) => ({ key: String(h.hour), axis: hh(h.hour), value: h.orders, tip: [`${hh(h.hour)} – ${hh((h.hour + 1) % 24)}`, `${a.tooltip.orders}: ${h.orders}`] }))} />
    </Card>
  );
}

// Orders → confirmed → shipped → delivered, each as a share of all orders.
export function Funnel({ data, t }: { data: Analytics; t: Dictionary }) {
  const a = t.analytics;
  const f = data.funnel;
  const steps = (["orders", "confirmed", "shipped", "delivered"] as const).map((k) => ({ k, n: f[k] }));
  return (
    <Card className="space-y-3" data-testid="funnel">
      <h2 className="font-semibold">{a.funnel}</h2>
      {steps.map(({ k, n }) => (
        <div key={k} data-step={k}>
          <div className="mb-1 flex justify-between text-sm">
            <span>{a.funnelSteps[k]}</span>
            <span className="font-semibold tabular-nums">
              {n} <span className="text-xs font-normal text-muted">{k === "orders" ? "" : rate(pct(n, f.orders))}</span>
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-panel-2">
            <div className="h-full rounded-full bg-accent" style={{ width: `${f.orders ? (n / f.orders) * 100 : 0}%` }} />
          </div>
        </div>
      ))}
    </Card>
  );
}

export function StatusList({ data, t }: { data: Analytics; t: Dictionary }) {
  const total = data.totals.orders;
  return (
    <Card className="space-y-3" data-testid="statuses">
      <h2 className="font-semibold">{t.analytics.statuses}</h2>
      <ul className="space-y-2 text-sm">
        {data.statuses.map((s) => (
          <li key={s.status} className="flex items-center justify-between gap-3" data-status={s.status}>
            <Badge tone={statusTone[s.status]}>{t.orders.statuses[s.status]}</Badge>
            <span className="font-semibold tabular-nums">
              {s.n} <span className="text-xs font-normal text-muted">{rate(pct(s.n, total))}</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function Table({ title, head, rows, testId }: { title: string; head: string[]; rows: { key: string; cells: ReactNode[] }[]; testId: string }) {
  return (
    <Card className="overflow-x-auto p-0" data-testid={testId}>
      <h2 className="p-4 pb-2 font-semibold">{title}</h2>
      <table className="w-full text-sm">
        <thead className="text-xs text-muted">
          <tr className="border-b border-line">
            {head.map((h, i) => (
              <th key={i} className="p-3 text-start font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-line last:border-0" data-row={r.key}>
              {r.cells.map((c, i) => (
                <td key={i} className={`p-3 ${i === 0 ? "max-w-56 truncate font-medium" : "whitespace-nowrap"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export const tone = (v: number | null) => (v == null ? "text-muted" : v >= 70 ? "text-accent" : v >= 50 ? "text-warning" : "text-danger");

export function ProductsTable({ data, t }: { data: Analytics; t: Dictionary }) {
  const c = t.analytics.columns;
  return (
    <Table
      title={t.analytics.products}
      testId="top-products"
      head={[c.product, c.quantity, c.orders, c.delivered, c.revenue]}
      rows={data.products.map((p) => ({ key: p.key, cells: [p.name, p.quantity, p.orders, p.delivered, formatPrice(p.revenue, t.common.currency)] }))}
    />
  );
}

export function WilayasTable({ data, lang, t }: { data: Analytics; lang: string; t: Dictionary }) {
  const c = t.analytics.columns;
  return (
    <Table
      title={t.analytics.wilayas}
      testId="wilayas"
      head={[c.wilaya, c.orders, c.confirmation, c.delivery, c.revenue]}
      rows={data.wilayas.map((w) => ({
        key: String(w.key),
        cells: [wilayaName(w.key, lang), w.orders, <span key="c" className={tone(w.confirmation)}>{rate(w.confirmation)}</span>, <span key="d" className={tone(w.delivery)}>{rate(w.delivery)}</span>, formatPrice(w.revenue, t.common.currency)],
      }))}
    />
  );
}

export function SourcesTable({ data, pageTitles, t }: { data: Analytics; pageTitles: Record<string, string>; t: Dictionary }) {
  const a = t.analytics;
  const c = a.columns;
  return (
    <Table
      title={a.sources}
      testId="sources"
      head={[c.source, c.orders, c.confirmation, c.delivery, c.revenue]}
      rows={data.sources.map((s) => ({
        key: s.key || "store",
        cells: [s.key ? (pageTitles[s.key] ?? a.deletedPage) : a.store, s.orders, <span key="c" className={tone(s.confirmation)}>{rate(s.confirmation)}</span>, <span key="d" className={tone(s.delivery)}>{rate(s.delivery)}</span>, formatPrice(s.revenue, t.common.currency)],
      }))}
    />
  );
}
