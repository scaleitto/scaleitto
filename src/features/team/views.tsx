import Link from "next/link";
import { CircleHelp } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { sectionHref } from "@/lib/permissions";
import { fmt, formatDate, formatDuration, formatTime } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader, inputClass, buttonClass } from "@/ui";
import { isOrderStatus } from "@/features/orders/statuses";
import { periods, type MemberPerformance, type Period } from "./metrics";
import type { teamActivityLog } from "./metrics";

export type CallCenterTab = "team" | "performance" | "activity" | "settings";

export function CallCenterHeader({ lang, t, current }: { lang: string; t: Dictionary; current: CallCenterTab }) {
  const base = sectionHref(lang, "callCenters");
  const tabs: { key: CallCenterTab; href: string }[] = [
    { key: "team", href: base },
    { key: "performance", href: `${base}/performance` },
    { key: "activity", href: `${base}/activity` },
    { key: "settings", href: `${base}/settings` },
  ];
  return (
    <>
      <PageHeader title={t.sections.callCenters.title} description={t.sections.callCenters.description} />
      <nav className="mb-5 flex gap-6 overflow-x-auto border-b border-line text-sm">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={current === tab.key ? "page" : undefined}
            className={`-mb-px shrink-0 border-b-2 pb-2.5 font-semibold ${current === tab.key ? "border-accent text-accent" : "border-transparent text-muted hover:text-fg"}`}
          >
            {t.team.tabs[tab.key]}
          </Link>
        ))}
      </nav>
    </>
  );
}

export function PeriodTabs({ href, current, t }: { href: (p: Period) => string; current: Period; t: Dictionary }) {
  return (
    <nav className="mb-4 flex gap-1 rounded-lg bg-panel p-1 text-sm sm:w-fit" aria-label="period">
      {periods.map((p) => (
        <Link key={p} href={href(p)} aria-current={current === p ? "page" : undefined} className={`flex-1 rounded-md px-3 py-1.5 text-center font-medium whitespace-nowrap ${current === p ? "bg-panel-2 text-fg" : "text-muted hover:text-fg"}`}>
          {t.team.periods[p]}
        </Link>
      ))}
    </nav>
  );
}

const rate = (v: number | null) => (v == null ? "—" : `${v}%`);
const rateTone = (v: number | null, good = 70, ok = 50) => (v == null ? "text-muted" : v >= good ? "text-accent" : v >= ok ? "text-amber-300" : "text-danger");

// The numbers of one member, as labelled values (used for the agent's own page and per-member cards).
export function metricItems(p: MemberPerformance, t: Dictionary) {
  const m = t.team.metrics;
  const a = p.adherence;
  return [
    { key: "assigned", label: m.assigned, value: String(p.assigned) },
    { key: "open", label: m.open, value: String(p.open), tone: p.open > 20 ? "text-amber-300" : undefined },
    { key: "confirmed", label: m.confirmed, value: String(p.confirmed) },
    { key: "cancelled", label: m.cancelled, value: String(p.cancelled) },
    { key: "noAnswer", label: m.noAnswer, value: String(p.noAnswer) },
    { key: "confirmRate", label: m.confirmRate, value: rate(p.confirmRate), tone: rateTone(p.confirmRate), help: t.team.help.confirmRate },
    { key: "deliveryRate", label: m.deliveryRate, value: rate(p.deliveryRate), tone: rateTone(p.deliveryRate, 75, 60), help: t.team.help.deliveryRate },
    { key: "response", label: m.response, value: p.avgResponseMinutes == null ? "—" : formatDuration(p.avgResponseMinutes, t.team), help: t.team.help.response },
    { key: "actions", label: m.actions, value: String(p.actions) },
    { key: "activeTime", label: m.activeTime, value: formatDuration(p.activeMinutes, t.team), help: t.team.help.activeTime },
    { key: "attendance", label: m.attendance, value: a ? `${rate(a.attendance)} (${a.present}/${a.workdays})` : "—", tone: rateTone(a?.attendance ?? null, 90, 75), help: a ? t.team.help.attendance : t.team.noScheduleHint },
    { key: "punctuality", label: m.punctuality, value: rate(a?.punctuality ?? null), tone: rateTone(a?.punctuality ?? null, 85, 65), help: t.team.help.punctuality },
    { key: "lateness", label: m.lateness, value: a && a.avgLateMinutes ? formatDuration(a.avgLateMinutes, t.team) : "—" },
    { key: "coverage", label: m.coverage, value: rate(a?.coverage ?? null), tone: rateTone(a?.coverage ?? null, 80, 60), help: t.team.help.coverage },
  ];
}

function MetricGrid({ p, t }: { p: MemberPerformance; t: Dictionary }) {
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
      {metricItems(p, t).map((item) => (
        <div key={item.key} className="rounded-lg bg-panel-2/60 p-3" data-metric={item.key}>
          <dt className="flex items-center gap-1 text-xs text-muted">
            {item.label}
            {item.help && (
              <span title={item.help} className="cursor-help">
                <CircleHelp size={12} />
              </span>
            )}
          </dt>
          <dd className={`mt-1 text-lg font-bold ${item.tone ?? ""}`}>
            <bdi>{item.value}</bdi>
          </dd>
        </div>
      ))}
    </dl>
  );
}

// Side-by-side comparison of the team, best confirmation rate first.
export function PerformanceTable({ rows, t }: { rows: MemberPerformance[]; t: Dictionary }) {
  const m = t.team.metrics;
  const sorted = [...rows].sort((a, b) => (b.confirmRate ?? -1) - (a.confirmRate ?? -1) || b.confirmed - a.confirmed);
  const cols: { key: string; label: string; value: (p: MemberPerformance) => string; tone?: (p: MemberPerformance) => string }[] = [
    { key: "assigned", label: m.assigned, value: (p) => String(p.assigned) },
    { key: "confirmed", label: m.confirmed, value: (p) => String(p.confirmed) },
    { key: "confirmRate", label: m.confirmRate, value: (p) => rate(p.confirmRate), tone: (p) => rateTone(p.confirmRate) },
    { key: "deliveryRate", label: m.deliveryRate, value: (p) => rate(p.deliveryRate), tone: (p) => rateTone(p.deliveryRate, 75, 60) },
    { key: "response", label: m.response, value: (p) => (p.avgResponseMinutes == null ? "—" : formatDuration(p.avgResponseMinutes, t.team)) },
    { key: "open", label: m.open, value: (p) => String(p.open) },
    { key: "activeTime", label: m.activeTime, value: (p) => formatDuration(p.activeMinutes, t.team) },
    { key: "attendance", label: m.attendance, value: (p) => rate(p.adherence?.attendance ?? null), tone: (p) => rateTone(p.adherence?.attendance ?? null, 90, 75) },
    { key: "punctuality", label: m.punctuality, value: (p) => rate(p.adherence?.punctuality ?? null), tone: (p) => rateTone(p.adherence?.punctuality ?? null, 85, 65) },
  ];
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm" data-testid="performance-table">
        <thead className="text-xs text-muted">
          <tr className="border-b border-line">
            <th className="p-3 text-start font-medium">{t.team.name}</th>
            {cols.map((c) => (
              <th key={c.key} className="p-3 text-start font-medium whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => (
            <tr key={p.userId} className="border-b border-line last:border-0">
              <td className="p-3 font-semibold whitespace-nowrap">
                <span className="me-2 text-xs text-muted">{i + 1}</span>
                {p.name}
              </td>
              {cols.map((c) => (
                <td key={c.key} className={`p-3 font-semibold whitespace-nowrap ${c.tone?.(p) ?? ""}`}>
                  <bdi>{c.value(p)}</bdi>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function PerformanceCards({ lang, rows, t }: { lang: string; rows: MemberPerformance[]; t: Dictionary }) {
  if (!rows.length) return <EmptyState title={t.team.noMembers} />;
  return (
    <div className="space-y-4">
      {rows.map((p) => (
        <Card key={p.userId} className="space-y-3" data-performance={p.name}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 font-semibold">
              <span className={`size-2.5 rounded-full ${p.online ? "bg-accent" : "bg-line"}`} />
              {p.name}
              <Badge tone={p.role === "agent" ? "info" : "neutral"}>{t.profile.roles[p.role]}</Badge>
              {!p.active && <Badge tone="danger">{t.team.inactive}</Badge>}
            </p>
            <p className="text-xs text-muted">
              {p.online ? t.team.online : p.todayStart ? fmt(t.team.startedAt, { time: formatTime(p.todayStart, lang) }) : t.team.notToday}
              {p.lastSeen && !p.online && ` · ${fmt(t.team.lastSeen, { time: formatDate(p.lastSeen, lang) })}`}
            </p>
          </div>
          <MetricGrid p={p} t={t} />
        </Card>
      ))}
    </div>
  );
}

type LogRow = Awaited<ReturnType<typeof teamActivityLog>>[number];

export function ActivityLog({ lang, rows, members, selected, t }: { lang: string; rows: LogRow[]; members: { userId: string; name: string }[]; selected?: string; t: Dictionary }) {
  const o = t.orders;
  const base = `${sectionHref(lang, "callCenters")}/activity`;
  const ordersBase = sectionHref(lang, "orders");
  const label = (r: LogRow) => {
    const st = (s: string | null) => (s && isOrderStatus(s) ? o.statuses[s] : (s ?? ""));
    if (r.type === "status") return fmt(o.events.status, { from: st(r.fromStatus), to: st(r.toStatus) });
    if (r.type === "assign") return r.note ? fmt(o.events.assign, { name: r.note }) : o.events.unassign;
    return o.events[r.type];
  };
  return (
    <Card className="space-y-4">
      <form action={base} className="flex flex-wrap items-center gap-2">
        <h2 className="me-auto font-semibold">{t.team.activityTitle}</h2>
        <select name="member" defaultValue={selected ?? ""} aria-label={t.team.allMembers} className={inputClass.replace("w-full", "w-auto")}>
          <option value="">{t.team.allMembers}</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </select>
        <button className={buttonClass("secondary")}>{o.filter}</button>
      </form>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">{t.team.activityEmpty}</p>
      ) : (
        <ol className="divide-y divide-line text-sm" data-testid="activity-log">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
              <span>
                <span className="font-semibold">{r.userName}</span> · {label(r)}
                {r.type === "note" && r.note && <span className="text-muted"> — {r.note}</span>}{" "}
                <Link href={`${ordersBase}/${r.orderId}`} className="text-accent hover:underline">
                  {fmt(t.team.order, { number: r.orderNumber })}
                </Link>
              </span>
              <bdi className="text-xs text-muted">{formatDate(r.createdAt, lang)}</bdi>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function MyPerformance({ lang, p, period, t }: { lang: string; p: MemberPerformance; period: Period; t: Dictionary }) {
  const base = sectionHref(lang, "callCenters");
  return (
    <>
      <PageHeader title={t.team.myPerformance} description={t.sections.callCenters.description} />
      <PeriodTabs href={(x) => (x === "today" ? base : `${base}?period=${x}`)} current={period} t={t} />
      <PerformanceCards lang={lang} rows={[p]} t={t} />
    </>
  );
}

export const parsePeriod = (v: unknown): Period => (periods.includes(v as Period) ? (v as Period) : "today");
