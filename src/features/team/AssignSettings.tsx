"use client";

import { useState, useTransition } from "react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { Alert, Card } from "@/ui";
import { setAssignMode } from "./actions";

type Mode = "manual" | "balanced" | "on_shift";

export function AssignSettings({ lang, mode, t }: { lang: string; mode: Mode; t: Pick<Dictionary, "team" | "errors" | "common"> }) {
  const [current, setCurrent] = useState(mode);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const choose = (next: Mode) =>
    startTransition(async () => {
      const r = await setAssignMode(lang, next);
      const e = t.errors as Record<string, string>;
      if (r.ok) {
        setCurrent(next);
        setSaved(true);
        setError(null);
      } else setError(e[r.error ?? "unexpected"] ?? e.unexpected);
    });
  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-semibold">{t.team.assignTitle}</h2>
        <p className="mt-1 text-sm text-muted">{t.team.assignHint}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3" role="radiogroup" aria-label={t.team.assignTitle}>
        {(["manual", "balanced", "on_shift"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={current === m}
            disabled={pending}
            onClick={() => choose(m)}
            className={`rounded-xl border p-4 text-start transition ${current === m ? "border-accent bg-accent/10" : "border-line hover:bg-panel-2"}`}
          >
            <span className="block font-semibold">{t.team.assignModes[m].title}</span>
            <span className="mt-1 block text-xs text-muted">{t.team.assignModes[m].description}</span>
          </button>
        ))}
      </div>
      {saved && <Alert variant="success">{t.common.saved}</Alert>}
      {error && <Alert>{error}</Alert>}
    </Card>
  );
}
