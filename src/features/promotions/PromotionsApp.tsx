"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Percent, Search, Square, Tag, Trash2 } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt, formatPrice } from "@/lib/format";
import { Button, Card, Field, Input } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { createPromotion, deletePromotion, endPromotion } from "./actions";

type Text = Pick<Dictionary, "apps" | "errors" | "common">;
type Product = { id: string; name: string; price: number; image: string | null; draft: boolean };
type Campaign = { id: string; name: string; percent: number; starts: string; ends: string; state: "scheduled" | "running" | "ended"; products: string[] };

// Zimam's Promotion Campaigns: create a campaign (name, %, from–to in Algeria time, products) beside the list of campaigns
export function PromotionsApp({ lang, products, campaigns, defaults, currency, t }: { lang: string; products: Product[]; campaigns: Campaign[]; defaults: { start: string; end: string }; currency: string; t: Text }) {
  const p = t.apps.promotions;
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(createPromotion.bind(null, lang));
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [percent, setPercent] = useState(20);
  const [formKey, setFormKey] = useState(0);
  const [lastOk, setLastOk] = useState(state);
  // A saved campaign: start a fresh form
  if (state !== lastOk) {
    setLastOk(state);
    if (state.ok) {
      setPicked([]);
      setFormKey((k) => k + 1);
    }
  }
  const [busy, start] = useTransition();
  const shown = products.filter((x) => x.name.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (id: string) => setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <Card className="p-0" data-testid="promotion-form">
        <form key={formKey} onSubmit={onSubmit} noValidate className="space-y-5 p-6">
          <div>
            <h2 className="text-lg font-semibold">{p.create}</h2>
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">{fmt(p.selected, { n: picked.length })}</p>
          </div>
          <FormMessage state={state} errors={e} success={p.saved} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={p.name} htmlFor="pr-name" error={fieldError(state, e, "name")}>
              <Input id="pr-name" name="name" maxLength={120} placeholder={p.namePlaceholder} />
            </Field>
            <Field label={p.percent} htmlFor="pr-percent" error={fieldError(state, e, "percent")}>
              <div className="relative">
                <Input id="pr-percent" name="percent" type="number" min={1} max={90} value={percent} onChange={(ev) => setPercent(Number(ev.target.value))} dir="ltr" className="pe-10" />
                <Percent size={15} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted" />
              </div>
            </Field>
            <Field label={p.starts} htmlFor="pr-start" error={fieldError(state, e, "startsAt")}>
              <Input id="pr-start" name="startsAt" type="datetime-local" defaultValue={defaults.start} dir="ltr" />
            </Field>
            <Field label={p.ends} htmlFor="pr-end" error={fieldError(state, e, "endsAt")}>
              <Input id="pr-end" name="endsAt" type="datetime-local" defaultValue={defaults.end} dir="ltr" />
            </Field>
          </div>
          <p className="text-xs text-muted">{p.timeHint}</p>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">{p.products}</h3>
              <div className="relative w-full sm:w-64">
                <Input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder={p.search} className="pe-9" aria-label={p.search} />
                <Search size={15} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted" />
              </div>
            </div>
            {fieldError(state, e, "productIds") && <p className="text-sm text-danger">{fieldError(state, e, "productIds")}</p>}
            <div className="max-h-80 space-y-2 overflow-y-auto" data-testid="promotion-products">
              {shown.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">{p.noProducts}</p>
              ) : (
                shown.map((x) => {
                  const on = picked.includes(x.id);
                  return (
                    <label key={x.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${on ? "border-accent bg-accent-soft/40" : "border-line"}`} data-product={x.name}>
                      <input type="checkbox" name="productIds" value={x.id} checked={on} onChange={() => toggle(x.id)} className="size-4 accent-[var(--color-accent)]" />
                      {x.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={x.image} alt="" className="size-11 rounded-lg object-cover" />
                      ) : (
                        <span className="grid size-11 place-items-center rounded-lg bg-panel-2 text-muted">
                          <Tag size={16} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{x.name}</span>
                        <span className="text-xs text-muted">
                          {formatPrice(x.price, currency)}
                          {on && percent >= 1 && percent <= 90 && (
                            <>
                              {" → "}
                              <b className="text-accent-ink">{formatPrice(Math.max(1, Math.round((x.price * (100 - percent)) / 100)), currency)}</b>
                            </>
                          )}
                          {x.draft && ` · ${p.draft}`}
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
          <div className="flex justify-end">
            <SubmitButton pending={pending} pendingText={t.common.loading} data-testid="promotion-save">
              {p.save}
            </SubmitButton>
          </div>
        </form>
      </Card>
      <Card className="self-start p-0" data-testid="promotion-list">
        <div className="border-b border-line p-5">
          <h2 className="text-lg font-semibold">{p.campaigns}</h2>
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">{fmt(p.count, { n: campaigns.length })}</p>
        </div>
        {campaigns.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted">{p.empty}</p>
        ) : (
          <ul className="divide-y divide-line">
            {campaigns.map((c) => (
              <li key={c.id} className="space-y-2 p-5" data-campaign={c.name} data-state={c.state}>
                <div className="flex items-start gap-2">
                  <p className="me-auto font-semibold">{c.name}</p>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${c.state === "running" ? "bg-accent-soft text-accent-ink" : c.state === "scheduled" ? "bg-info/10 text-info" : "bg-panel-2 text-muted"}`}>{p.states[c.state]}</span>
                </div>
                <p className="text-2xl font-extrabold text-accent-ink" dir="ltr">
                  -{c.percent}%
                </p>
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <CalendarClock size={13} /> {c.starts} → {c.ends}
                </p>
                <p className="text-xs text-muted">{c.products.join("، ") || "—"}</p>
                <div className="flex gap-1">
                  {c.state === "running" && (
                    <Button variant="secondary" className="py-1 text-xs" disabled={busy} onClick={() => start(async () => void (await endPromotion(lang, c.id)))}>
                      <Square size={13} /> {p.end}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="py-1 text-xs hover:text-danger"
                    disabled={busy}
                    onClick={() => {
                      if (confirm(p.confirmDelete)) start(async () => void (await deletePromotion(lang, c.id)));
                    }}
                    aria-label={t.common.delete}
                  >
                    <Trash2 size={14} /> {t.common.delete}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
