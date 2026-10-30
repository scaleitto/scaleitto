"use client";

import { useState, useTransition } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { Button, Card } from "@/ui";
import { fmt } from "@/lib/format";
import { markOrderTrusted } from "./actions";

type OrderText = Pick<Dictionary, "orders" | "errors" | "common">;
// The fake-order check of this order: its risk, why, and "this order is fine"
export function RiskCard({ lang, orderId, risk, reasons, threshold, held, t }: { lang: string; orderId: string; risk: number; reasons: string[]; threshold: number; held: boolean; t: OrderText }) {
  const r = t.orders.risk;
  const labels = r.reasons as Record<string, string>;
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const suspicious = risk >= threshold;
  return (
    <Card className={`space-y-3 ${suspicious ? "border-warning/40" : ""}`} data-testid="risk-card" data-risk={risk}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShieldAlert size={17} className={suspicious ? "text-warning" : "text-muted"} /> {r.title}
        </h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${suspicious ? "bg-warning/10 text-warning" : "bg-panel-2 text-muted"}`}>{fmt(r.score, { n: risk })}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-panel-2">
        <div className={`h-full rounded-full ${suspicious ? "bg-warning" : "bg-accent-bright"}`} style={{ width: `${Math.max(3, risk)}%` }} />
      </div>
      {reasons.length ? (
        <ul className="space-y-1 text-sm">
          {reasons.map((k) => (
            <li key={k} className="flex items-start gap-2" data-reason={k}>
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" /> {labels[k] ?? k}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{r.low}</p>
      )}
      {held && suspicious && <p className="text-xs font-semibold text-warning">{r.held}</p>}
      {risk > 0 &&
        (done ? (
          <p className="text-sm font-semibold text-[#047857]">{r.trustedDone}</p>
        ) : (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await markOrderTrusted(lang, orderId);
                setDone(Boolean(res.ok));
              })
            }
            data-testid="mark-trusted"
          >
            <ShieldCheck size={15} /> {r.markTrusted}
          </Button>
        ))}
    </Card>
  );
}

