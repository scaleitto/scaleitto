"use client";

import { useState, useTransition } from "react";
import { Building2, CircleCheck, CreditCard, Landmark, Mail, Wallet, type LucideIcon } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt } from "@/lib/format";
import { Button, Card, Field, Input, Select } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { connectors, onlineMethods, type ConnectorId, type OnlineMethod } from "./methods";
import { removePaymentMethod, savePaymentMethod } from "./actions";

type Text = Pick<Dictionary, "apps" | "errors" | "common">;
// What the page knows about a connected method (never its secrets)
export type MethodView = { connector: ConnectorId; mode: "test" | "live"; currency: "dzd" | "eur" | "usd"; rate: number; checkedAt: string | null; values: Record<string, string>; live: boolean } | null;

const icons: Record<OnlineMethod, LucideIcon> = { stripe: CreditCard, paypal: Wallet, cib: Landmark, edahabia: Mail };

function MethodCard({ lang, method, view, t }: { lang: string; method: OnlineMethod; view: MethodView; t: Text }) {
  const p = t.apps.payments;
  const e = t.errors as Record<string, string>;
  const options = connectors[method];
  const { state, pending, onSubmit } = useActionForm(savePaymentMethod.bind(null, lang, method));
  const [connectorId, setConnectorId] = useState<ConnectorId>(view?.connector ?? options.find((c) => c.ready)?.id ?? options[0].id);
  const connector = options.find((c) => c.id === connectorId) ?? options[0];
  const [currency, setCurrency] = useState(view?.currency ?? connector.currencies[0]);
  const [busy, start] = useTransition();
  const err = (f: string) => fieldError(state, e, f);
  const Icon = icons[method];
  const status = !options.some((c) => c.ready) ? "unavailable" : view?.live ? "active" : "off";
  return (
    <Card className="space-y-4 p-6" data-payment-method={method} data-state={status}>
      <div className="flex items-start gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{p.methods[method].name}</h2>
          <p className="text-sm text-muted">{p.methods[method].hint}</p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${status === "active" ? "bg-accent-soft text-accent-ink" : "bg-panel-2 text-muted"}`} data-testid={`${method}-status`}>
          {status === "active" && <CircleCheck size={13} />} {p.statuses[status]}
          {status === "active" && view && ` · ${view.mode === "live" ? p.live : p.test}`}
        </span>
      </div>
      {view && <p className="text-xs text-muted">{fmt(p.connected, { connector: p.connectors[view.connector], at: view.checkedAt ?? "—" })}</p>}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormMessage state={state} errors={e} success={p.saved} />
        {state.error === "paymentTest" && state.message && (
          <p className="text-xs text-danger" dir="auto">
            {state.message}
          </p>
        )}
        {options.length > 1 && (
          <Field label={p.connector} htmlFor={`${method}-connector`}>
            <Select id={`${method}-connector`} name="connector" value={connectorId} onChange={(ev) => setConnectorId(ev.target.value as ConnectorId)} data-testid={`${method}-connector`}>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {p.connectors[c.id]}
                  {c.ready ? "" : ` (${p.statuses.unavailable})`}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {options.length === 1 && <input type="hidden" name="connector" value={connectorId} />}
        {!connector.ready ? (
          <p className="flex items-start gap-2 rounded-xl border border-dashed border-line p-3 text-sm text-muted" data-testid={`${method}-unavailable`}>
            <Building2 size={16} className="mt-0.5 shrink-0" /> {p.unavailable}
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {connector.fields.map((f) => (
                <Field key={f.key} label={p.fields[f.key as keyof typeof p.fields]} htmlFor={`${method}-${f.key}`} error={err(f.key)} hint={f.secret && view ? p.keepKey : p.hints[f.key as keyof typeof p.hints]}>
                  <Input id={`${method}-${f.key}`} name={f.key} type={f.secret ? "password" : "text"} dir="ltr" autoComplete="off" defaultValue={f.secret ? "" : (view?.connector === connector.id ? (view.values[f.key] ?? "") : "")} />
                </Field>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={p.mode} htmlFor={`${method}-mode`}>
                <Select id={`${method}-mode`} name="mode" defaultValue={view?.mode ?? "test"}>
                  <option value="test">{p.test}</option>
                  <option value="live">{p.live}</option>
                </Select>
              </Field>
              {connector.currencies.length > 1 || connector.currencies[0] !== "dzd" ? (
                <Field label={p.currency} htmlFor={`${method}-currency`}>
                  <Select id={`${method}-currency`} name="currency" value={currency} onChange={(ev) => setCurrency(ev.target.value as typeof currency)}>
                    {connector.currencies.map((c) => (
                      <option key={c} value={c}>
                        {p.currencies[c]}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <input type="hidden" name="currency" value="dzd" />
              )}
              {currency !== "dzd" && (
                <Field label={p.rate} htmlFor={`${method}-rate`} hint={p.rateHint} error={err("rate")}>
                  <Input id={`${method}-rate`} name="rate" inputMode="decimal" dir="ltr" defaultValue={view && view.currency !== "dzd" ? view.rate : ""} placeholder="145" />
                </Field>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {view && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    if (confirm(p.confirmRemove)) start(async () => void (await removePaymentMethod(lang, method)));
                  }}
                >
                  {p.remove}
                </Button>
              )}
              <SubmitButton pending={pending} pendingText={t.common.loading} data-testid={`${method}-save`}>
                {p.saveTest}
              </SubmitButton>
            </div>
          </>
        )}
      </form>
    </Card>
  );
}

// Apps → Online payments: Stripe, PayPal, CIB and Edahabia, each separate and connected to the merchant's own account
export function PaymentsApp({ lang, views, t }: { lang: string; views: Record<OnlineMethod, MethodView>; t: Text }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {onlineMethods.map((m) => (
        <MethodCard key={m} lang={lang} method={m} view={views[m]} t={t} />
      ))}
    </div>
  );
}
