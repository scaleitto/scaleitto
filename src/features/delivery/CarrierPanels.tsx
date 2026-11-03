"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleCheck, Clock, Search, Star, Trash2 } from "lucide-react";
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
  if (!accounts.length) return null;
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
function AccountDefaults({ lang, account, t, alwaysOpen = false }: { lang: string; account: CarrierAccountRow; t: DeliveryText; alwaysOpen?: boolean }) {
  const o = t.delivery.options;
  const [open, setOpen] = useState(alwaysOpen);
  const [value, setValue] = useState(() => ({ ...defaultParcelOptions, ...(account.options ?? {}) }));
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <div className="pt-1" data-testid="account-defaults">
      {!alwaysOpen && (
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="text-xs font-semibold text-accent hover:underline">
          {o.defaults}
        </button>
      )}
      {open && (
        <div className={alwaysOpen ? "space-y-3" : "mt-3 space-y-3 rounded-lg border border-line bg-panel-2/50 p-3"}>
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
    <form onSubmit={onSubmit} noValidate className="space-y-4" data-connect={carrier.key}>
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
      <SubmitButton pending={pending} pendingText={t.common.loading} className="h-12 w-full text-base">
        {d.saveConnection}
      </SubmitButton>
    </form>
  );
}

// Zimam's catalog: a search box, then one card per company (mark, name, status, a wide "Integrate" button that opens the
// company's own page)
export function CarrierCatalog({ connected, base, t }: { connected: string[]; base: string; t: DeliveryText }) {
  const d = t.delivery;
  const [q, setQ] = useState("");
  const shown = carriers.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="space-y-5">
      <div className="relative max-w-sm">
        <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={d.searchCompanies} aria-label={d.searchCompanies} className="ps-9" data-testid="carrier-search" />
      </div>
      <div>
        <h2 className="font-semibold">{d.available}</h2>
        <p className="text-sm text-muted">{d.availableHint}</p>
      </div>
      <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((c) => {
          const isConnected = connected.includes(c.key);
          return (
            <Card key={c.key} className="space-y-4 p-4" data-carrier={c.key}>
              <div className="flex items-center gap-3">
                <CarrierMark name={c.name} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{c.name}</span>
                  <span className={`block text-xs ${isConnected ? "text-accent" : "text-muted"}`}>{!c.platform ? d.soon : isConnected ? d.integrated : d.notIntegrated}</span>
                </span>
              </div>
              <Link
                href={`${base}/carriers/${c.key}`}
                className={`flex h-10 w-full items-center justify-center gap-2 rounded-[10px] text-sm font-semibold transition-colors ${!c.platform ? "border border-line text-muted hover:bg-panel-2" : isConnected ? "border border-line bg-panel hover:bg-panel-2" : "bg-accent text-white hover:bg-accent/90"}`}
              >
                {c.platform ? <CircleCheck size={15} /> : <Clock size={15} />} {!c.platform ? d.soonHint : isConnected ? d.update : d.connect}
              </Link>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// One company's page (Zimam): back, its mark and name, the connection details (save / delete), then how its parcels are sent
export function CarrierSetup({ lang, carrier, account, wilayas, backHref, t }: { lang: string; carrier: CarrierInfo; account: CarrierAccountRow | null; wilayas: { code: number; name: string }[]; backHref: string; t: DeliveryText }) {
  const d = t.delivery;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mx-auto max-w-3xl space-y-6" data-testid="carrier-setup" data-carrier-page={carrier.key}>
      <div className="flex items-center gap-4">
        <Link href={backHref} aria-label={t.common.back} className="grid size-10 place-items-center rounded-lg text-fg-2 hover:bg-panel-2">
          <ArrowRight size={20} className="ltr:rotate-180" />
        </Link>
        <span className="grid size-20 place-items-center rounded-2xl border border-line bg-panel">
          <CarrierMark name={carrier.name} />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{carrier.name}</h1>
          <p className="text-sm text-muted">{d.setupHint}</p>
        </div>
      </div>
      <Card className="space-y-4 p-6">
        {!carrier.platform ? (
          <p className="flex items-start gap-2 rounded-xl border border-dashed border-line p-4 text-sm text-muted" data-testid="carrier-soon">
            <Clock size={16} className="mt-0.5 shrink-0" /> {d.soonPage}
          </p>
        ) : (
          <>
            {account && (
              <p className="flex items-center gap-2 text-sm font-semibold text-accent" data-account={carrier.key}>
                <CircleCheck size={16} /> {d.integrated}
                {account.isDefault && <Badge tone="accent">{d.isDefault}</Badge>}
              </p>
            )}
            <ConnectForm lang={lang} carrier={carrier} wilayas={wilayas} t={t} onDone={() => router.push(`${backHref}?connected=${carrier.key}`)} />
            {account && (
              <Button
                type="button"
                variant="danger"
                className="h-12 w-full text-base"
                disabled={pending}
                onClick={() => {
                  if (confirm(d.confirmDisconnect))
                    start(async () => {
                      const r = await disconnectCarrier(lang, account.id);
                      if (r.ok) router.push(backHref);
                      else setError(errorText(t, r));
                    });
                }}
                data-testid="delete-connection"
              >
                <Trash2 size={16} /> {d.deleteConnection}
              </Button>
            )}
            {error && <Alert>{error}</Alert>}
          </>
        )}
      </Card>
      {carrier.platform && (
        <Card className="space-y-3 p-6">
          <h2 className="font-semibold">{d.options.defaults}</h2>
          {account ? <AccountDefaults lang={lang} account={account} t={t} alwaysOpen /> : <p className="text-sm text-muted">{d.connectFirst}</p>}
        </Card>
      )}
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
    <span className="flex size-14 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white" style={{ background: color }} aria-hidden>
      {initials}
    </span>
  );
}
