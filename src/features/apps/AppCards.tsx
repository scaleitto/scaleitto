"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Copy, ExternalLink, FileSpreadsheet, Link2, Send, Unplug, Webhook } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { ActionState } from "@/lib/action";
import { fmt } from "@/lib/format";
import { Alert, Badge, Button, Card, Field, Input, buttonClass } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import type { AppKey } from "@/server/db/schema";
import { backfillAction, disconnectApp, saveAppUrl, sendQueueNow, setAppActive, startApp, testAppAction } from "./actions";

export type AppsText = Pick<Dictionary, "apps" | "errors" | "common">;
export type AppView = { app: AppKey; url: string; active: boolean; secret: string; sheetUrl: string | null; lastError: string | null; waiting: number; queueError: string | null; script: string | null } | null;

function CopyBox({ value, label, rows = 3, t, testId }: { value: string; label: string; rows?: number; t: AppsText; testId?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        <Button
          type="button"
          variant="secondary"
          className="py-1 text-xs"
          onClick={() => {
            navigator.clipboard?.writeText(value).catch(() => {});
            setCopied(true);
          }}
        >
          <Copy size={13} /> {copied ? t.apps.copied : t.apps.copy}
        </Button>
      </div>
      <textarea readOnly dir="ltr" rows={rows} value={value} className="w-full rounded-lg border border-line bg-bg p-2 font-mono text-xs text-muted" data-testid={testId} />
    </div>
  );
}

// Buttons that run an action and show its answer (test, send, on/off, disconnect)
// What a successful test says: where the test row is for the sheet, the server's answer for a webhook
const testOkText = (app: AppKey, detail: string | undefined, t: AppsText) => (app === "google_sheets" ? fmt(t.apps.sheets.testOk, { sheet: detail ?? "Orders" }) : fmt(t.apps.testOk, { detail: detail ?? "" }));

function useRunner(t: AppsText) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const e = t.errors as Record<string, string>;
  const run = (fn: () => Promise<ActionState>, ok?: (r: ActionState) => string) =>
    startTransition(async () => {
      const r = await fn().catch((): ActionState => ({ ok: false, error: "unexpected" }));
      if (r.ok) setResult(ok ? { ok: true, text: ok(r) } : null);
      else setResult({ ok: false, text: `${e[r.error ?? "unexpected"] ?? e.unexpected}${r.message ? `: ${r.message}` : ""}` });
    });
  return { pending, result, run };
}

function UrlForm({ lang, app, url, label, placeholder, t }: { lang: string; app: AppKey; url: string; label: string; placeholder: string; t: AppsText }) {
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(saveAppUrl.bind(null, lang, app));
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <FormMessage state={state} errors={e} success={state.ok ? testOkText(app, state.message, t) : undefined} />
      {!state.ok && state.message && <p className="text-xs break-all text-muted" dir="ltr">{state.message}</p>}
      <Field label={label} htmlFor={`${app}-url`} error={fieldError(state, e, "url")}>
        <Input id={`${app}-url`} name="url" dir="ltr" defaultValue={url} placeholder={placeholder} />
      </Field>
      <SubmitButton pending={pending} pendingText={t.common.loading}>
        {t.apps.save}
      </SubmitButton>
    </form>
  );
}

function Status({ view, t }: { view: AppView; t: AppsText }) {
  if (!view) return <Badge>{t.apps.notConnected}</Badge>;
  if (!view.url) return <Badge tone="warning">{t.apps.waiting}</Badge>;
  return view.active ? <Badge tone="accent">{t.apps.connected}</Badge> : <Badge tone="warning">{t.apps.paused}</Badge>;
}

function AppCard({ icon, title, description, view, testId, children }: { icon: ReactNode; title: string; description: string; view: AppView; testId: string; children: ReactNode }) {
  return (
    <Card className="space-y-4" data-testid={testId} data-state={!view ? "off" : !view.url ? "waiting" : view.active ? "on" : "paused"}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">{icon}</span>
        <div className="me-auto min-w-0">
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-0.5 text-sm text-muted">{description}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

// On/off, test, (send last orders), disconnect — for a connected app
function ConnectedControls({ lang, view, extra, t }: { lang: string; view: NonNullable<AppView>; extra?: ReactNode; t: AppsText }) {
  const { pending, result, run } = useRunner(t);
  const [active, setActive] = useState(view.active);
  return (
    <div className="space-y-3">
      {result && <Alert variant={result.ok ? "success" : "error"}>{result.text}</Alert>}
      {view.waiting > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm" data-testid="app-queue" data-waiting={view.waiting}>
          <span className="me-auto">
            <span className="font-semibold">{fmt(t.apps.queue.waiting, { n: view.waiting })}</span>
            {view.queueError && (
              <span className="block text-xs break-all text-muted" dir="auto">
                {view.queueError}
              </span>
            )}
          </span>
          <Button variant="secondary" className="py-1.5 text-xs" disabled={pending} onClick={() => run(() => sendQueueNow(lang), (r) => fmt(t.apps.queue.sent, { n: (r.message ?? "0/0").split("/")[0], left: (r.message ?? "0/0").split("/")[1] }))}>
            <Send size={14} /> {t.apps.queue.sendNow}
          </Button>
        </div>
      )}
      {!result && view.lastError && (
        <div data-testid="last-error">
          <Alert>
            {t.apps.lastFailed} <span className="break-all" dir="auto">{view.lastError}</span>
          </Alert>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="me-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            disabled={pending}
            onChange={(ev) => {
              setActive(ev.target.checked);
              run(() => setAppActive(lang, view.app, ev.target.checked));
            }}
            className="size-4 accent-[var(--color-accent)]"
          />
          {t.apps.active}
        </label>
        <Button variant="secondary" className="py-1.5 text-xs" disabled={pending} onClick={() => run(() => testAppAction(lang, view.app), (r) => testOkText(view.app, r.message, t))}>
          <Send size={14} /> {t.apps.test}
        </Button>
        {view.app === "google_sheets" && (
          <Button variant="secondary" className="py-1.5 text-xs" disabled={pending} onClick={() => run(() => backfillAction(lang), (r) => fmt(t.apps.sheets.backfillOk, { n: r.message ?? "0" }))}>
            {t.apps.sheets.backfill}
          </Button>
        )}
        {view.sheetUrl && (
          <a href={view.sheetUrl} target="_blank" rel="noreferrer" className={buttonClass("primary", "py-1.5 text-xs")} data-testid="open-sheet">
            <ExternalLink size={14} /> {t.apps.sheets.open}
          </a>
        )}
        {extra}
        <Button
          variant="secondary"
          className="py-1.5 text-xs hover:text-danger"
          disabled={pending}
          onClick={() => {
            if (confirm(t.apps.confirmDisconnect)) run(() => disconnectApp(lang, view.app));
          }}
        >
          <Unplug size={14} /> {t.apps.disconnect}
        </Button>
      </div>
    </div>
  );
}

function ConnectButton({ lang, app, t }: { lang: string; app: AppKey; t: AppsText }) {
  const { pending, result, run } = useRunner(t);
  return (
    <>
      {result && <Alert>{result.text}</Alert>}
      <Button disabled={pending} onClick={() => run(() => startApp(lang, app))}>
        <Link2 size={16} /> {t.apps.connect}
      </Button>
    </>
  );
}

export function SheetsCard({ lang, view, t }: { lang: string; view: AppView; t: AppsText }) {
  const s = t.apps.sheets;
  const steps = view?.script && (
    <div className="space-y-4">
      <ol className="list-decimal space-y-1.5 ps-5 text-sm text-muted">
        {s.steps.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
      <div>
        <CopyBox value={view.script} label={s.script} rows={8} t={t} testId="sheets-script" />
        <p className="mt-1 text-xs text-warning">{s.scriptHint}</p>
      </div>
      <UrlForm lang={lang} app="google_sheets" url={view.url} label={s.url} placeholder="https://script.google.com/macros/s/…/exec" t={t} />
    </div>
  );
  return (
    <AppCard icon={<FileSpreadsheet size={20} />} title={s.title} description={s.description} view={view} testId="app-sheets">
      <Status view={view} t={t} />
      {!view ? (
        <ConnectButton lang={lang} app="google_sheets" t={t} />
      ) : !view.url ? (
        steps
      ) : (
        <>
          <p className="truncate text-xs text-muted" dir="ltr">
            {view.url}
          </p>
          <ConnectedControls lang={lang} view={view} t={t} />
          <details className="text-sm">
            <summary className="cursor-pointer text-xs text-muted hover:text-fg">{s.showScript}</summary>
            <div className="mt-3">{steps}</div>
          </details>
        </>
      )}
    </AppCard>
  );
}

export function EcomanagerCard({ sheets, t }: { sheets: AppView; t: AppsText }) {
  const em = t.apps.ecomanager;
  const ready = Boolean(sheets?.url && sheets.active);
  return (
    <AppCard icon={<FileSpreadsheet size={20} />} title={em.title} description={em.description} view={null} testId="app-ecomanager">
      <ol className="list-decimal space-y-1.5 ps-5 text-sm text-muted">
        {em.steps.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
      <Alert variant={ready ? "success" : "info"}>{ready ? em.ready : em.needsSheets}</Alert>
    </AppCard>
  );
}

export function WebhookCard({ lang, view, t }: { lang: string; view: AppView; t: AppsText }) {
  const w = t.apps.webhook;
  return (
    <AppCard icon={<Webhook size={20} />} title={w.title} description={w.description} view={view} testId="app-webhook">
      <Status view={view} t={t} />
      {!view ? (
        <ConnectButton lang={lang} app="webhook" t={t} />
      ) : (
        <div className="space-y-4">
          <div>
            <CopyBox value={view.secret} label={w.secret} rows={1} t={t} testId="webhook-secret" />
            <p className="mt-1 text-xs text-muted">{w.secretHint}</p>
          </div>
          <p className="text-xs text-muted">{w.events}</p>
          <UrlForm lang={lang} app="webhook" url={view.url} label={w.url} placeholder="https://hooks.zapier.com/…" t={t} />
          {view.url && <ConnectedControls lang={lang} view={view} t={t} />}
        </div>
      )}
    </AppCard>
  );
}
