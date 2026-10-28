"use client";

import { useEffect, useState, useTransition } from "react";
import { Shuffle, UserCheck, UserX } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt } from "@/lib/format";
import { Alert, Button } from "@/ui";
import { assignOrders, spreadOrdersAction } from "./actions";

type Text = Pick<Dictionary, "orders" | "errors">;

// Row checkboxes are plain inputs rendered by the server table; the bar and "select all" find them by this attribute.
const ROW = "input[data-bulk-order]";
const rows = () => Array.from(document.querySelectorAll<HTMLInputElement>(ROW));
const selectedIds = () => rows().filter((r) => r.checked).map((r) => r.value);

export function SelectAllOrders({ label }: { label: string }) {
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    const sync = () => setChecked(rows().length > 0 && rows().every((r) => r.checked));
    document.addEventListener("change", sync);
    return () => document.removeEventListener("change", sync);
  }, []);
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={(e) => {
        for (const r of rows()) r.checked = e.target.checked;
        document.dispatchEvent(new Event("change"));
      }}
      className="relative z-10 size-4 accent-[var(--color-accent)]"
    />
  );
}

// Above the orders table (owners and managers): give the selected orders to a member, take them back,
// or share them between the active agents — and say what happened.
export function BulkAssignBar({ lang, members, t }: { lang: string; members: { userId: string; name: string; role: string }[]; t: Text }) {
  const o = t.orders.bulk;
  const e = t.errors as Record<string, string>;
  const [count, setCount] = useState(0);
  const [target, setTarget] = useState(members.find((m) => m.role === "agent")?.userId ?? members[0]?.userId ?? "");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const sync = () => setCount(selectedIds().length);
    document.addEventListener("change", sync);
    return () => document.removeEventListener("change", sync);
  }, []);

  const done = (text: string) => {
    for (const r of rows()) r.checked = false;
    document.dispatchEvent(new Event("change"));
    setResult({ ok: true, text });
  };
  const run = (action: () => Promise<{ ok?: boolean; error?: string }>, success: (r: never) => string) =>
    startTransition(async () => {
      const r = await action().catch(() => ({ ok: false, error: "unexpected" }));
      if (r.ok) done(success(r as never));
      else setResult({ ok: false, text: e[r.error ?? "unexpected"] ?? e.unexpected });
    });

  const ids = () => selectedIds();
  return (
    <div className="space-y-2 border-b border-line bg-panel-2/50 p-3" data-testid="bulk-assign">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="me-auto font-medium" data-testid="bulk-count">
          {count ? fmt(o.selected, { n: count }) : o.hint}
        </span>
        <select value={target} onChange={(ev) => setTarget(ev.target.value)} aria-label={o.assignTo} className="rounded-lg border border-line bg-panel px-2 py-1.5 text-sm" disabled={!count || pending}>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </select>
        <Button variant="secondary" disabled={!count || !target || pending} onClick={() => run(() => assignOrders(lang, ids(), target), (r: { assigned?: number }) => fmt(o.assigned, { n: r.assigned ?? 0 }))}>
          <UserCheck size={16} /> {o.assign}
        </Button>
        <Button variant="secondary" disabled={!count || pending} onClick={() => run(() => assignOrders(lang, ids(), null), (r: { assigned?: number }) => fmt(o.assigned, { n: r.assigned ?? 0 }))}>
          <UserX size={16} /> {o.unassign}
        </Button>
        <Button
          disabled={!count || pending}
          onClick={() =>
            run(
              () => spreadOrdersAction(lang, ids()),
              (r: { spread?: { assigned: number; byAgent: { name: string; n: number }[] } }) =>
                `${fmt(o.spreadDone, { n: r.spread?.assigned ?? 0 })} ${(r.spread?.byAgent ?? []).map((a) => `${a.name} (${a.n})`).join(" · ")}`,
            )
          }
        >
          <Shuffle size={16} /> {o.spread}
        </Button>
      </div>
      {result && (
        <div data-testid="bulk-result">
          <Alert variant={result.ok ? "success" : "error"}>{result.text}</Alert>
        </div>
      )}
    </div>
  );
}
