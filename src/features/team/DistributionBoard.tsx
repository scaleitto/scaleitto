import Link from "next/link";
import { Shuffle } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { sectionHref } from "@/lib/permissions";
import { fmt, formatDate } from "@/lib/format";
import { Badge, Card } from "@/ui";
import type { distributionBoard } from "./distribution";
import { SpreadNowButton } from "./SpreadNowButton";

type Board = Awaited<ReturnType<typeof distributionBoard>>;
type Mode = "manual" | "balanced" | "on_shift";

// Call centers → team: how orders are handed out, in plain words, and each agent's load right now.
export function DistributionBoard({ lang, mode, board, t }: { lang: string; mode: Mode; board: Board; t: Dictionary }) {
  const d = t.team.distribution;
  return (
    <Card className="mb-6 space-y-4 p-0" data-testid="distribution">
      <div className="space-y-2 p-5 pb-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="me-auto font-semibold">{d.title}</h2>
          <span className="text-sm text-muted">{d.mode}</span>
          <Badge tone="accent">
            <span data-mode={mode}>{t.team.assignModes[mode].title}</span>
          </Badge>
          <Link href={`${sectionHref(lang, "callCenters")}/settings`} className="text-sm font-semibold text-accent hover:underline">
            {d.change}
          </Link>
        </div>
        <p className="text-sm text-muted">{d.explain[mode]}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-y border-line bg-panel-2/50 px-5 py-3 text-sm" data-testid="unassigned" data-n={board.unassigned}>
        <span className="me-auto font-medium">{board.unassigned ? fmt(d.unassigned, { n: board.unassigned }) : d.noneUnassigned}</span>
        {/* Stays after sharing (disabled) so its result message remains visible */}
        {board.agents.length > 0 && (
          <SpreadNowButton lang={lang} disabled={board.unassigned === 0} t={{ team: t.team, orders: t.orders, errors: t.errors }}>
            <Shuffle size={16} /> {d.spreadNow}
          </SpreadNowButton>
        )}
      </div>

      {board.agents.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted">{d.noAgents}</p>
      ) : (
        <div className="overflow-x-auto pb-2">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                <th className="px-5 py-2 text-start font-medium">{d.agent}</th>
                <th className="p-2 text-start font-medium">{d.shift}</th>
                <th className="p-2 text-start font-medium">{d.open}</th>
                <th className="p-2 text-start font-medium">{d.today}</th>
                <th className="hidden p-2 text-start font-medium sm:table-cell">{d.last}</th>
              </tr>
            </thead>
            <tbody>
              {board.agents.map((a) => (
                <tr key={a.userId} className="border-b border-line last:border-0" data-agent={a.name}>
                  <td className="px-5 py-2.5 font-semibold">{a.name}</td>
                  <td className="p-2">
                    <Badge tone={a.onShift ? "accent" : "neutral"}>{a.onShift ? d.onShift : d.offShift}</Badge>
                  </td>
                  <td className="p-2 font-semibold" data-open={a.open}>
                    {a.open}
                  </td>
                  <td className="p-2" data-today={a.today}>
                    {a.today}
                  </td>
                  <td className="hidden p-2 text-xs text-muted sm:table-cell">{a.lastAssignedAt ? formatDate(a.lastAssignedAt, lang) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
