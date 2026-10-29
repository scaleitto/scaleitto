// Order analysis blocks (server components), with the analytics page's cards and tables.
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt } from "@/lib/format";
import { Card } from "@/ui";
import { Kpi, Table, rate, tone } from "@/features/analytics/views";
import type { OrderInsights } from "./insights-math";

export function InsightKpis({ data, t }: { data: OrderInsights; t: Dictionary }) {
  const k = t.orders.insights;
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="insight-kpis">
      <Kpi id="orders" label={k.orders} value={data.orders} hint={fmt(k.ordersHint, { pending: data.pending, transit: data.inTransit })} />
      <Kpi id="confirmation" label={k.confirmation} value={rate(data.rates.confirmation)} hint={k.confirmationHint} />
      <Kpi id="delivery" label={k.delivery} value={rate(data.rates.delivery)} hint={k.deliveryHint} />
      <Kpi id="return" label={k.return} value={rate(data.rates.return)} hint={fmt(k.cancelHint, { n: rate(data.rates.cancel) })} />
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
