"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckSquare, Download, FlipHorizontal2, RefreshCw, Send, SlidersHorizontal, Square, X } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { ActionState } from "@/lib/action";
import { defaultParcelOptions, type ParcelDefaults, type ParcelOptions } from "@/lib/enums";
import { fmt } from "@/lib/format";
import { Button, Select } from "@/ui";
import { ParcelOptionsFields } from "@/features/delivery/ParcelOptions";
import { refreshTracking, sendToCarrier } from "@/features/delivery/actions";

type Text = Pick<Dictionary, "orders" | "errors" | "delivery" | "common">;

// Row checkboxes are plain inputs rendered by the server table (data-bulk-order = order id, data-number = #);
// every tool here finds them by this attribute, so the table itself stays a server component.
const ROW = "input[data-bulk-order]";
const rows = () => Array.from(document.querySelectorAll<HTMLInputElement>(ROW)).filter((r) => !r.disabled);
export const selectedRows = () => rows().filter((r) => r.checked).map((r) => ({ id: r.value, number: r.dataset.number ?? "" }));
const notify = () => document.dispatchEvent(new Event("change"));

// How many rows are ticked, kept in sync with the table
export function useSelectedCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const sync = () => setCount(selectedRows().length);
    sync();
    document.addEventListener("change", sync);
    return () => document.removeEventListener("change", sync);
  }, []);
  return count;
}

const select = (mode: "all" | "none" | "invert") => {
  for (const r of rows()) r.checked = mode === "all" ? true : mode === "none" ? false : !r.checked;
  notify();
};

// Select all / none / invert, and how many are selected
// (showCount: off where the assignment bar already says how many are selected)
export function SelectionTools({ t, showCount = true }: { t: Pick<Text, "orders">; showCount?: boolean }) {
  const s = t.orders.select;
  const count = useSelectedCount();
  const tool = "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-muted hover:bg-panel hover:text-fg";
  return (
    <div className="flex flex-wrap items-center gap-1" data-testid="selection-tools">
      {showCount && (
        <span className="me-2 text-sm font-semibold" data-testid="selected-count">
          {count ? fmt(s.count, { n: count }) : s.hint}
        </span>
      )}
      <button type="button" className={tool} onClick={() => select("all")} data-testid="select-all">
        <CheckSquare size={14} /> {s.all}
      </button>
      <button type="button" className={tool} onClick={() => select("none")} data-testid="select-none">
        <Square size={14} /> {s.none}
      </button>
      <button type="button" className={tool} onClick={() => select("invert")} data-testid="select-invert">
        <FlipHorizontal2 size={14} /> {s.invert}
      </button>
    </div>
  );
}

type Result = { id: string; number: string; ok: boolean; text: string };

// Runs one action per selected order (one request each: nothing times out on shared hosting), with progress,
// a stop button and a report of what happened to every order.
function useBatch(t: Text) {
  const router = useRouter();
  const stop = useRef(false);
  const [running, setRunning] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const errors = t.errors as Record<string, string>;
  const errorText = (r: ActionState) => {
    const base = errors[r.error ?? "unexpected"] ?? errors.unexpected;
    return r.message ? `${base}: ${r.message}` : base;
  };
  async function run(list: { id: string; number: string }[], action: (id: string) => Promise<ActionState>, success: (r: ActionState) => string) {
    stop.current = false;
    setResults([]);
    const out: Result[] = [];
    for (let i = 0; i < list.length; i++) {
      if (stop.current) break;
      setRunning({ done: i, total: list.length });
      const r = await action(list[i].id).catch(() => ({ ok: false, error: "unexpected" }) as ActionState);
      out.push({ ...list[i], ok: Boolean(r.ok), text: r.ok ? success(r) : errorText(r) });
      setResults([...out]);
    }
    setRunning(null);
    select("none");
    router.refresh();
  }
  return { running, results, setResults, run, stop: () => (stop.current = true) };
}

function BatchReport({ results, summary, onRetry, onClose, retryLabel, t }: { results: Result[]; summary: string; onRetry?: () => void; onClose: () => void; retryLabel: string; t: Text }) {
  const failed = results.filter((r) => !r.ok);
  return (
    <div className="space-y-2 rounded-lg border border-line bg-panel p-3" data-testid="batch-report">
      <div className="flex flex-wrap items-center gap-2">
        <p className="me-auto text-sm font-semibold">{summary}</p>
        {failed.length > 0 && onRetry && (
          <Button variant="secondary" className="py-1.5 text-xs" onClick={onRetry} data-testid="batch-retry">
            <RefreshCw size={14} /> {retryLabel}
          </Button>
        )}
        <button type="button" onClick={onClose} aria-label={t.orders.ship.close} className="rounded-md p-1 text-muted hover:bg-panel-2">
          <X size={16} />
        </button>
      </div>
      <ul className="max-h-60 divide-y divide-line overflow-y-auto text-sm">
        {results.map((r) => (
          <li key={r.id} className="flex gap-3 py-1.5" data-result={r.ok ? "ok" : "failed"} data-number={r.number}>
            <span className="w-14 shrink-0 font-semibold tabular-nums" dir="ltr">
              #{r.number}
            </span>
            <span className={r.ok ? "text-[#047857]" : "text-danger"}>{r.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Progress({ done, total, label, onStop, stopLabel }: { done: number; total: number; label: string; onStop: () => void; stopLabel: string }) {
  return (
    <div className="flex items-center gap-3" data-testid="batch-progress">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-panel-2">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round((done / total) * 100)}%` }} />
      </div>
      <span className="text-sm font-semibold tabular-nums">{label}</span>
      <Button variant="secondary" className="py-1 text-xs" onClick={onStop}>
        {stopLabel}
      </Button>
    </div>
  );
}

type Account = { id: string; name: string; isDefault: boolean; options: Partial<ParcelDefaults> | null };

// "Ready to ship": send the selected orders to a delivery company (with the parcel options), or download them as the
// Packers import sheet.
export function ShipPanel({ lang, accounts, deliveryHref, t }: { lang: string; accounts: Account[]; deliveryHref: string | null; t: Text }) {
  const s = t.orders.ship;
  const count = useSelectedCount();
  const first = accounts.find((a) => a.isDefault) ?? accounts[0];
  const [accountId, setAccountId] = useState(first?.id ?? "");
  const startOptions = (a?: Account): ParcelOptions => ({ ...defaultParcelOptions, ...(a?.options ?? {}) });
  const [options, setOptions] = useState(() => startOptions(first));
  const [showOptions, setShowOptions] = useState(false);
  const batch = useBatch(t);
  const [, startTransition] = useTransition();

  const send = (list: { id: string; number: string }[]) =>
    startTransition(() => batch.run(list, (id) => sendToCarrier(lang, id, accountId, options), (r) => fmt(s.sent, { tracking: r.message ?? "" })));

  // A plain form post: the browser downloads the file the server answers with
  const exportSheet = () => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/orders/packers-sheet";
    const add = (name: string, value: string) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    };
    for (const r of selectedRows()) add("ids", r.id);
    add("options", JSON.stringify(options));
    add("accountId", accountId);
    document.body.appendChild(form);
    form.submit();
    form.remove();
  };

  const ok = batch.results.filter((r) => r.ok).length;
  const failed = batch.results.filter((r) => !r.ok);
  return (
    <div className="space-y-3" data-testid="ship-panel">
      <div className="flex flex-wrap items-end gap-2">
        {accounts.length ? (
          <>
            <label className="min-w-44 space-y-1 text-sm">
              <span className="block text-xs text-muted">{s.with}</span>
              <Select
                value={accountId}
                onChange={(e) => {
                  setAccountId(e.target.value);
                  setOptions(startOptions(accounts.find((a) => a.id === e.target.value)));
                }}
                aria-label={s.with}
                data-testid="ship-account"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </label>
            <Button variant="secondary" onClick={() => setShowOptions(!showOptions)} aria-expanded={showOptions} data-testid="ship-options-toggle">
              <SlidersHorizontal size={15} /> {t.delivery.options.title}
            </Button>
            <Button disabled={!count || !accountId || Boolean(batch.running)} onClick={() => send(selectedRows())} data-testid="ship-send">
              <Send size={15} /> {fmt(s.send, { n: count })}
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted">
            {s.noCarrier}{" "}
            {deliveryHref && (
              <Link href={deliveryHref} className="font-semibold text-accent hover:underline">
                {s.connect}
              </Link>
            )}
          </p>
        )}
        <Button variant="ghost" className="ms-auto" disabled={!count} onClick={exportSheet} title={s.exportHint} data-testid="packers-export">
          <Download size={15} /> {s.export}
        </Button>
      </div>
      {showOptions && (
        <div className="rounded-lg border border-line bg-panel p-3">
          <p className="mb-3 text-xs text-muted">{s.options}</p>
          <ParcelOptionsFields value={options} onChange={setOptions} idPrefix="bulk" bulk t={t} />
        </div>
      )}
      {batch.running && <Progress done={batch.running.done} total={batch.running.total} label={fmt(s.sending, batch.running)} onStop={batch.stop} stopLabel={s.stop} />}
      {!batch.running && batch.results.length > 0 && (
        <BatchReport
          results={batch.results}
          summary={fmt(s.report, { ok, failed: failed.length })}
          retryLabel={fmt(s.retry, { n: failed.length })}
          onRetry={() => send(failed)}
          onClose={() => batch.setResults([])}
          t={t}
        />
      )}
    </div>
  );
}

// "At the courier": ask the companies for the selected parcels' stages
export function TrackPanel({ lang, t }: { lang: string; t: Text }) {
  const s = t.orders.track;
  const count = useSelectedCount();
  const batch = useBatch(t);
  const [, startTransition] = useTransition();
  const stages = t.delivery.statuses as Record<string, string>;
  const ok = batch.results.filter((r) => r.ok).length;
  return (
    <div className="space-y-3" data-testid="track-panel">
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={!count || Boolean(batch.running)} onClick={() => startTransition(() => batch.run(selectedRows(), (id) => refreshTracking(lang, id), (r) => stages[r.message ?? ""] ?? ""))} data-testid="track-refresh">
          <RefreshCw size={15} /> {fmt(s.refresh, { n: count })}
        </Button>
        <p className="text-xs text-muted">{s.autoHint}</p>
      </div>
      {batch.running && <Progress done={batch.running.done} total={batch.running.total} label={fmt(s.refreshing, batch.running)} onStop={batch.stop} stopLabel={t.orders.ship.stop} />}
      {!batch.running && batch.results.length > 0 && (
        <BatchReport results={batch.results} summary={fmt(s.done, { ok, failed: batch.results.length - ok })} retryLabel="" onClose={() => batch.setResults([])} t={t} />
      )}
    </div>
  );
}
