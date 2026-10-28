"use client";

import { MessageCircle, Send, Unplug } from "lucide-react";
import { fmt } from "@/lib/format";
import { Alert, Badge, Button, Card, Field, Input } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { useRunner, type AppsText } from "@/features/apps/AppCards";
import type { WhatsAppTemplate } from "@/server/db/schema";
import { messageKinds, placeholders, type MessageKind } from "./templates";
import { disconnectWhatsapp, saveWhatsapp, testWhatsappAction } from "./actions";

export type WhatsappView = { phoneNumberId: string; templates: Partial<Record<string, WhatsAppTemplate>> } | null;

// Apps → WhatsApp Business API: the number, the token (never shown back) and a template per situation
export function WhatsappCard({ lang, view, kindLabels, t }: { lang: string; view: WhatsappView; kindLabels: Record<MessageKind, string>; t: AppsText }) {
  const w = t.apps.whatsapp;
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(saveWhatsapp.bind(null, lang));
  const runner = useRunner(t);
  return (
    <Card className="space-y-4" data-testid="app-whatsapp" data-state={view ? "on" : "off"}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#25d366]/15 text-[#128c4b]">
          <MessageCircle size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold">{w.title}</h2>
            {view ? <Badge tone="accent">{t.apps.connected}</Badge> : <Badge>{t.apps.notConnected}</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted">{w.description}</p>
        </div>
      </div>
      <ol className="list-decimal space-y-1 ps-5 text-sm text-muted">
        {w.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {runner.result && <Alert variant={runner.result.ok ? "success" : "error"}>{runner.result.text}</Alert>}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormMessage state={state} errors={e} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={w.phoneNumberId} htmlFor="wa-phone" error={fieldError(state, e, "phoneNumberId")}>
            <Input id="wa-phone" name="phoneNumberId" dir="ltr" inputMode="numeric" defaultValue={view?.phoneNumberId ?? ""} />
          </Field>
          <Field label={w.token} htmlFor="wa-token" hint={view ? w.tokenKept : undefined} error={fieldError(state, e, "token")}>
            <Input id="wa-token" name="token" type="password" dir="ltr" autoComplete="off" />
          </Field>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold">{w.templates}</p>
          <p className="text-xs text-muted">{w.templatesHint}</p>
          <div className="space-y-2">
            {messageKinds.map((kind) => {
              const tpl = view?.templates[kind];
              return (
                <fieldset key={kind} className="grid items-end gap-2 rounded-[10px] border border-line p-3 sm:grid-cols-[1.2fr_0.5fr_1.3fr]" data-kind={kind}>
                  <legend className="px-1 text-xs font-semibold text-muted">{kindLabels[kind]}</legend>
                  <Field label={w.templateName} htmlFor={`wa-${kind}-name`} error={fieldError(state, e, `${kind}_name`)}>
                    <Input id={`wa-${kind}-name`} name={`${kind}_name`} dir="ltr" placeholder="confirm_order" defaultValue={tpl?.name ?? ""} />
                  </Field>
                  <Field label={w.language} htmlFor={`wa-${kind}-language`}>
                    <Input id={`wa-${kind}-language`} name={`${kind}_language`} dir="ltr" defaultValue={tpl?.language ?? "ar"} />
                  </Field>
                  <Field label={w.params} htmlFor={`wa-${kind}-params`} error={fieldError(state, e, `${kind}_params`)}>
                    <Input id={`wa-${kind}-params`} name={`${kind}_params`} dir="ltr" placeholder="name, order, total" defaultValue={tpl?.params.join(", ") ?? ""} />
                  </Field>
                </fieldset>
              );
            })}
          </div>
          <p className="text-xs text-muted" dir="auto">
            {fmt(w.paramsHint, { list: placeholders.join(", ") })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SubmitButton pending={pending} pendingText={t.common.loading}>
            {t.apps.save}
          </SubmitButton>
          {view && (
            <>
              <Button type="button" variant="secondary" disabled={runner.pending} onClick={() => runner.run(() => testWhatsappAction(lang), (r) => fmt(w.testOk, { detail: r.message ?? "" }))} data-testid="wa-test">
                <Send size={15} /> {t.apps.test}
              </Button>
              <Button type="button" variant="danger" disabled={runner.pending} onClick={() => confirm(t.apps.confirmDisconnect) && runner.run(() => disconnectWhatsapp(lang))}>
                <Unplug size={15} /> {t.apps.disconnect}
              </Button>
            </>
          )}
        </div>
      </form>
    </Card>
  );
}
