// The orders' blocks of Analytics (server components), with the analytics page's cards and tables.
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt } from "@/lib/format";
import { Card } from "@/ui";
import { Kpi, Table, rate, tone } from "@/features/analytics/views";
import type { OrderInsights } from "./insights-math";

export function InsightKpis({ data, t }: { data: OrderInsights; t: Dictionary }) {
  const k = t.orders.insights;
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="insight-kpis">
      {/* Only what the sales KPIs above do not show already (orders, confirmation and delivery rates are there) */}
      <Kpi id="flow" label={k.inProgress} value={data.pending + data.inTransit} hint={fmt(k.ordersHint, { pending: data.pending, transit: data.inTransit })} />
      <Kpi id="return" label={k.return} value={rate(data.rates.return)} hint={k.returnHint} />
      <Kpi id="refusal" label={k.refusal} value={rate(data.rates.cancel)} hint={k.refusalHint} />
      <Kpi id="fake" label={k.fake} value={rate(data.rates.fake)} hint={k.fakeHint} />
    </div>
  );
}

// How long the steps take (median, so one very late order does not change it)
export function Timing({ data, t }: { data: OrderInsights; t: Dictionary }) {
  const k = t.orders.insights;
  const v = (n: number | null, unit: string) => (n == null ? "—" : fmt(unit, { n }));
  const steps = [
    ["confirm", k.toConfirm, v(data.timing.confirmHours, k.hours)],
    ["ship", k.toShip, v(data.timing.shipHours, k.hours)],
    ["deliver", k.toDeliver, v(data.timing.deliverDays, k.days)],
  ] as const;
  return (
    <Card className="space-y-3" data-testid="timing">
      <div>
        <h2 className="font-semibold">{k.timing}</h2>
        <p className="mt-0.5 text-xs text-muted">{k.timingHint}</p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        {steps.map(([key, label, value]) => (
          <div key={key} className="rounded-lg bg-panel-2 p-3" data-step={key}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-1 text-xl font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function CarriersTable({ data, t }: { data: OrderInsights; t: Dictionary }) {
  const k = t.orders.insights;
  if (!data.carriers.length) return null;
  return (
    <Table
      title={k.carriers}
      testId="carriers"
      head={[k.carrier, k.sent, k.delivered, k.returned, k.transit, k.delivery]}
      rows={data.carriers.map((c) => ({ key: c.name, cells: [c.name, c.sent, c.delivered, c.returned, c.transit, <span key="d" className={tone(c.delivery)}>{rate(c.delivery)}</span>] }))}
    />
  );
}

// Parcels the courier could not deliver yet, and whose fault the returns were
export function FollowUpCard({ data, t }: { data: OrderInsights; t: Dictionary }) {
  const k = t.orders.insights;
  const f = t.orders.followup;
  const returns = data.faults.courier + data.faults.customer + data.faults.company + data.faults.unknown;
  const rows = [
    ["postponed", f.states.postponed, data.followUp.postponed],
    ["no_answer", f.states.no_answer, data.followUp.noAnswer],
  ] as const;
  const faults = [
    ["customer", f.faults.customer, data.faults.customer],
    ["courier", f.faults.courier, data.faults.courier],
    ["company", f.faults.company, data.faults.company],
    ["unknown", k.faultUnknown, data.faults.unknown],
  ] as const;
  return (
    <Card className="space-y-4" data-testid="follow-up">
      <div>
        <h2 className="font-semibold">{k.followUp}</h2>
        <p className="mt-0.5 text-xs text-muted">{k.followUpHint}</p>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        {rows.map(([key, label, n]) => (
          <div key={key} className="rounded-lg bg-panel-2 p-3" data-state={key}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-1 text-xl font-bold tabular-nums">{n}</dd>
          </div>
        ))}
      </dl>
      <div>
        <h3 className="mb-2 text-sm font-semibold">{fmt(k.faultsTitle, { n: returns })}</h3>
        <ul className="space-y-2 text-sm">
          {faults.map(([key, label, n]) => (
            <li key={key} data-fault={key}>
              <div className="flex justify-between gap-3">
                <span>{label}</span>
                <span className="font-semibold tabular-nums">{n}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-panel-2">
                <div className="h-full rounded-full bg-danger/70" style={{ width: `${returns ? Math.round((n / returns) * 100) : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
