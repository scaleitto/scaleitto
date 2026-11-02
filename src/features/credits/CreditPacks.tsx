"use client";

import { useState, useTransition } from "react";
import { Clock, Coins, MessageCircle } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt, formatPrice } from "@/lib/format";
import type { PaymentMethod } from "@/lib/enums";
import { Alert, Button, Field, Textarea } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { ImageManager } from "@/ui/ImageManager";
import { creditPacks, type CreditPackKey } from "./packs";
import { buyCreditsByCard, cancelCreditRequest, requestCredits } from "./actions";

type Text = Pick<Dictionary, "balance" | "plans" | "errors" | "common" | "media">;
type Payment = { holder: string | null; methods: Partial<Record<PaymentMethod, string>> };

function LocalRequest({ lang, pack, payment, onClose, t }: { lang: string; pack: CreditPackKey; payment: Payment; onClose: () => void; t: Text }) {
  const r = t.plans.request;
  const e = t.errors as Record<string, string>;
  const methods = (Object.keys(payment.methods) as PaymentMethod[]).filter((m) => payment.methods[m]);
  const [method, setMethod] = useState<PaymentMethod | undefined>(methods[0]);
  const [receipt, setReceipt] = useState<string[]>([]);
  const { state, pending, onSubmit } = useActionForm(requestCredits.bind(null, lang));
  const [last, setLast] = useState(state);
  if (state !== last) {
    setLast(state);
    if (state.ok) onClose();
  }
  const p = creditPacks.find((x) => x.key === pack)!;
  if (!method) return <Alert variant="info">{r.noMethods}</Alert>;
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3 rounded-xl border border-accent/40 p-4" data-testid="credit-request">
      <FormMessage state={state} errors={e} />
      <input type="hidden" name="pack" value={pack} />
      <input type="hidden" name="receiptUrl" value={receipt[0] ?? ""} />
      <p className="font-semibold">
        {fmt(t.balance.packCredits, { n: p.credits.toLocaleString("fr-FR") })} — {formatPrice(p.price, t.common.currency)}
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {methods.map((m) => (
          <label key={m} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm ${method === m ? "border-accent bg-accent/10" : "border-line"}`}>
            <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="accent-[var(--color-accent)]" />
            {r.methods[m]}
          </label>
        ))}
      </div>
      <div className="space-y-1 rounded-lg bg-panel-2 p-3 text-sm">
        <p className="text-muted">{r.instructions[method]}</p>
        {method === "whatsapp" ? (
          <a href={`https://wa.me/${payment.methods.whatsapp}?text=${encodeURIComponent(fmt(t.balance.whatsappMessage, { n: p.credits, amount: formatPrice(p.price, t.common.currency) }))}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline">
            <MessageCircle size={16} /> {r.openWhatsapp}
          </a>
        ) : (
          <>
            <p className="font-mono font-semibold select-all" dir="ltr">
              {payment.methods[method]}
            </p>
            {payment.holder && <p className="text-muted">{fmt(r.holder, { name: payment.holder })}</p>}
          </>
        )}
      </div>
      {method !== "whatsapp" && (
        <Field label={r.receipt} error={fieldError(state, e, "receiptUrl")}>
          <ImageManager t={t.media} value={receipt} onChange={setReceipt} max={1} />
        </Field>
      )}
      <Field label={r.note} htmlFor="cr-note">
        <Textarea id="cr-note" name="note" rows={2} maxLength={500} />
      </Field>
      <div className="flex gap-2">
        <SubmitButton pending={pending} pendingText={t.common.loading} data-testid="credit-request-send">
          {r.submit}
        </SubmitButton>
        <Button type="button" variant="secondary" onClick={onClose}>
          {r.cancel}
        </Button>
      </div>
    </form>
  );
}

// Zimam's credit packs: by card (the platform's gateway) or by local payment (transfer / WhatsApp, approved by hand)
export function CreditPacks({ lang, cardReady, payment, pending, t }: { lang: string; cardReady: boolean; payment: Payment; pending: { id: string; credits: number; method: string; at: string }[]; t: Text }) {
  const b = t.balance;
  const e = t.errors as Record<string, string>;
  const [tab, setTab] = useState<"card" | "local">(cardReady ? "card" : "local");
  const [open, setOpen] = useState<CreditPackKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <div className="space-y-3" data-testid="credit-packs">
      <div className="grid grid-cols-2 gap-2">
        {(["card", "local"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${tab === k ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-muted"}`} data-testid={`packs-${k}`}>
            {k === "card" ? b.card : b.local}
          </button>
        ))}
      </div>
      {tab === "card" && !cardReady && <p className="rounded-lg bg-panel-2 p-3 text-sm text-muted">{b.cardSoon}</p>}
      {error && <Alert>{error}</Alert>}
      {creditPacks.map((p) => (
        <div key={p.key} className="space-y-3 rounded-xl bg-panel-2 p-4" data-pack={p.key}>
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-accent">
              <Coins size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{b.packs[p.key]}</p>
              <p className="text-xs text-muted">{fmt(b.packCredits, { n: p.credits.toLocaleString("fr-FR") })}</p>
            </div>
            <Button
              disabled={busy || (tab === "card" && !cardReady)}
              onClick={() => {
                setError(null);
                if (tab === "local") setOpen(p.key);
                else
                  start(async () => {
                    const r = await buyCreditsByCard(lang, p.key).catch(() => ({ ok: false, error: "unexpected" }) as const);
                    if (!r.ok) setError(e[r.error ?? "unexpected"] ?? e.unexpected);
                  });
              }}
              data-testid={`buy-${p.key}`}
            >
              {fmt(b.buy, { price: formatPrice(p.price, t.common.currency) })}
            </Button>
          </div>
          {tab === "local" && open === p.key && <LocalRequest lang={lang} pack={p.key} payment={payment} onClose={() => setOpen(null)} t={t} />}
        </div>
      ))}
      {pending.length > 0 && (
        <div className="space-y-2" data-testid="credit-pending">
          {pending.map((p) => (
            <p key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
              <Clock size={15} className="text-warning" /> {fmt(b.pendingRequest, { n: p.credits.toLocaleString("fr-FR"), at: p.at })}
              <Button variant="ghost" className="ms-auto py-1 text-xs" disabled={busy} onClick={() => start(async () => void (await cancelCreditRequest(lang, p.id)))}>
                {t.common.cancel}
              </Button>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
