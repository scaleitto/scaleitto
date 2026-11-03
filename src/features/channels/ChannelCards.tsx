"use client";

import { useState, useTransition } from "react";
import { Copy, Plug } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { ChannelKind } from "@/server/db/schema";
import { fmt } from "@/lib/format";
import { Badge, Button, Card, Field, Input, inputClass } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { connectChannel, disconnectChannel, setChannelActive } from "./actions";
import type { ChannelView } from "./queries";

type Text = Pick<Dictionary, "channels" | "errors">;
type PlatformKind = Exclude<ChannelKind, "google_sheets">;
const names: Record<PlatformKind, string> = { shopify: "Shopify", woocommerce: "WooCommerce" };

function CopyField({ label, value, testId, t }: { label: string; value: string; testId: string; t: Text }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="flex gap-2">
        <input readOnly value={value} dir="ltr" className={`${inputClass} text-xs`} data-testid={testId} />
        <Button
          type="button"
          variant="secondary"
          className="shrink-0"
          onClick={() => {
            void navigator.clipboard?.writeText(value);
            setCopied(true);
          }}
        >
          <Copy size={14} /> {copied ? t.channels.copied : t.channels.copy}
        </Button>
      </div>
    </div>
  );
}

// The status line every card shows (Zimam's "not connected / may miss orders")
export function CopyBox({ label, value, testId, t }: { label: string; value: string; testId: string; t: Text }) {
  return <CopyField label={label} value={value} testId={testId} t={t} />;
}

export function ChannelStatus({ connected, active, t }: { connected: boolean; active: boolean; t: Text }) {
  const c = t.channels;
  return (
    <div className="flex flex-wrap gap-2">
      <Badge tone={!connected ? "neutral" : active ? "accent" : "warning"}>{!connected ? c.notConnected : active ? c.connected : c.paused}</Badge>
      <span title={c.mayMissHint}>
        <Badge tone="orange">{c.mayMiss}</Badge>
      </span>
    </div>
  );
}

// Shopify / WooCommerce (Zimam): Shopify = store address + Admin API access token + webhook secret, checked and the webhook
// created at once; WooCommerce = the store's address and "Connect to WooCommerce" (approved on the store, then automatic).
// Connected: the receiving status, pause / reconnect / disconnect; a platform refusal shows the manual setup instead.
export function PlatformCard({ lang, kind, view, lastOrder, t }: { lang: string; kind: PlatformKind; view: ChannelView | null; lastOrder: string | null; t: Text }) {
  const c = t.channels;
  const k = c[kind];
  const errors = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(connectChannel.bind(null, lang, kind));
  const [editing, setEditing] = useState(!view || (kind === "woocommerce" && !view.ready && !view.error));
  const [busy, start] = useTransition();
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state.ok) setEditing(false);
  }
  const waiting = Boolean(view && !view.ready && !view.error);
  return (
    <Card className="space-y-4" data-channel={kind} data-state={!view || waiting ? "off" : view.active ? "on" : "paused"}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Plug size={18} className="text-accent" /> {names[kind]}
        </h2>
        <ChannelStatus connected={Boolean(view) && !waiting} active={view?.active ?? false} t={t} />
      </div>
      <p className="text-sm text-muted" data-testid="channel-receiving">
        {!view || waiting ? c.notReceiving : view.ordersCount ? fmt(c.receiving, { n: view.ordersCount, at: lastOrder ?? "" }) : c.receivingNone}
      </p>
      {waiting && kind === "woocommerce" && <p className="rounded-xl bg-warning/10 p-3 text-sm text-warning" data-testid="woo-waiting">{c.woocommerce.waiting}</p>}
      {view && !editing ? (
        <div className="space-y-3">
          <p className="text-sm font-medium" dir="ltr">
            {view.storeUrl}
          </p>
          {view.error ? (
            // The platform refused the automatic setup: the merchant adds the webhook by hand
            <div className="space-y-3" data-testid="channel-manual">
              <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger" dir="auto">
                {c.autoFailed} {view.error}
              </p>
              <CopyField label={c.url} value={view.url} testId="channel-url" t={t} />
              {view.secret && <CopyField label={c.secret} value={view.secret} testId="channel-secret" t={t} />}
              <div className="rounded-xl bg-panel-2 p-3 text-sm">
                <p className="mb-1 font-semibold">{c.stepsTitle}</p>
                <ol className="list-decimal space-y-1 ps-5 text-muted">
                  {k.manualSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            </div>
          ) : (
            view.ready && <p className="text-sm text-accent" data-testid="channel-auto">{c.autoDone}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={busy} onClick={() => start(async () => void (await setChannelActive(lang, kind, !view.active)))} data-testid="channel-toggle">
              {view.active ? c.pause : c.resume}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(true)}>
              {c.reconnect}
            </Button>
            <Button type="button" variant="danger" disabled={busy} onClick={() => confirm(c.confirmDisconnect) && start(async () => void (await disconnectChannel(lang, kind)))}>
              {c.disconnect}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label={`${k.storeUrl} *`} htmlFor={`${kind}-storeUrl`} hint={k.storeUrlHint} error={fieldError(state, errors, "storeUrl")}>
            <Input id={`${kind}-storeUrl`} name="storeUrl" dir="ltr" defaultValue={view?.storeUrl ?? ""} placeholder={kind === "shopify" ? "my-store.myshopify.com" : "https://my-store.com"} />
          </Field>
          {kind === "shopify" && (
            <>
              <Field label={`${c.shopify.token} *`} htmlFor="shopify-token" hint={c.shopify.tokenHint} error={fieldError(state, errors, "token")}>
                <Input id="shopify-token" name="token" dir="ltr" autoComplete="off" placeholder="shpat_…" />
              </Field>
              <Field label={`${c.shopify.secret} *`} htmlFor="shopify-secret" hint={c.shopify.secretHint} error={fieldError(state, errors, "secret")}>
                <Input id="shopify-secret" name="secret" dir="ltr" autoComplete="off" />
              </Field>
            </>
          )}
          <FormMessage state={state} errors={errors} />
          {state.error === "platformRefused" && state.message && (
            <p className="text-xs text-danger" dir="auto">
              {state.message}
            </p>
          )}
          <SubmitButton pending={pending} className="w-full" data-testid="channel-connect">
            {kind === "woocommerce" ? c.woocommerce.connect : c.save}
          </SubmitButton>
        </form>
      )}
    </Card>
  );
}
