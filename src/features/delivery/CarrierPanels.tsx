"use client";

import { useState, useTransition } from "react";
import { CircleCheck, Link2, Star, Trash2 } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { ActionState } from "@/lib/action";
import { Alert, Badge, Button, Card, Field, Input, Select } from "@/ui";
import { SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { carriers, platformFields, type CarrierInfo } from "./carriers";
import { connectCarrier, disconnectCarrier, saveCarrierDefaults, setDefaultCarrier } from "./actions";
import { defaultParcelOptions } from "@/lib/enums";
import { ParcelOptionsFields } from "./ParcelOptions";
import type { CarrierAccountRow } from "./queries";

export type DeliveryText = Pick<Dictionary, "delivery" | "errors" | "common">;

const carrierName = (key: string) => carriers.find((c) => c.key === key)?.name ?? key;

// Turns an action result into a message (carrier errors carry the company's own words).
function errorText(t: DeliveryText, state: ActionState) {
  const errors = t.errors as Record<string, string>;
  if (!state.error || state.error === "checkFields") return null;
  const base = errors[state.error] ?? errors.unexpected;
  return state.message ? `${base}: ${state.message}` : base;
}

export function ConnectedAccounts({ lang, accounts, wilayaNames, t }: { lang: string; accounts: CarrierAccountRow[]; wilayaNames: Record<number, string>; t: DeliveryText }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionState>) =>
    startTransition(async () => {
      const r = await fn();
      setError(r.ok ? null : errorText(t, r));
    });
  const d = t.delivery;
  if (!accounts.length) return <Alert variant="info">{d.noneConnected}</Alert>;
  return (
    <div className="space-y-3">
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-3 md:grid-cols-2">
        {accounts.map((a) => (
          <Card key={a.id} className="space-y-2" data-account={a.carrier}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="flex items-center gap-2 font-semibold">
                  <CircleCheck size={16} className="text-accent" /> {carrierName(a.carrier)}
                  {a.isDefault && <Badge tone="accent">{d.isDefault}</Badge>}
                </p>
                <p className="truncate text-xs text-muted" dir="ltr">
                  {a.baseUrl.replace(/^https:\/\//, "")}
                </p>
                <p className="text-xs text-muted">
                  {d.originWilaya}: {wilayaNames[a.originWilaya]}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {!a.isDefault && (
                  <Button variant="ghost" className="px-2 py-1 text-xs" disabled={pending} onClick={() => run(() => setDefaultCarrier(lang, a.id))}>
                    <Star size={14} /> {d.makeDefault}
                  </Button>
                )}
                <Button
                  variant="danger"
                  className="px-2 py-1 text-xs"
                  disabled={pending}
                  aria-label={d.disconnect}
                  onClick={() => {
                    if (confirm(d.confirmDisconnect)) run(() => disconnectCarrier(lang, a.id));
                  }}
                >
                  <Trash2 size={14} /> {d.disconnect}
                </Button>
              </div>
            </div>
            <AccountDefaults lang={lang} account={a} t={t} />
          </Card>
        ))}
      </div>
    </div>
  );
}

// What every parcel sent with this company starts from (type, fragile, weight, note)
function AccountDefaults({ lang, account, t }: { lang: string; account: CarrierAccountRow; t: DeliveryText }) {
  const o = t.delivery.options;
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(() => ({ ...defaultParcelOptions, ...(account.options ?? {}) }));
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <div className="pt-1" data-testid="account-defaults">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="text-xs font-semibold text-accent hover:underline">
        {o.defaults}
      </button>
      {open && (
        <div className="mt-3 space-y-3 rounded-lg border border-line bg-panel-2/50 p-3">
          <p className="text-xs text-muted">{o.defaultsHint}</p>
          <ParcelOptionsFields value={value} onChange={(v) => (setValue(v), setSaved(false))} idPrefix={`def-${account.carrier}`} defaultsOnly t={t} />
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              className="py-1.5 text-xs"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await saveCarrierDefaults(lang, account.id, value);
                  setSaved(Boolean(r.ok));
                })
              }
            >
              {o.saveDefaults}
            </Button>
            {saved && <span className="text-xs font-semibold text-[#047857]">{t.common.saved}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function ConnectForm({ lang, carrier, wilayas, t, onDone }: { lang: string; carrier: CarrierInfo; wilayas: { code: number; name: string }[]; t: DeliveryText; onDone: () => void }) {
  const d = t.delivery;
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(async (prev: ActionState, fd: FormData) => {
    const r = await connectCarrier(lang, prev, fd);
    if (r.ok) onDone();
    return r;
  });
  const message = errorText(t, state);
  return (
    <form onSubmit={onSubmit} noValidate className="mt-4 space-y-3 border-t border-line pt-4" data-connect={carrier.key}>
      <input type="hidden" name="carrier" value={carrier.key} />
      <p className="text-xs text-muted">{d.credentialsHint}</p>
      {!carrier.baseUrl && (
        <Field label={d.baseUrl} htmlFor={`${carrier.key}-baseUrl`} hint={d.baseUrlHint} error={fieldError(state, e, "baseUrl")}>
          <Input id={`${carrier.key}-baseUrl`} name="baseUrl" dir="ltr" placeholder="name.ecotrack.dz" />
        </Field>
      )}
      {platformFields[carrier.platform!].map((field) => (
        <Field key={field} label={d.fields[field]} htmlFor={`${carrier.key}-${field}`} error={fieldError(state, e, field)}>
          <Input id={`${carrier.key}-${field}`} name={field} dir="ltr" autoComplete="off" spellCheck={false} />
        </Field>
      ))}
      <Field label={d.originWilaya} htmlFor={`${carrier.key}-origin`}>
        <Select id={`${carrier.key}-origin`} name="originWilaya" defaultValue={16}>
          {wilayas.map((w) => (
            <option key={w.code} value={w.code}>
              {w.name}
            </option>
          ))}
        </Select>
      </Field>
      {message && <Alert>{message}</Alert>}
      {state.error === "checkFields" && <Alert>{e.checkFields}</Alert>}
      <SubmitButton pending={pending} pendingText={t.common.loading}>
        {d.connect}
      </SubmitButton>
    </form>
  );
}

export function CarrierCatalog({ lang, connected, wilayas, t }: { lang: string; connected: string[]; wilayas: { code: number; name: string }[]; t: DeliveryText }) {
  const d = t.delivery;
  const [open, setOpen] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      {done && <Alert variant="success">{`${d.connectedOk}: ${carrierName(done)}`}</Alert>}
      <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {carriers.map((c) => {
          const isConnected = connected.includes(c.key);
          return (
            <Card key={c.key} className="p-4" data-carrier={c.key}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 font-semibold">
                  <CarrierMark name={c.name} />
                  <span className="truncate">{c.name}</span>
                </span>
                {!c.platform ? (
                  <Badge tone="warning">{d.soon}</Badge>
                ) : (
                  <Button variant={isConnected ? "ghost" : "secondary"} className="px-3 py-1 text-xs" onClick={() => setOpen(open === c.key ? null : c.key)}>
                    <Link2 size={14} /> {isConnected ? d.update : d.connect}
                  </Button>
                )}
              </div>
              {!c.platform && <p className="mt-2 text-xs text-muted">{d.soonHint}</p>}
              {open === c.key && c.platform && (
                <ConnectForm
                  lang={lang}
                  carrier={c}
                  wilayas={wilayas}
                  t={t}
                  onDone={() => {
                    setOpen(null);
                    setDone(c.key);
                  }}
                />
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// Initials on a color picked from the name, so each company is recognisable at a glance
const markColors = ["#16a34a", "#0369a1", "#b45309", "#7c3aed", "#be123c", "#0f766e", "#4d7c0f", "#1d4ed8"];
function CarrierMark({ name }: { name: string }) {
  const words = name.replace(/\(.*\)/, "").trim().split(/\s+/);
  const initials = (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
  const color = markColors[[...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % markColors.length];
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold text-white" style={{ background: color }} aria-hidden>
      {initials}
    </span>
  );
}
