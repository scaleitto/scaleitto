"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { ActionState } from "@/lib/action";
import { limitKeys, planFeatures } from "@/lib/enums";
import { Button, Card, Field, Input, Select, Textarea } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { addContract, clearErrorLogs, endContract, sendTestMail, setShopPlan, setShopStatus, updatePlan } from "./actions";

type Text = Pick<Dictionary, "admin" | "plans" | "errors" | "common">;
type Plan = { id: string; code: string; name: string; priceMonthly: number; orderPack: number | null; isActive: boolean; limits: Partial<Record<(typeof limitKeys)[number], number | null>>; features: string[] };

// A button running one action, with a confirmation and its error message
function ActionButton({ run, confirmText, label, variant = "secondary", danger = false, t }: { run: () => Promise<ActionState>; confirmText?: string; label: string; variant?: "primary" | "secondary"; danger?: boolean; t: Text }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const e = t.errors as Record<string, string>;
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        variant={variant}
        disabled={pending}
        className={danger ? "hover:text-danger" : undefined}
        onClick={() => {
          if (confirmText && !confirm(confirmText)) return;
          startTransition(async () => {
            const r = await run().catch((): ActionState => ({ ok: false, error: "unexpected" }));
            setError(r.ok ? null : (e[r.error ?? "unexpected"] ?? e.unexpected));
          });
        }}
      >
        {label}
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}

export function ShopPlanForm({ lang, shopId, plans, planId, expiresOn, credits, t }: { lang: string; shopId: string; plans: { id: string; name: string }[]; planId: string; expiresOn: string; credits: number; t: Text }) {
  const s = t.admin.shop;
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(setShopPlan.bind(null, lang, shopId));
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3" data-testid="shop-plan-form">
      <FormMessage state={state} errors={e} success={t.common.saved} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={s.plan} htmlFor="sp-plan">
          <Select id="sp-plan" name="planId" defaultValue={planId}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={s.expiresOn} htmlFor="sp-expires" error={fieldError(state, e, "expiresOn")}>
          <Input id="sp-expires" name="expiresOn" type="date" dir="ltr" defaultValue={expiresOn} />
        </Field>
        <Field label={t.plans.credits} hint={s.creditsHint} htmlFor="sp-credits" error={fieldError(state, e, "credits")}>
          <Input id="sp-credits" name="credits" type="number" min={0} dir="ltr" defaultValue={credits} />
        </Field>
      </div>
      <SubmitButton pending={pending} pendingText={t.common.loading}>
        {s.savePlan}
      </SubmitButton>
    </form>
  );
}

export function ShopStatusButton({ lang, shopId, status, t }: { lang: string; shopId: string; status: "active" | "suspended"; t: Text }) {
  const s = t.admin.shop;
  return status === "active" ? (
    <ActionButton run={() => setShopStatus(lang, shopId, "suspended")} confirmText={s.confirmSuspend} label={s.suspend} danger t={t} />
  ) : (
    <ActionButton run={() => setShopStatus(lang, shopId, "active")} label={s.activate} variant="primary" t={t} />
  );
}

export function EndContractButton({ lang, shopId, contractId, t }: { lang: string; shopId: string; contractId: string; t: Text }) {
  return <ActionButton run={() => endContract(lang, shopId, contractId)} label={t.admin.shop.endContract} danger t={t} />;
}

export function ContractForm({ lang, shopId, today, t }: { lang: string; shopId: string; today: string; t: Text }) {
  const s = t.admin.shop;
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(addContract.bind(null, lang, shopId));
  const form = useRef<HTMLFormElement>(null);
  // A saved contract empties the form for the next one
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} onSubmit={onSubmit} noValidate className="space-y-3" data-testid="contract-form">
      <h3 className="text-sm font-semibold">{s.newContract}</h3>
      <FormMessage state={state} errors={e} success={t.common.saved} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={s.startDate} htmlFor="ct-start" error={fieldError(state, e, "startDate")}>
          <Input id="ct-start" name="startDate" type="date" dir="ltr" defaultValue={today} />
        </Field>
        <Field label={s.endDate} htmlFor="ct-end" error={fieldError(state, e, "endDate")}>
          <Input id="ct-end" name="endDate" type="date" dir="ltr" />
        </Field>
      </div>
      <p className="text-xs text-muted">{s.limitsHint}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {limitKeys.map((k) => (
          <Field key={k} label={t.plans.limits[k]} htmlFor={`ct-${k}`} error={fieldError(state, e, k)}>
            <Input id={`ct-${k}`} name={k} type="number" min={-1} dir="ltr" />
          </Field>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={s.price} htmlFor="ct-price" error={fieldError(state, e, "priceMonthly")}>
          <Input id="ct-price" name="priceMonthly" type="number" min={0} dir="ltr" />
        </Field>
        <Field label={s.threshold} htmlFor="ct-threshold" error={fieldError(state, e, "alertThreshold")}>
          <Input id="ct-threshold" name="alertThreshold" type="number" min={1} max={100} dir="ltr" defaultValue={80} />
        </Field>
      </div>
      <Field label={s.notes} htmlFor="ct-notes">
        <Textarea id="ct-notes" name="notes" rows={2} maxLength={2000} dir="auto" />
      </Field>
      <SubmitButton pending={pending} variant="secondary" pendingText={t.common.loading}>
        {s.addContract}
      </SubmitButton>
    </form>
  );
}

export function PlanEditor({ lang, plan, t }: { lang: string; plan: Plan; t: Text }) {
  const p = t.admin.plansEditor;
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(updatePlan.bind(null, lang, plan.id));
  return (
    <Card data-plan-editor={plan.code}>
      <form onSubmit={onSubmit} noValidate className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">{plan.name}</h2>
          <code className="text-xs text-muted">{plan.code}</code>
        </div>
        <FormMessage state={state} errors={e} success={t.common.saved} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={p.name} htmlFor={`pe-name-${plan.code}`} error={fieldError(state, e, "name")}>
            <Input id={`pe-name-${plan.code}`} name="name" maxLength={80} defaultValue={plan.name} />
          </Field>
          <Field label={`${p.price} (${t.common.currency})`} htmlFor={`pe-price-${plan.code}`} error={fieldError(state, e, "priceMonthly")}>
            <Input id={`pe-price-${plan.code}`} name="priceMonthly" type="number" min={0} dir="ltr" defaultValue={plan.priceMonthly} />
          </Field>
          <Field label={p.orderPack} hint={p.orderPackHint} htmlFor={`pe-pack-${plan.code}`} error={fieldError(state, e, "orderPack")}>
            <Input id={`pe-pack-${plan.code}`} name="orderPack" type="number" min={1} dir="ltr" defaultValue={plan.orderPack ?? ""} />
          </Field>
        </div>
        <p className="text-xs text-muted">{p.unlimitedHint}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {limitKeys.map((k) => (
            <Field key={k} label={t.plans.limits[k]} htmlFor={`pe-${plan.code}-${k}`} error={fieldError(state, e, k)}>
              <Input id={`pe-${plan.code}-${k}`} name={k} type="number" min={-1} dir="ltr" defaultValue={plan.limits[k] ?? ""} />
            </Field>
          ))}
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">{p.features}</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {planFeatures.map((f) => (
              <label key={f} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="features" value={f} defaultChecked={plan.features.includes(f)} className="size-4 accent-[var(--color-accent)]" />
                {t.admin.features[f]}
                {f === "custom_domain" && <span className="text-xs text-accent">({p.enforced})</span>}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={plan.isActive} className="size-4 accent-[var(--color-accent)]" />
          {p.active}
        </label>
        <SubmitButton pending={pending} pendingText={t.common.loading}>
          {p.save}
        </SubmitButton>
      </form>
    </Card>
  );
}

export function ClearErrorsButton({ lang, t }: { lang: string; t: Text }) {
  return <ActionButton run={() => clearErrorLogs(lang)} confirmText={t.admin.system.confirmClear} label={t.admin.system.clear} danger t={t} />;
}

// "Send me a test email": proves the SMTP settings work end to end
export function TestMailButton({ lang, t }: { lang: string; t: Text }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);
  const e = t.errors as Record<string, string>;
  return (
    <div className="space-y-2" data-testid="test-mail">
      <Button variant="secondary" disabled={pending} onClick={() => startTransition(async () => setResult(await sendTestMail(lang)))}>
        {pending ? t.common.loading : t.admin.system.testMail}
      </Button>
      {result && (
        <p className={`text-sm ${result.ok ? "text-accent" : "text-danger"}`} data-ok={result.ok}>
          {result.ok ? `${t.admin.system.testMailSent} ${result.message}` : `${e[result.error ?? "unexpected"] ?? e.unexpected}${result.message ? `: ${result.message}` : ""}`}
        </p>
      )}
    </div>
  );
}
