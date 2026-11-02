"use client";

import { useState, useTransition } from "react";
import { CircleCheck, CreditCard, Wallet } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt } from "@/lib/format";
import { Button, Card, Field, Input, Select } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import type { PaymentProvider } from "@/server/db/schema";
import { removePaymentAccount, savePaymentAccount } from "./actions";

type Text = Pick<Dictionary, "apps" | "errors" | "common">;
export type PaymentAccountView = { provider: PaymentProvider; mode: "test" | "live"; feesOnBuyer: boolean; checkedAt: string | null; hint: string } | null;

function ProviderCard({ lang, provider, view, t }: { lang: string; provider: PaymentProvider; view: PaymentAccountView; t: Text }) {
  const p = t.apps.payments;
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(savePaymentAccount.bind(null, lang, provider));
  const [busy, start] = useTransition();
  const err = (f: string) => fieldError(state, e, f);
  const Icon = provider === "chargily" ? CreditCard : Wallet;
  return (
    <Card className="space-y-4 p-6" data-payment-provider={provider} data-state={view ? "on" : "off"}>
      <div className="flex items-start gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{provider === "chargily" ? "Chargily" : "SlickPay"}</h2>
          <p className="text-sm text-muted">{provider === "chargily" ? p.chargilyHint : p.slickpayHint}</p>
        </div>
        {view && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent-ink">
            <CircleCheck size={13} /> {view.mode === "live" ? p.live : p.test}
          </span>
        )}
      </div>
      {view && <p className="text-xs text-muted">{fmt(p.connected, { key: view.hint, at: view.checkedAt ?? "—" })}</p>}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormMessage state={state} errors={e} success={p.saved} />
        {state.error === "paymentTest" && state.message && (
          <p className="text-xs text-danger" dir="auto">
            {state.message}
          </p>
        )}
        {provider === "chargily" ? (
          <Field label={p.secretKey} htmlFor={`${provider}-secret`} error={err("secretKey")} hint={view ? p.keepKey : p.secretKeyHint}>
            <Input id={`${provider}-secret`} name="secretKey" type="password" dir="ltr" autoComplete="off" placeholder="test_sk_…" />
          </Field>
        ) : (
          <>
            <Field label={p.publicKey} htmlFor={`${provider}-public`} error={err("publicKey")} hint={view ? p.keepKey : undefined}>
              <Input id={`${provider}-public`} name="publicKey" type="password" dir="ltr" autoComplete="off" />
            </Field>
            <Field label={p.contactId} htmlFor={`${provider}-contact`} error={err("contactId")} hint={p.contactIdHint}>
              <Input id={`${provider}-contact`} name="contactId" dir="ltr" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
            </Field>
          </>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={p.mode} htmlFor={`${provider}-mode`}>
            <Select id={`${provider}-mode`} name="mode" defaultValue={view?.mode ?? "test"}>
              <option value="test">{p.test}</option>
              <option value="live">{p.live}</option>
            </Select>
          </Field>
          {provider === "chargily" && (
            <Field label={p.fees} htmlFor={`${provider}-fees`}>
              <Select id={`${provider}-fees`} name="fees" defaultValue={view?.feesOnBuyer ? "buyer" : "merchant"}>
                <option value="merchant">{p.feesMerchant}</option>
                <option value="buyer">{p.feesBuyer}</option>
              </Select>
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
                if (confirm(p.confirmRemove)) start(async () => void (await removePaymentAccount(lang, provider)));
              }}
            >
              {p.remove}
            </Button>
          )}
          <SubmitButton pending={pending} pendingText={t.common.loading} data-testid={`${provider}-save`}>
            {p.saveTest}
          </SubmitButton>
        </div>
      </form>
    </Card>
  );
}

// Zimam's Online payments: Chargily and SlickPay with the merchant's own accounts (the money goes straight to them)
export function PaymentsApp({ lang, accounts, t }: { lang: string; accounts: Record<PaymentProvider, PaymentAccountView>; t: Text }) {
  return (
    <div className="space-y-5">
      <ProviderCard lang={lang} provider="chargily" view={accounts.chargily} t={t} />
      <ProviderCard lang={lang} provider="slickpay" view={accounts.slickpay} t={t} />
    </div>
  );
}
