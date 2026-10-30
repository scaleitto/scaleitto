import { Target } from "lucide-react";
import type { PageStrategy } from "@/server/db/schema";
import type { Dictionary } from "@/i18n/dictionaries/ar";

// What the AI chose for this page: the audience and the marketing angles, with the reason for each
export function StrategyCard({ strategy, t, names }: { strategy: PageStrategy | null; t: Dictionary["landingPages"]["strategy"]; names: Record<string, string> }) {
  if (!strategy) return null;
  return (
    <details className="group mb-4 rounded-xl border border-line bg-panel p-4 shadow-sm" data-testid="page-strategy">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-bold">
        <Target size={17} className="text-accent" />
        {t.title}
        <span className="text-xs font-normal text-muted">
          · {strategy.custom ? t.custom : t.method} · {strategy.mode === "manual" ? t.manual : t.auto}
        </span>
      </summary>
      <div className="mt-3 space-y-3 text-sm">
        {strategy.audience && (
          <p>
            <span className="font-semibold">{t.audience}: </span>
            {strategy.audience}
          </p>
        )}
        <ul className="grid gap-2 sm:grid-cols-2">
          {strategy.angles.map((a) => (
            <li key={a.key ?? a.name} className="rounded-lg border border-line bg-panel-2 p-3" data-angle={a.key ?? ""} data-required={a.required === false ? "false" : "true"}>
              <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                {a.key && names[a.key] ? names[a.key] : a.name}
                {a.key && a.name && names[a.key] && a.name !== names[a.key] && <span className="font-normal text-muted">· {a.name}</span>}
                {a.key && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${a.required === false ? "bg-panel text-muted" : "bg-accent/10 text-accent"}`}>
                    {a.required === false ? t.optional : t.required}
                  </span>
                )}
              </p>
              {a.why && <p className="mt-0.5 text-xs text-muted">{a.why}</p>}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
