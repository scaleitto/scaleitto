"use client";

import { useState, useTransition } from "react";
import { Ban, Bot, Gauge, ShieldCheck } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { ProtectionSettings } from "@/lib/enums";
import { Alert, Button, Card, Field, Input } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { saveProtection, setPhoneBlocked } from "./actions";

type Text = Pick<Dictionary, "orders" | "errors" | "common">;

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]" />
      <span>{label}</span>
    </label>
  );
}

// The store's fake-order protection: limits, robots, risk score
export function ProtectionForm({ lang, settings, t }: { lang: string; settings: ProtectionSettings; t: Text }) {
  const p = t.orders.protection;
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(saveProtection.bind(null, lang));
  const num = (name: keyof ProtectionSettings, label: string, min: number, max: number, hint?: string) => (
    <Field label={label} htmlFor={`pr-${name}`} hint={hint} error={fieldError(state, e, name)}>
      <Input id={`pr-${name}`} name={name} type="number" min={min} max={max} dir="ltr" defaultValue={settings[name] as number} className="max-w-32" />
    </Field>
  );
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" data-testid="protection-form">
      <FormMessage state={state} errors={e} success={p.saved} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <Ban size={17} className="text-accent" /> {p.limits}
          </h2>
          {num("maxPerPhonePerDay", p.maxPerPhonePerDay, 1, 50)}
          {num("maxPerIpPerHour", p.maxPerIpPerHour, 1, 500)}
          <Check name="blockDuplicates" label={p.blockDuplicates} defaultChecked={settings.blockDuplicates} />
        </Card>
        <Card className="space-y-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <Bot size={17} className="text-accent" /> {p.bots}
          </h2>
          {num("minFillSeconds", p.minFillSeconds, 0, 60, p.minFillSecondsHint)}
          <Check name="blockBots" label={p.blockBots} defaultChecked={settings.blockBots} />
        </Card>
        <Card className="space-y-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <Gauge size={17} className="text-accent" /> {p.risk}
          </h2>
          {num("riskThreshold", p.riskThreshold, 10, 100, p.riskThresholdHint)}
          <Check name="holdSuspicious" label={p.holdSuspicious} defaultChecked={settings.holdSuspicious} />
          <Check name="useNetwork" label={p.useNetwork} defaultChecked={settings.useNetwork} />
        </Card>
      </div>
      <SubmitButton pending={pending} pendingText={t.common.loading}>
        {p.save}
      </SubmitButton>
    </form>
  );
}

// Numbers that can no longer order: add one by hand, or unblock
export function BlockedPhones({ lang, phones, t }: { lang: string; phones: { phone: string; reason: string | null; date: string }[]; t: Text }) {
  const p = t.orders.protection;
  const e = t.errors as Record<string, string>;
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok?: boolean; error?: string }>, after?: () => void) =>
    startTransition(async () => {
      const r = await fn();
      setError(r.ok ? null : (e[r.error ?? "unexpected"] ?? e.unexpected));
      if (r.ok) after?.();
    });
  return (
    <Card className="space-y-4" data-testid="blocked-phones">
      <h2 className="flex items-center gap-2 font-semibold">
        <ShieldCheck size={17} className="text-accent" /> {p.blocked}
      </h2>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={p.phone} htmlFor="bp-phone">
          <Input id="bp-phone" dir="ltr" inputMode="tel" value={phone} onChange={(ev) => setPhone(ev.target.value)} className="w-44" />
        </Field>
        <div className="min-w-48 flex-1">
          <Field label={p.reason} htmlFor="bp-reason">
            <Input id="bp-reason" value={reason} maxLength={200} onChange={(ev) => setReason(ev.target.value)} />
          </Field>
        </div>
        <Button variant="danger" disabled={pending || !phone.trim()} onClick={() => run(() => setPhoneBlocked(lang, phone, true, reason), () => (setPhone(""), setReason("")))} data-testid="block-phone">
          <Ban size={15} /> {p.block}
        </Button>
      </div>
      {error && <Alert>{error}</Alert>}
      {phones.length === 0 ? (
        <p className="text-sm text-muted">{p.blockedEmpty}</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {phones.map((b) => (
            <li key={b.phone} className="flex flex-wrap items-center gap-3 py-2.5" data-blocked={b.phone}>
              <span className="font-semibold tabular-nums" dir="ltr">
                {b.phone}
              </span>
              <span className="me-auto text-muted">{b.reason}</span>
              <span className="text-xs text-muted">{b.date}</span>
              <Button variant="secondary" className="px-2 py-1 text-xs" disabled={pending} onClick={() => run(() => setPhoneBlocked(lang, b.phone, false))}>
                {p.unblock}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
