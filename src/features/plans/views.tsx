// Plans page blocks (server components).
import { CircleAlert, Crown, Lock, ReceiptText } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt, formatDate, formatDay, formatPrice } from "@/lib/format";
import { Alert, Badge, Card } from "@/ui";
import type { PlanNotice, planOverview } from "./queries";
import { periodLabel, priceLabel } from "./labels";

type Overview = Awaited<ReturnType<typeof planOverview>>;

export const limitValue = (n: number, t: Dictionary) => (n === -1 ? t.common.unlimited : n.toLocaleString("fr-FR"));

export function CurrentPlan({ data, lang, t }: { data: Overview; lang: string; t: Dictionary }) {
  const p = t.plans;
  const current = data.current;
  if (data.platform)
    return (
      <Card className="space-y-4" data-testid="current-plan">
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Crown size={22} />
          </span>
          <div className="me-auto">
            <p className="text-xl font-bold" data-plan="platform">
              {p.platformShop}
            </p>
            <p className="text-sm text-muted">{p.platformShopHint}</p>
          </div>
        </div>
        <UsageMeters meters={data.meters} threshold={data.threshold} t={t} />
      </Card>
    );
  if (!current) return null;
  const price = data.contract?.priceMonthly ?? current.plan.priceMonthly;
  return (
    <Card className="space-y-4" data-testid="current-plan">
      {current.expired && current.expiresAt && "previous" in current && current.previous && (
        <Alert>{fmt(p.expired, { name: current.previous.name, date: formatDay(current.expiresAt, lang) })}</Alert>
      )}
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Crown size={22} />
        </span>
        <div className="me-auto">
          <p className="text-xs text-muted">{p.current}</p>
          <p className="text-xl font-bold" data-plan={current.plan.code}>
            {current.plan.name}
          </p>
          <p className="text-sm text-muted">
            {priceLabel({ priceMonthly: price, orderPack: data.contract?.priceMonthly != null ? null : current.plan.orderPack }, t)}
            {" · "}
            {!current.expired && current.expiresAt ? fmt(p.expires, { date: formatDay(current.expiresAt, lang) }) : p.noExpiry}
          </p>
        </div>
        {data.contract && (
          <Badge tone="info">
            {p.contract}
            {data.contract.endDate ? ` · ${fmt(p.contractUntil, { date: data.contract.endDate })}` : ""}
          </Badge>
        )}
      </div>
      {data.credits !== null && (
        <div className="rounded-lg border border-line bg-panel-2 p-4" data-testid="order-credits" data-credits={data.credits}>
          <p className="text-sm text-muted">{p.credits}</p>
          <p className={`text-2xl font-bold tabular-nums ${data.credits ? "" : "text-danger"}`}>{fmt(p.creditsLeft, { n: data.credits.toLocaleString("fr-FR") })}</p>
          <p className="mt-1 text-xs text-muted">{p.creditsHint}</p>
        </div>
      )}
      <UsageMeters meters={data.meters} threshold={data.threshold} t={t} />
    </Card>
  );
}

// Used / limit bars (the merchant's Plans page and the platform admin's shop page)
export function UsageMeters({ meters, threshold, t }: { meters: Overview["meters"]; threshold: number; t: Dictionary }) {
  const p = t.plans;
  return (
      <div className="space-y-3" data-testid="usage">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{p.usage}</h2>
          <span className="text-xs text-muted">{fmt(p.threshold, { n: threshold })}</span>
        </div>
        {meters.map((m) => {
          const tone = m.limit === -1 ? "bg-accent" : m.percent >= 100 ? "bg-danger" : m.percent >= threshold ? "bg-warning" : "bg-accent";
          return (
            <div key={m.key} data-meter={m.key} data-percent={m.percent}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{p.limits[m.key]}</span>
                <bdi className="font-semibold tabular-nums" dir="ltr">
                  {m.used.toLocaleString("fr-FR")} / {limitValue(m.limit, t)}
                </bdi>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-panel-2">
                <div className={`h-full rounded-full ${tone}`} style={{ width: `${m.limit === -1 ? 4 : Math.min(100, m.percent)}%` }} />
              </div>
            </div>
          );
        })}
        <p className="flex items-start gap-1.5 text-xs text-muted">
          <Lock size={13} className="mt-0.5 shrink-0" /> {p.lockedNote}
        </p>
      </div>
  );
}

export function RequestHistory({ data, lang, t }: { data: Overview; lang: string; t: Dictionary }) {
  const p = t.plans;
  return (
    <Card className="overflow-x-auto p-0" data-testid="plan-requests">
      <div className="p-4 pb-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <ReceiptText size={18} className="text-accent" /> {p.billing.invoices}
        </h2>
        <p className="mt-0.5 text-sm text-muted">{p.billing.invoicesHint}</p>
      </div>
      {!data.requests.length && <p className="px-4 pb-4 text-sm text-muted">{p.billing.noInvoices}</p>}
      <table className="w-full text-sm">
        <tbody>
          {data.requests.map((r) => (
            <tr key={r.id} className="border-t border-line" data-request={r.status}>
              <td className="p-3 font-medium">{r.planName}</td>
              <td className="p-3 text-muted">{periodLabel(r.months, r.orderPack, t)}</td>
              <td className="p-3 whitespace-nowrap">{formatPrice(r.amount, t.common.currency)}</td>
              <td className="p-3 text-muted">{p.request.methods[r.method]}</td>
              <td className="p-3">
                <Badge tone={r.status === "approved" ? "accent" : r.status === "pending" ? "warning" : r.status === "rejected" ? "danger" : "neutral"}>{p.statuses[r.status]}</Badge>
                {r.adminNote && <p className="mt-1 text-xs text-muted">{r.adminNote}</p>}
              </td>
              <td className="p-3 text-xs whitespace-nowrap text-muted">
                <bdi>{formatDate(r.createdAt, lang)}</bdi>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// The banner at the top of every dashboard page (owners and managers)
export function PlanNoticeBanner({ notice, plansHref, t }: { notice: PlanNotice; plansHref: string | null; t: Dictionary }) {
  const locked = notice.kind === "locked";
  return (
    <div className={`mb-6 flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm ${locked ? "border-danger/40 bg-danger/10" : "border-warning/30 bg-warning/10"}`} data-testid="plan-notice" data-kind={notice.kind}>
      {locked ? <Lock size={18} className="shrink-0 text-danger" /> : <CircleAlert size={18} className="shrink-0 text-warning" />}
      <p className="me-auto">
        {notice.kind === "locked"
          ? fmt(t.orders.locked.banner, { n: notice.n })
          : notice.kind === "credits"
            ? fmt(t.plans.notice.credits, { n: notice.n })
            : fmt(t.plans.notice.usage, { percent: notice.percent, limit: t.plans.limits[notice.key] })}
      </p>
      {plansHref && (
        <a href={plansHref} className="font-semibold text-accent hover:underline">
          {t.plans.notice.see}
        </a>
      )}
    </div>
  );
}
