"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { formatDate } from "@/lib/format";
import { Button, Card } from "@/ui";

type Stats = { signups: number; paying: number; vouchers: { available: number; pending: number; used: number }; referrals: { name: string; at: string; status: string }[] };

// Store settings → Refer a seller (Zimam): the link, signups, paying sellers, vouchers and the referred stores
export function ReferPanel({ lang, link, stats, t }: { lang: string; link: string; stats: Stats; t: Pick<Dictionary, "settings"> }) {
  const r = t.settings.refer;
  const [copied, setCopied] = useState(false);
  return (
    <Card className="space-y-5" data-testid="settings-refer">
      <div>
        <h2 className="text-lg font-semibold">{r.title}</h2>
        <p className="mt-1 text-sm text-muted">{r.hint}</p>
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-fg-2">{r.link}</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-lg bg-panel-2 px-3 py-2 font-mono text-sm" dir="ltr" data-testid="refer-link">
            {link}
          </code>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void navigator.clipboard?.writeText(link);
              setCopied(true);
            }}
          >
            <Copy size={14} /> {copied ? r.copied : r.copy}
          </Button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-2xl font-bold tabular-nums" data-testid="refer-signups">
            {stats.signups}
          </p>
          <p className="text-xs text-muted">{r.signups}</p>
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums" data-testid="refer-paying">
            {stats.paying}
          </p>
          <p className="text-xs text-muted">{r.paying}</p>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-fg-2">{r.vouchers}</p>
        <p className="mt-1 text-sm" data-testid="refer-vouchers">
          {r.available}: {stats.vouchers.available} &nbsp; {r.pending}: {stats.vouchers.pending} &nbsp; {r.used}: {stats.vouchers.used}
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold text-fg-2">{r.referrals}</p>
        {stats.referrals.length === 0 ? (
          <p className="mt-1 text-sm text-muted">{r.none}</p>
        ) : (
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line text-sm" data-testid="refer-list">
            {stats.referrals.map((x, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="font-semibold">{x.name}</span>
                <span className="text-xs text-muted">
                  {formatDate(new Date(x.at), lang)} · {r.status[x.status as keyof typeof r.status] ?? x.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-sm text-fg-2">{r.rule}</p>
    </Card>
  );
}
