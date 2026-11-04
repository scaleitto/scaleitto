"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Clock, CreditCard, Landmark, MessageCircle, Package, Sparkles, X } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt, formatPrice } from "@/lib/format";
import { Alert, Badge, Button, Card, Field, Select, Textarea, buttonClass } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { ImageManager } from "@/ui/ImageManager";
import { limitKeys, type PaymentMethod } from "@/lib/enums";
import type { Limits } from "@/server/db/schema";
import { cancelPlanRequest, requestPlan } from "./actions";
import { limitLine, periodLabel, priceLabel } from "./labels";
import { previewDiscount, type DiscountPreview } from "@/features/referrals/discount";
import { PERIODS as TERMS, planAmount, termDiscount } from "./terms";
import { buyQuotaPack, requestPlanOnline } from "./actions";
import { quotaPacks } from "./packs";

type Text = Pick<Dictionary, "plans" | "errors" | "common" | "media">;
type Plan = { id: string; code: string; name: string; priceMonthly: number; orderPack: number | null; limits: Limits; features: string[] };
type Payment = { holder: string | null; methods: Partial<Record<PaymentMethod, string>> };
// Same lists as billing.ts (server): months of a monthly plan, packs of a pay-as-you-go plan
const PERIODS = [1, 3, 6, 12];
const PACKS = [1, 2, 3, 5, 10];

function RequestForm({ lang, plan, payment, shopName, onClose, referral, initialMonths = 1, t }: { lang: string; plan: Plan; payment: Payment; shopName: string; onClose: () => void; referral: DiscountPreview; initialMonths?: number; t: Text }) {
  const r = t.plans.request;
  const e = t.errors as Record<string, string>;
  const methods = (Object.keys(payment.methods) as PaymentMethod[]).filter((m) => payment.methods[m]);
  const [months, setMonths] = useState(plan.orderPack ? 1 : initialMonths);
  const [method, setMethod] = useState<PaymentMethod | undefined>(methods[0]);
  const [receipt, setReceipt] = useState<string[]>([]);
  const { state, pending, onSubmit } = useActionForm(requestPlan.bind(null, lang));
  useEffect(() => {
    if (state.ok) onClose();
  }, [state, onClose]);
  // Refer a seller: the discount the server will take off (first payment of a referred store, a voucher)
  const gross = planAmount(plan, months);
  const discount = previewDiscount(referral, plan.priceMonthly, gross);
  const amount = formatPrice(gross - discount, t.common.currency);
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
            {discount > 0 && (
              <p className="text-xs text-muted" data-testid="plan-discount">
                {fmt(r.referralDiscount, { amount: formatPrice(discount, t.common.currency) })}
              </p>
            )}
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
  referral = { firstPayment: false, voucherValue: null },
  online = [],
  t,
}: {
  lang: string;
  plans: Plan[];
  currentCode: string;
  pending: { id: string; planName: string; months: number; orderPack: number | null; amount: number } | null;
  payment: Payment;
  shopName: string;
  referral?: DiscountPreview;
  // The platform's online payment methods (none = only local payment)
  online?: string[];
  t: Text;
}) {
  const p = t.plans;
  const b = p.billing;
  const e = t.errors as Record<string, string>;
  const [chosen, setChosen] = useState<Plan | null>(null);
  const [way, setWay] = useState<"online" | "local">(online.length ? "online" : "local");
  const [gateway, setGateway] = useState(online[0] ?? "");
  const [term, setTerm] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const subscribe = (plan: Plan) => {
    setError(null);
    if (way === "local") return setChosen(plan);
    startTransition(async () => {
      const r = await requestPlanOnline(lang, { planId: plan.id, months: plan.orderPack ? 1 : term, method: gateway });
      if (!r.ok) setError(e[r.error ?? "unexpected"] ?? e.unexpected);
    });
  };
  const methodCard = (key: "online" | "local", Icon: typeof CreditCard, title: string, hint: string, disabled: boolean) => (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={way === key}
      onClick={() => setWay(key)}
      className={`flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-start transition disabled:cursor-not-allowed disabled:opacity-50 ${way === key ? "border-accent bg-accent-soft/50" : "border-line bg-panel hover:border-fg-2/30"}`}
      data-pay={key}
    >
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted">{disabled ? b.notAvailable : hint}</span>
      </span>
      <Icon size={18} className={way === key ? "text-accent" : "text-muted"} />
    </button>
  );
  return (
    <div className="space-y-6">
      {pending && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm" data-testid="plan-pending">
          <Clock size={18} className="shrink-0 text-warning" />
          <p className="me-auto">{fmt(p.pending, { plan: pending.planName, period: periodLabel(pending.months, pending.orderPack, t), amount: formatPrice(pending.amount, t.common.currency) })}</p>
          <Button variant="secondary" className="py-1.5 text-xs" disabled={busy} onClick={() => startTransition(async () => void (await cancelPlanRequest(lang, pending.id)))}>
            {p.cancelRequest}
          </Button>
        </div>
      )}

      <div className="space-y-4 text-center">
        <p className="text-xs font-semibold tracking-wider text-muted uppercase">{b.available}</p>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{b.chooseTerm}</h2>
        <div className="mx-auto max-w-xl space-y-1.5">
          <p className="text-xs text-muted">{b.payMethod}</p>
          <div className="grid gap-2 sm:grid-cols-2" data-testid="pay-ways">
            {methodCard("online", CreditCard, b.online, b.onlineHint, !online.length)}
            {methodCard("local", Landmark, b.local, b.localHint, false)}
          </div>
          {way === "online" && online.length > 1 && (
            <div className="flex flex-wrap justify-center gap-1.5 pt-1" data-testid="gateways">
              <span className="text-xs text-muted">{b.payWith}</span>
              {online.map((m) => (
                <button key={m} type="button" aria-pressed={gateway === m} onClick={() => setGateway(m)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${gateway === m ? "border-accent bg-accent text-accent-fg" : "border-line"}`} data-gateway={m}>
                  {(b.gateways as Record<string, string>)[m] ?? m}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <p className="text-xs text-muted">{b.prepaid}</p>
          <div className="mx-auto inline-flex flex-wrap justify-center gap-1 rounded-xl bg-ink p-1" role="radiogroup" aria-label={b.prepaid} data-testid="terms">
            {TERMS.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={term === n} onClick={() => setTerm(n)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${term === n ? "bg-accent text-accent-fg" : "text-white/80 hover:text-white"}`} data-term={n}>
                {(b.terms as Record<string, string>)[String(n)]}
                {termDiscount(n) > 0 && <span className="rounded bg-white/15 px-1.5 text-[11px]">{fmt(b.save, { n: termDiscount(n) })}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => {
          const mine = plan.code === currentCode;
          const paid = plan.priceMonthly > 0;
          const popular = plan.code === "rocket";
          const months = plan.orderPack ? 1 : term;
          const total = planAmount(plan, months);
          const full = plan.priceMonthly * months;
          const domain = plan.features.includes("custom_domain");
          return (
            <Card key={plan.id} className={`relative flex flex-col gap-4 ${mine ? "border-2 border-accent" : popular ? "border-accent/40 bg-accent-soft/30" : ""}`} data-plan-card={plan.code}>
              {popular && (
                <span className="absolute -top-3 start-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-accent/30 bg-panel px-3 py-0.5 text-xs font-semibold text-accent-ink rtl:translate-x-1/2">
                  <Sparkles size={12} /> {b.mostPopular}
                </span>
              )}
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-bold">{plan.name}</h3>
                {mine && <Badge tone="accent">{p.yours}</Badge>}
              </div>
              <div>
                <p className="text-3xl font-extrabold tracking-tight" data-testid="plan-price">
                  {paid ? formatPrice(total, t.common.currency) : p.free}
                </p>
                {paid && (
                  <p className="mt-1 text-xs text-muted">
                    {plan.orderPack ? priceLabel(plan, t) : months > 1 ? fmt(b.forTerm, { price: formatPrice(total, t.common.currency), n: months }) : p.monthly}
                    {full > total && (
                      <span className="ms-1">
                        · <s>{formatPrice(full, t.common.currency)}</s> <span className="font-semibold text-accent-ink">{fmt(b.save, { n: termDiscount(months) })}</span>
                      </span>
                    )}
                  </p>
                )}
                <p className="mt-1 text-sm text-muted">{(p.taglines as Record<string, string>)[plan.code] ?? ""}</p>
              </div>
              <ul className="space-y-1.5 text-sm">
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
                <li className={`flex items-center gap-2 ${domain ? "" : "text-muted"}`}>
                  {domain ? <Check size={15} className="shrink-0 text-accent" /> : <X size={15} className="shrink-0" />}
                  {domain ? b.domain : b.noDomain}
                </li>
              </ul>
              <div className="space-y-2">
                <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">{b.integrations}</p>
                <div className="flex flex-wrap gap-1.5">
                  {b.integrationList.map((x) => (
                    <span key={x} className="rounded-md border border-line bg-panel-2 px-2 py-0.5 text-xs">
                      {x}
                    </span>
                  ))}
                </div>
                <p className="pt-1 text-[11px] font-semibold tracking-wider text-muted uppercase">{b.features}</p>
                <div className="flex flex-wrap gap-1.5">
                  {b.featureList.map((x) => (
                    <span key={x} className="rounded-md border border-line bg-panel-2 px-2 py-0.5 text-xs">
                      {x}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-auto pt-2">
                {paid ? (
                  <Button className={`w-full ${popular ? "" : "bg-ink text-white hover:bg-ink/90"}`} disabled={Boolean(pending) || busy || (way === "online" && !gateway)} onClick={() => subscribe(plan)} data-action="subscribe">
                    <CreditCard size={15} /> {mine ? (plan.orderPack ? p.topUp : p.renew) : fmt(b.subscribe, { name: plan.name })}
                  </Button>
                ) : (
                  <Button variant="secondary" className="w-full" disabled>
                    {mine ? b.active : p.free}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
        <CustomPlanCard whatsapp={payment.methods.whatsapp} t={t} />
      </div>
      {chosen && !pending && <RequestForm key={`${chosen.id}-${term}`} lang={lang} plan={chosen} payment={payment} shopName={shopName} onClose={() => setChosen(null)} referral={referral} initialMonths={term} t={t} />}
    </div>
  );
}

// Plans → Feature packs (Zimam): extra quota for this month, paid with credits
export function FeaturePacks({ lang, credits, t }: { lang: string; credits: number; t: Text }) {
  const b = t.plans.billing;
  const e = t.errors as Record<string, string>;
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  return (
    <Card className="space-y-4" data-testid="feature-packs">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Package size={18} className="text-accent" /> {b.packsTitle}
      </h2>
      <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">{b.packsHint}</p>
      {msg && <Alert variant={msg.ok ? "success" : "error"}>{msg.text}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        {quotaPacks.map((pack) => {
          const name = (b.packs as Record<string, string>)[pack.key];
          return (
            <div key={pack.key} className="space-y-3 rounded-xl border border-line p-4" data-pack={pack.key}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{name}</p>
                  <p className="text-xs text-muted">
                    {name} · {fmt(b.packCost, { n: pack.credits })}
                  </p>
                </div>
                <Package size={16} className="text-accent" />
              </div>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={busy || credits < pack.credits}
                onClick={() =>
                  start(async () => {
                    const r = await buyQuotaPack(lang, pack.key);
                    setMsg(r.ok ? { ok: true, text: b.bought } : { ok: false, text: e[r.error ?? "unexpected"] ?? e.unexpected });
                  })
                }
                data-action="buy-pack"
              >
                {fmt(b.buy, { name })}
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
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
