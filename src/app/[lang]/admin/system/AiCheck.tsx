"use client";

import { useState, useTransition } from "react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { AiCheckResult } from "./actions";

export function AiCheck({ t, check, chain }: { t: Dictionary; check: () => Promise<AiCheckResult>; chain: string[] }) {
  const [result, setResult] = useState<AiCheckResult | null>(null);
  const [pending, startTransition] = useTransition();
  const a = t.admin;

  return (
    <div className="space-y-3">
      <button className="btn-outline" disabled={pending} onClick={() => startTransition(async () => setResult(await check()))}>
        {pending ? t.common.loading : a.aiTest}
      </button>
      {result?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {a.aiError}: <span className="font-mono" dir="ltr">{result.error}</span>
        </p>
      )}
      {result?.models && (
        <>
          <ul className="space-y-1 text-sm">
            {chain.map((m) => (
              <li key={m} className="flex items-center gap-2">
                <span dir="ltr" className="font-mono">{m}</span>
                {result.models!.includes(m) ? (
                  <span className="badge bg-green-100 text-green-700">✓ {a.aiAvailable}</span>
                ) : (
                  <span className="badge bg-red-100 text-red-700">✗ {a.aiNotAvailable}</span>
                )}
              </li>
            ))}
          </ul>
          <div>
            <div className="label">{a.availableModels}</div>
            <div className="flex flex-wrap gap-1" dir="ltr">
              {result.models
                .filter((m) => m.startsWith("gpt-"))
                .map((m) => (
                  <span key={m} className="badge bg-slate-100 font-mono text-slate-700">{m}</span>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
