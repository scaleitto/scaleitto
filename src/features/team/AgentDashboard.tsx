import { CheckCircle2, ClipboardList, Headset, Target } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Locale } from "@/i18n/config";
import { Badge, Card, PageHeader } from "@/ui";
import type { AgentOverview } from "./agent-overview";

// The agent portal's home (Zimam's "Agent overview"): today's figures, the 7-day trend, the confirmation rate and
// the totals — all about the signed-in agent only
export function AgentDashboard({ lang, name, data, t }: { lang: Locale; name: string; data: AgentOverview; t: Dictionary }) {
  const p = t.portal;
  const weekday = new Intl.DateTimeFormat(lang === "ar" ? "ar-DZ" : lang, { weekday: "short", timeZone: "UTC" });
  const max = Math.max(1, ...data.trend.map((d) => Math.max(d.assigned, d.confirmed)));
  const rate = data.rate ?? 0;
  const R = 42;
  const C = 2 * Math.PI * R;
  return (
    <div className="space-y-5" data-testid="agent-dashboard">
      <PageHeader title={p.dashboardTitle} description={name} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Stat icon={<ClipboardList size={20} />} label={p.todayAssigned} value={data.today.assigned} badge={<Badge tone="accent">{p.active}</Badge>} testid="today-assigned" />
        <Stat icon={<CheckCircle2 size={20} />} label={p.todayConfirmed} value={data.today.confirmed} badge={<Badge tone="info">{p.dailyTarget}</Badge>} testid="today-confirmed" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-bold">{p.trend}</h2>
              <p className="text-xs text-muted">{p.trendHint}</p>
            </div>
            <div className="flex gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-accent-bright/40" /> {p.assigned}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-accent" /> {p.confirmed}
              </span>
            </div>
          </div>
          <div className="flex h-48 items-end gap-2" dir="ltr" data-testid="trend">
            {data.trend.map((d) => (
              <div key={d.day} className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1.5" data-day={d.day} data-assigned={d.assigned} data-confirmed={d.confirmed}>
                <div className="flex h-full w-full items-end justify-center gap-1">
                  <span className="w-1/3 max-w-5 rounded-t bg-accent-bright/40" style={{ height: `${(d.assigned / max) * 100}%`, minHeight: d.assigned ? 4 : 0 }} />
                  <span className="w-1/3 max-w-5 rounded-t bg-accent" style={{ height: `${(d.confirmed / max) * 100}%`, minHeight: d.confirmed ? 4 : 0 }} />
                </div>
                <span className="text-[11px] font-medium text-muted uppercase">{weekday.format(new Date(`${d.day}T12:00:00Z`))}</span>
                <span className="pointer-events-none absolute bottom-full mb-1 hidden rounded-md border border-line bg-panel px-2 py-1 text-[11px] whitespace-nowrap shadow-lift group-hover:block">
                  {p.assigned}: {d.assigned} · {p.confirmed}: {d.confirmed}
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="flex flex-col items-center gap-3 text-center">
          <div className="self-stretch text-start">
            <h2 className="font-bold">{p.rate}</h2>
            <p className="text-xs text-muted">{p.rateHint}</p>
          </div>
          <div className="relative size-40" data-testid="rate">
            <svg viewBox="0 0 100 100" className="size-full -rotate-90">
              <circle cx="50" cy="50" r={R} fill="none" strokeWidth="10" className="stroke-panel-2" />
              {rate > 0 && <circle cx="50" cy="50" r={R} fill="none" strokeWidth="10" strokeLinecap="round" className="stroke-accent" strokeDasharray={`${(rate / 100) * C} ${C}`} />}
            </svg>
            <span className="absolute inset-0 grid place-items-center text-3xl font-bold tabular-nums">{data.rate == null ? "—" : `${data.rate}%`}</span>
          </div>
          <p className="text-sm text-muted tabular-nums">
            {p.confirmed} {data.week.confirmed} / {p.assigned} {data.week.assigned}
          </p>
        </Card>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Stat icon={<Target size={20} />} label={p.totalConfirmed} value={data.totalConfirmed} testid="total-confirmed" />
        <Stat icon={<Headset size={20} />} label={p.totalAssigned} value={data.totalAssigned} testid="total-assigned" />
      </div>
    </div>
  );
}

function Stat({ icon, label, value, badge, testid }: { icon: React.ReactNode; label: string; value: number; badge?: React.ReactNode; testid: string }) {
  return (
    <Card className="flex items-center gap-4" data-testid={testid}>
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
        <p className="text-2xl font-bold tabular-nums" data-value>
          {value}
        </p>
      </div>
      {badge}
    </Card>
  );
}
