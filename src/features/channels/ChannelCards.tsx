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
const names: Record<ChannelKind, string> = { shopify: "Shopify", woocommerce: "WooCommerce" };

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

// Shopify / WooCommerce: connect (Shopify: store address + Shopify's signing key; WooCommerce: store address, the key is
// made here), then the receiving address (and WooCommerce's key) to paste in the platform, pause / disconnect
export function PlatformCard({ lang, kind, view, lastOrder, t }: { lang: string; kind: ChannelKind; view: ChannelView | null; lastOrder: string | null; t: Text }) {
  const c = t.channels;
  const k = c[kind];
  const errors = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(connectChannel.bind(null, lang, kind));
  const [editing, setEditing] = useState(!view);
  const [busy, start] = useTransition();
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state.ok) setEditing(false);
  }
  return (
    <Card className="space-y-4" data-channel={kind} data-state={!view ? "off" : view.active ? "on" : "paused"}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Plug size={18} className="text-accent" /> {names[kind]}
        </h2>
        <ChannelStatus connected={Boolean(view)} active={view?.active ?? false} t={t} />
      </div>
      <p className="text-sm text-muted" data-testid="channel-receiving">
        {!view ? c.notReceiving : view.ordersCount ? fmt(c.receiving, { n: view.ordersCount, at: lastOrder ?? "" }) : c.receivingNone}
      </p>
      {view && !editing ? (
        <div className="space-y-3">
          <p className="text-sm font-medium" dir="ltr">
            {view.storeUrl}
          </p>
          <CopyField label={c.url} value={view.url} testId="channel-url" t={t} />
          {view.secret && <CopyField label={c.secret} value={view.secret} testId="channel-secret" t={t} />}
          <div className="rounded-xl bg-panel-2 p-3 text-sm">
            <p className="mb-1 font-semibold">{c.stepsTitle}</p>
            <ol className="list-decimal space-y-1 ps-5 text-muted">
              {k.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={busy} onClick={() => start(async () => void (await setChannelActive(lang, kind, !view.active)))} data-testid="channel-toggle">
              {view.active ? c.pause : c.resume}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(true)}>
              {c.save}
            </Button>
            <Button type="button" variant="danger" disabled={busy} onClick={() => confirm(c.confirmDisconnect) && start(async () => void (await disconnectChannel(lang, kind)))}>
              {c.disconnect}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <Field label={k.storeUrl} htmlFor={`${kind}-storeUrl`} hint={k.storeUrlHint} error={fieldError(state, errors, "storeUrl")}>
            <Input id={`${kind}-storeUrl`} name="storeUrl" dir="ltr" defaultValue={view?.storeUrl ?? ""} placeholder={kind === "shopify" ? "my-store.myshopify.com" : "https://my-store.com"} />
          </Field>
          {kind === "shopify" && (
            <Field label={c.shopify.secret} htmlFor="shopify-secret" hint={c.shopify.secretHint} error={fieldError(state, errors, "secret")}>
              <Input id="shopify-secret" name="secret" dir="ltr" autoComplete="off" />
            </Field>
          )}
          <FormMessage state={state} errors={errors} />
          <SubmitButton pending={pending} data-testid="channel-connect">
            {view ? c.save : c.connect}
          </SubmitButton>
        </form>
      )}
    </Card>
  );
}
