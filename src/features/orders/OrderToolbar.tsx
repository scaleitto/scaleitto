"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Filter, RefreshCw, X } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt } from "@/lib/format";
import { orderStatuses } from "@/server/db/schema";
import { Button, Field, Input, Select, buttonClass } from "@/ui";
import { changeOrderStatus } from "./actions";
import { selectedRows, useSelectedCount } from "./OrderTools";
import type { OrderFilters } from "./views";
import { useModal } from "@/ui/useModal";

type Text = Pick<Dictionary, "orderPage" | "orders" | "errors">;

// Filter: product, agent, payment, wilaya and dates, in a dialog; "Apply" opens the list with them in the address
export function FilterDialog({
  base,
  filters: f,
  products,
  members,
  canFilterAgent,
  wilayas,
  t,
}: {
  base: string;
  filters: OrderFilters;
  products: { id: string; name: string }[];
  members: { userId: string; name: string }[];
  canFilterAgent: boolean;
  wilayas: { code: number; name: string }[];
  t: Text;
}) {
  const p = t.orderPage;
  const ref = useModal();
  const active = [f.product, f.agent, f.payment, f.wilaya, f.from, f.to].filter(Boolean).length;
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => ref.current?.showModal()} data-testid="filter-open">
        <Filter size={15} /> {p.filter}
        {active > 0 && <span className="rounded-full bg-accent px-1.5 text-xs text-accent-fg">{active}</span>}
      </Button>
      <dialog ref={ref} className="m-auto w-[min(480px,calc(100vw-2rem))] rounded-2xl border border-line bg-panel p-0 text-fg shadow-xl backdrop:bg-black/30 backdrop:backdrop-blur-sm" data-testid="filter-dialog">
        <form action={base} method="get" className="space-y-4 p-6" onSubmit={() => ref.current?.close()}>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2.5 text-lg font-bold">
              <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent">
                <Filter size={18} />
              </span>
              {p.filterTitle}
            </h2>
            <button type="button" aria-label={p.cancel} className="grid size-8 place-items-center rounded-md text-muted hover:bg-panel-2" onClick={() => ref.current?.close()}>
              <X size={18} />
            </button>
          </div>
          <input type="hidden" name="status" value={f.status} />
          {f.q && <input type="hidden" name="q" value={f.q} />}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={p.product} htmlFor="f-product">
              <Select id="f-product" name="product" defaultValue={f.product ?? ""}>
                <option value="">{p.allProducts}</option>
                {products.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </Select>
            </Field>
            {canFilterAgent && (
              <Field label={p.agent} htmlFor="f-agent">
                <Select id="f-agent" name="agent" defaultValue={f.agent ?? ""}>
                  <option value="">{p.allAgents}</option>
                  <option value="me">{p.myself}</option>
                  <option value="none">{p.nobody}</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label={p.payment} htmlFor="f-payment">
              <Select id="f-payment" name="payment" defaultValue={f.payment ?? ""}>
                <option value="">{p.allPayments}</option>
                <option value="cod">{p.cod}</option>
                <option value="card">{p.card}</option>
              </Select>
            </Field>
          </div>
          <Field label={p.wilaya} htmlFor="f-wilaya">
            <Select id="f-wilaya" name="wilaya" defaultValue={f.wilaya ?? ""}>
              <option value="">{p.all}</option>
              {wilayas.map((w) => (
                <option key={w.code} value={w.code}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">{p.dateRange}</legend>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-panel-2/60 p-3">
              <Input id="f-from" type="date" name="from" defaultValue={f.from} aria-label={p.startDate} />
              <ArrowLeft size={16} className="shrink-0 text-muted ltr:rotate-180" />
              <Input id="f-to" type="date" name="to" defaultValue={f.to} aria-label={p.endDate} />
            </div>
          </fieldset>
          <div className="flex justify-end gap-2 pt-2">
            <a href={`${base}?status=${f.status}`} className={buttonClass("secondary", "h-12 px-5")} data-testid="filter-clear">
              {p.clearAll}
            </a>
            <Button type="submit" className="h-12 px-6" data-testid="filter-apply">
              {p.apply}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}

export function RefreshButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="secondary" disabled={pending} onClick={() => start(() => router.refresh())} data-testid="refresh">
      <RefreshCw size={15} className={pending ? "animate-spin" : ""} /> {label}
    </Button>
  );
}

// The selection's status in one go (one request per order, then the list is read again)
export function BulkStatus({ lang, t }: { lang: string; t: Text }) {
  const p = t.orderPage;
  const count = useSelectedCount();
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(0);
  if (!count) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft px-3 py-2 text-sm" data-testid="bulk-status">
      <span className="font-semibold">{fmt(p.selected, { n: count })}</span>
      <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={p.bulkStatus} className="w-auto">
        <option value="">{p.changeStatus}</option>
        {orderStatuses.map((s) => (
          <option key={s} value={s}>
            {t.orders.statuses[s]}
          </option>
        ))}
      </Select>
      <Button
        type="button"
        disabled={!status || pending}
        data-testid="bulk-status-apply"
        onClick={() =>
          start(async () => {
            let bad = 0;
            for (const r of selectedRows()) if (!(await changeOrderStatus(lang, r.id, status)).ok) bad++;
            setFailed(bad);
            router.refresh();
          })
        }
      >
        {p.apply}
      </Button>
      {failed > 0 && <span className="text-danger">{fmt(p.failed, { n: failed })}</span>}
    </div>
  );
}
