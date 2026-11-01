"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Lock, MessageCircle, Package, Pencil, ShieldAlert } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { ActionState } from "@/lib/action";
import { fmt } from "@/lib/format";
import { orderStatuses } from "@/server/db/schema";
import { Alert } from "@/ui";
import { changeOrderStatus, updateOrderField, type InlineField } from "./actions";
import { statusPill, type OrderStatus } from "./statuses";

type Text = Pick<Dictionary, "orderPage" | "orders" | "errors">;
export type TableRow = {
  id: string;
  number: number;
  status: OrderStatus;
  date: string;
  time: string;
  product: string | null;
  image: string | null;
  lines: number;
  pieces: number;
  total: number;
  deliveryType: "home" | "office";
  customerName: string;
  phone: string;
  wilaya: string;
  commune: string;
  assignedTo: string | null;
  carrierAccountId: string | null;
  carrierName: string | null;
  trackingNumber: string | null;
  note: string | null;
  locked: boolean;
  // At or above the store's risk level (Protection)
  risky: boolean;
  risk: number;
};

const cell = "h-9 rounded-lg border border-transparent bg-transparent px-2 text-sm text-fg hover:border-line focus:border-accent focus:bg-panel focus:outline-none disabled:opacity-60";
const selectCell = `${cell} select-chevron appearance-none pe-7`;

// The orders table (Zimam's columns). Amount, status, delivery type, agent, company and note are edited in place: each
// change is saved as soon as the field is left or changed. Row checkboxes carry data-bulk-order for the bulk tools.
export function OrdersTable({
  lang,
  rows,
  members,
  accounts,
  canAssign,
  editBase,
  t,
}: {
  lang: string;
  rows: TableRow[];
  members: { userId: string; name: string }[];
  accounts: { id: string; name: string }[];
  canAssign: boolean;
  editBase: string;
  t: Text;
}) {
  const p = t.orderPage;
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = (run: () => Promise<ActionState>) =>
    start(async () => {
      const r = await run();
      setError(r.ok ? null : ((t.errors as Record<string, string>)[r.error ?? ""] ?? t.errors.unexpected));
    });
  const field = (id: string, f: InlineField, value: string) => save(() => updateOrderField(lang, id, f, value));
  const memberName = (id: string | null) => members.find((m) => m.userId === id)?.name;

  return (
    <div aria-busy={pending}>
      {error && (
        <div className="p-3">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-sm" data-testid="orders-table">
          <thead>
            <tr className="text-start text-xs font-semibold tracking-wide text-muted uppercase">
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  aria-label={t.orders.bulk.selectAll}
                  data-testid="select-all"
                  className="size-4 accent-[var(--color-accent)]"
                  onChange={(e) => {
                    for (const r of document.querySelectorAll<HTMLInputElement>("input[data-bulk-order]")) if (!r.disabled) r.checked = e.target.checked;
                    document.dispatchEvent(new Event("change"));
                  }}
                />
              </th>
              {(["id", "product", "qty", "amount", "status", "type", "client", "address", "agent", "delivery", "note"] as const).filter((k) => canAssign || k !== "agent").map((k) => (
                <th key={k} className="px-2 py-3 text-start">
                  {p.cols[k]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} data-order={r.number} data-status={r.status} className="border-t border-line align-middle hover:bg-panel-2/60">
                <td className="px-3 py-2">
                  <input type="checkbox" value={r.id} data-bulk-order data-number={r.number} aria-label={t.orders.bulk.select} className="size-4 accent-[var(--color-accent)]" onChange={() => document.dispatchEvent(new Event("change"))} />
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="flex items-center gap-1 font-semibold tabular-nums">
                        #{r.number}
                        {r.risky && (
                          <span title={fmt(t.orders.risk.badge, { n: r.risk })} className="text-warning" data-testid="risk-badge">
                            <ShieldAlert size={14} />
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted tabular-nums">
                        {r.date} · {r.time}
                      </p>
                    </div>
                    <Link href={`${editBase}/${r.id}`} aria-label={p.edit} title={p.edit} className="grid size-7 place-items-center rounded-md text-muted hover:bg-accent-soft hover:text-accent" data-testid="edit-order">
                      <Pencil size={14} />
                    </Link>
                  </div>
                </td>
                <td className="px-2 py-2">
                  <div className="flex max-w-[210px] items-center gap-2">
                    {r.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.image} alt="" className="size-9 shrink-0 rounded-lg border border-line object-cover" />
                    ) : (
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-panel-2 text-muted">
                        <Package size={16} />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="line-clamp-2 font-medium">{r.product ?? "—"}</span>
                      {r.lines > 1 && <span className="text-xs text-muted">{fmt(p.more, { n: r.lines - 1 })}</span>}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-2 tabular-nums">{r.pieces}</td>
                <td className="px-2 py-2">
                  <input
                    key={r.total}
                    defaultValue={r.total}
                    inputMode="numeric"
                    disabled={r.locked}
                    aria-label={p.cols.amount}
                    className={`${cell} w-24 tabular-nums`}
                    data-field="total"
                    onBlur={(e) => e.target.value !== String(r.total) && field(r.id, "total", e.target.value)}
                  />
                </td>
                <td className="px-2 py-2">
                  <select
                    value={r.status}
                    disabled={r.locked}
                    aria-label={p.cols.status}
                    data-field="status"
                    className={`h-8 cursor-pointer appearance-none rounded-full border-0 px-3 text-xs font-semibold focus:ring-2 focus:ring-accent/30 focus:outline-none ${statusPill[r.status]}`}
                    onChange={(e) => save(() => changeOrderStatus(lang, r.id, e.target.value))}
                  >
                    {orderStatuses.map((s) => (
                      <option key={s} value={s}>
                        {t.orders.statuses[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <select value={r.deliveryType} disabled={r.locked} aria-label={p.cols.type} data-field="deliveryType" className={`${selectCell} w-24`} onChange={(e) => field(r.id, "deliveryType", e.target.value)}>
                    <option value="home">{p.home}</option>
                    <option value="office">{p.desk}</option>
                  </select>
                </td>
                <td className="px-2 py-2">
                  {r.locked ? (
                    <span className="inline-flex items-center gap-1 text-xs text-warning">
                      <Lock size={13} /> {t.orders.locked.short}
                    </span>
                  ) : (
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.customerName}</p>
                      <p className="flex items-center gap-1.5 text-xs text-muted" dir="ltr">
                        <a href={`tel:${r.phone}`} className="tabular-nums hover:text-fg">
                          {r.phone}
                        </a>
                        <a href={`https://wa.me/213${r.phone.replace(/^0/, "")}`} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="text-accent hover:opacity-80" data-testid="row-whatsapp">
                          <MessageCircle size={13} />
                        </a>
                      </p>
                    </div>
                  )}
                </td>
                <td className="px-2 py-2">
                  <p className="truncate font-medium">{r.wilaya}</p>
                  <p className="truncate text-xs text-muted">{r.commune}</p>
                </td>
                {canAssign && (
                <td className="px-2 py-2">
                  {canAssign ? (
                    <select value={r.assignedTo ?? ""} disabled={r.locked} aria-label={p.cols.agent} data-field="agent" className={`${selectCell} w-36`} onChange={(e) => field(r.id, "agent", e.target.value)}>
                      <option value="">{p.notAssigned}</option>
                      {members.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-muted">{memberName(r.assignedTo) ?? (r.assignedTo ? "✓" : p.notAssigned)}</span>
                  )}
                </td>
                )}
                <td className="px-2 py-2">
                  {r.trackingNumber ? (
                    <div className="min-w-0 text-xs">
                      <p className="font-medium">{r.carrierName}</p>
                      <p className="text-muted tabular-nums" dir="ltr">
                        {r.trackingNumber}
                      </p>
                    </div>
                  ) : (
                    <select value={r.carrierAccountId ?? ""} disabled={r.locked} aria-label={p.cols.delivery} data-field="carrier" className={`${selectCell} w-36`} onChange={(e) => field(r.id, "carrier", e.target.value)}>
                      <option value="">{p.none}</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-2 py-2">
                  <input
                    key={r.note ?? ""}
                    defaultValue={r.note ?? ""}
                    disabled={r.locked}
                    placeholder={p.notePlaceholder}
                    aria-label={p.cols.note}
                    data-field="note"
                    className={`${cell} w-40`}
                    onBlur={(e) => e.target.value !== (r.note ?? "") && field(r.id, "note", e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
