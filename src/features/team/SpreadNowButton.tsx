"use client";

import { useState, useTransition, type ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt } from "@/lib/format";
import { Alert, Button } from "@/ui";
import { spreadOrdersAction } from "@/features/orders/actions";

// Shares every unassigned open order between the active agents, then says who got how many.
export function SpreadNowButton({ lang, disabled = false, t, children }: { lang: string; disabled?: boolean; t: Pick<Dictionary, "team" | "orders" | "errors">; children: ReactNode }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const e = t.errors as Record<string, string>;
  return (
    <>
      <Button
        disabled={pending || disabled}
        onClick={() =>
          startTransition(async () => {
            const r = await spreadOrdersAction(lang, null).catch(() => ({ ok: false, error: "unexpected", spread: undefined }));
            setResult(
              r.ok
                ? { ok: true, text: `${fmt(t.orders.bulk.spreadDone, { n: r.spread?.assigned ?? 0 })} ${(r.spread?.byAgent ?? []).map((a) => `${a.name} (${a.n})`).join(" · ")}` }
                : { ok: false, text: e[r.error ?? "unexpected"] ?? e.unexpected },
            );
          })
        }
      >
        {children}
      </Button>
      {result && (
        <div className="w-full" data-testid="spread-result">
          <Alert variant={result.ok ? "success" : "error"}>{result.text}</Alert>
        </div>
      )}
    </>
  );
}
