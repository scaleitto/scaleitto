"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Clock, MessageCircle } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt, formatPrice } from "@/lib/format";
import { Alert, Badge, Button, Card, Field, Select, Textarea, buttonClass } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { ImageManager } from "@/ui/ImageManager";
import { limitKeys, type PaymentMethod } from "@/lib/enums";
import type { Limits } from "@/server/db/schema";
import { cancelPlanRequest, requestPlan } from "./actions";
import { limitLine, periodLabel, priceLabel } from "./labels";

type Text = Pick<Dictionary, "plans" | "errors" | "common" | "media">;
type Plan = { id: string; code: string; name: string; priceMonthly: number; orderPack: number | null; limits: Limits };
type Payment = { holder: string | null; methods: Partial<Record<PaymentMethod, string>> };
// Same lists as billing.ts (server): months of a monthly plan, packs of a pay-as-you-go plan
const PERIODS = [1, 3, 6, 12];
const PACKS = [1, 2, 3, 5, 10];

function RequestForm({ lang, plan, payment, shopName, onClose, t }: { lang: string; plan: Plan; payment: Payment; shopName: string; onClose: () => void; t: Text }) {
  const r = t.plans.request;
  const e = t.errors as Record<string, string>;
  const methods = (Object.keys(payment.methods) as PaymentMethod[]).filter((m) => payment.methods[m]);
  const [months, setMonths] = useState(1);
  const [method, setMethod] = useState<PaymentMethod | undefined>(methods[0]);
  const [receipt, setReceipt] = useState<string[]>([]);
  const { state, pending, onSubmit } = useActionForm(requestPlan.bind(null, lang));
  useEffect(() => {
    if (state.ok) onClose();
  }, [state, onClose]);
  const amount = formatPrice(plan.priceMonthly * months, t.common.currency);
  if (!method) return <Alert variant="info">{r.noMethods}</Alert>;
  const whatsappText = fmt(r.whatsappMessage, { plan: plan.name, period: periodLabel(months, plan.orderPack, t), amount, shop: shopName });
  return (
    <Card className="space-y-4 border-accent/40" data-testid="plan-request-form">
      <h2 className="text-lg font-semibold">{fmt(r.title, { name: plan.name })}</h2>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormMessage state={state} errors={e} />
        <input type="hidden" name="planId" value={plan.id} />
        <input type="hidden" name="receiptUrl" value={receipt[0] ?? ""} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={plan.orderPack ? r.packs : r.months} htmlFor="pr-months">
            <Select id="pr-months" name="months" value={months} onChange={(ev) => setMonths(Number(ev.target.value))}>
              {(plan.orderPack ? PACKS : PERIODS).map((n) => (
                <option key={n} value={n}>
                  {periodLabel(n, plan.orderPack, t)}
                </option>
              ))}
            </Select>
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-medium">{r.total}</p>
            <p className="text-2xl font-bold text-accent" data-testid="plan-amount">
              {amount}
            </p>
          </div>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">{r.method}</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {methods.map((m) => (
              <label key={m} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${method === m ? "border-accent bg-accent/10" : "border-line"}`}>
                <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="accent-[var(--color-accent)]" />
                {r.methods[m]}
              </label>
            ))}
          </div>
          {fieldError(state, e, "method") && <p className="mt-1 text-sm text-danger">{fieldError(state, e, "method")}</p>}
        </fieldset>
        <div className="space-y-2 rounded-lg bg-panel-2 p-4 text-sm">
          <p className="text-muted">{r.instructions[method]}</p>
          {method === "whatsapp" ? (
            <a href={`https://wa.me/${payment.methods.whatsapp}?text=${encodeURIComponent(whatsappText)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline">
              <MessageCircle size={16} /> {r.openWhatsapp}
            </a>
          ) : (
            <>
              <p className="font-mono text-base font-semibold select-all" dir="ltr" data-testid="payment-account">
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
        <Field label={r.note} htmlFor="pr-note">
          <Textarea id="pr-note" name="note" rows={2} maxLength={500} />
        </Field>
        <div className="flex gap-2">
          <SubmitButton pending={pending} pendingText={t.common.loading}>
            {r.submit}
          </SubmitButton>
          <Button type="button" variant="secondary" onClick={onClose}>
            {r.cancel}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function PlanChooser({
  lang,
  plans,
  currentCode,
  pending,
  payment,
  shopName,
  t,
}: {
  lang: string;
  plans: Plan[];
  currentCode: string;
  pending: { id: string; planName: string; months: number; orderPack: number | null; amount: number } | null;
  payment: Payment;
  shopName: string;
  t: Text;
}) {
  const p = t.plans;
  const [chosen, setChosen] = useState<Plan | null>(null);
  const [busy, startTransition] = useTransition();
  return (
    <div className="space-y-4">
      {pending && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm" data-testid="plan-pending">
          <Clock size={18} className="shrink-0 text-warning" />
          <p className="me-auto">{fmt(p.pending, { plan: pending.planName, period: periodLabel(pending.months, pending.orderPack, t), amount: formatPrice(pending.amount, t.common.currency) })}</p>
          <Button variant="secondary" className="py-1.5 text-xs" disabled={busy} onClick={() => startTransition(async () => void (await cancelPlanRequest(lang, pending.id)))}>
            {p.cancelRequest}
          </Button>
        </div>
      )}
      <h2 className="text-lg font-semibold">{p.compare}</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {plans.map((plan) => {
          const mine = plan.code === currentCode;
          const paid = plan.priceMonthly > 0;
          return (
            <Card key={plan.id} className={`flex flex-col gap-4 ${mine ? "border-accent" : ""}`} data-plan-card={plan.code}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-bold">{plan.name}</h3>
                {mine && <Badge tone="accent">{p.yours}</Badge>}
              </div>
              <p className="-mt-2 text-sm text-muted">{(p.taglines as Record<string, string>)[plan.code] ?? ""}</p>
              <p className="text-2xl font-extrabold">{priceLabel(plan, t)}</p>
              <ul className="flex-1 space-y-1.5 text-sm">
                {limitKeys.map((k) => {
                  const line = limitLine(plan, k, t);
                  return (
                    <li key={k} className="flex items-center gap-2">
                      <Check size={15} className="shrink-0 text-accent" />
                      <span>
                        <span className="font-semibold">{line.value}</span> {line.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {paid && (
                <Button variant={mine ? "secondary" : "primary"} disabled={Boolean(pending)} onClick={() => setChosen(plan)}>
                  {mine ? (plan.orderPack ? p.topUp : p.renew) : p.choose}
                </Button>
              )}
            </Card>
          );
        })}
        <CustomPlanCard whatsapp={payment.methods.whatsapp} t={t} />
      </div>
      {chosen && !pending && <RequestForm key={chosen.id} lang={lang} plan={chosen} payment={payment} shopName={shopName} onClose={() => setChosen(null)} t={t} />}
    </div>
  );
}

// Bigger stores: limits and dates agreed one by one (set by the platform admin as a contract)
export function CustomPlanCard({ whatsapp, t }: { whatsapp?: string; t: Pick<Text, "plans"> }) {
  const c = t.plans.custom;
  return (
    <Card className="flex flex-col gap-4" data-plan-card="custom">
      <h3 className="text-lg font-bold">{c.name}</h3>
      <p className="-mt-2 text-sm text-muted">{c.tagline}</p>
      <p className="text-2xl font-extrabold">{c.price}</p>
      <p className="flex-1 text-sm">{c.text}</p>
      {whatsapp && (
        <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(c.whatsapp)}`} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
          <MessageCircle size={16} /> {c.contact}
        </a>
      )}
    </Card>
  );
}
