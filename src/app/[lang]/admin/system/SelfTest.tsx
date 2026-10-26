"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { AiCheckResult, CheckResult } from "./actions";

type Row = { label: string; state: "idle" | "running" | "ok" | "fail"; detail?: string };

export function SelfTest({
  t,
  chain,
  checkUploads,
  checkAi,
  startBackground,
  pollBackground,
}: {
  t: Dictionary;
  chain: string[];
  checkUploads: () => Promise<CheckResult>;
  checkAi: () => Promise<AiCheckResult>;
  startBackground: () => Promise<CheckResult & { responseId?: string }>;
  pollBackground: (responseId: string) => Promise<CheckResult & { pending?: boolean }>;
}) {
  const a = t.admin;
  const initial: Row[] = [
    { label: a.checkUploads, state: "idle" },
    { label: a.checkOpenAI, state: "idle" },
    { label: a.checkBackground, state: "idle" },
  ];
  const [rows, setRows] = useState<Row[]>(initial);
  const [running, setRunning] = useState(false);
  const set = (i: number, row: Partial<Row>) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...row } : r)));

  async function run() {
    setRunning(true);
    setRows(initial);
    try {
      set(0, { state: "running" });
      const up = await checkUploads();
      set(0, { state: up.ok ? "ok" : "fail", detail: up.detail });

      set(1, { state: "running" });
      const ai = await checkAi();
      const available = chain.filter((m) => ai.models?.includes(m));
      set(1, ai.error ? { state: "fail", detail: ai.error } : { state: available.length ? "ok" : "fail", detail: available.length ? available.join(", ") : `${a.aiNotAvailable}: ${chain.join(", ")}` });

      set(2, { state: "running", detail: a.waiting });
      const started = await startBackground();
      if (!started.ok || !started.responseId) {
        set(2, { state: "fail", detail: started.detail });
        return;
      }
      const t0 = Date.now();
      while (Date.now() - t0 < 180_000) {
        await new Promise((r) => setTimeout(r, 2000));
        const res = await pollBackground(started.responseId);
        if (res.pending) {
          set(2, { detail: `${a.waiting} ${Math.round((Date.now() - t0) / 1000)}s` });
          continue;
        }
        set(2, { state: res.ok ? "ok" : "fail", detail: `${res.detail} (${Math.round((Date.now() - t0) / 1000)}s)` });
        return;
      }
      set(2, { state: "fail", detail: "No answer after 3 minutes" });
    } catch (err) {
      setRows((prev) => prev.map((r) => (r.state === "running" ? { ...r, state: "fail", detail: err instanceof Error ? err.message : String(err) } : r)));
    } finally {
      setRunning(false);
    }
  }

  const icon = { idle: "○", running: "…", ok: "✓", fail: "✗" };
  const color = { idle: "text-slate-400", running: "text-brand", ok: "text-green-600", fail: "text-red-600" };

  return (
    <div className="space-y-3">
      <ul className="space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.label} className="flex items-start gap-2">
            <span className={`w-4 font-bold ${color[r.state]}`}>{icon[r.state]}</span>
            <span>
              {r.label}
              {r.detail && <span className="block break-all font-mono text-xs text-slate-500" dir="ltr">{r.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
      <button className="btn" disabled={running} onClick={run}>
        {running ? t.common.loading : a.selfTestRun}
      </button>
    </div>
  );
}
