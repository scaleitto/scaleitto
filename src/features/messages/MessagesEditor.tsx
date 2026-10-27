"use client";

import { useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/ui";
import { FormMessage, SubmitButton, useActionForm } from "@/ui/form";
import { startMessagesAi } from "@/features/ai/actions";
import { useAiTask } from "@/features/ai/useAiTask";
import { defaultTemplates, messageKinds, messageLanguages, placeholders, type MessageKind, type MessageLanguage } from "./templates";
import { saveMessages } from "./actions";

type Text = Pick<Dictionary, "assistant" | "errors" | "common" | "landingPages">;

// The shop's customer messages: one text per situation, AI rewrite, then save
export function MessagesEditor({ lang, language: initialLanguage, texts: initialTexts, t }: { lang: string; language: MessageLanguage; texts: Record<MessageKind, string>; t: Text }) {
  const m = t.assistant.messages;
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(saveMessages.bind(null, lang));
  const [language, setLanguage] = useState(initialLanguage);
  const [texts, setTexts] = useState(initialTexts);
  const [tone, setTone] = useState("");
  const [aiDone, setAiDone] = useState(false);
  const task = useAiTask<Record<MessageKind, string>>(lang, e);
  const rewrite = async () => {
    setAiDone(false);
    const result = await task.run(() => startMessagesAi(lang, language, tone));
    if (result) {
      setTexts((prev) => ({ ...prev, ...result }));
      setAiDone(true);
    }
  };
  return (
    <Card className="mt-6 space-y-4" data-testid="messages-editor">
      <div>
        <h2 className="font-semibold">{m.editorTitle}</h2>
        <p className="mt-0.5 text-sm text-muted">{m.editorHint}</p>
        <p className="mt-2 flex flex-wrap gap-1 text-xs" dir="ltr">
          <span className="text-muted">{m.variables}:</span>
          {placeholders.map((p) => (
            <code key={p} className="rounded bg-panel-2 px-1.5 py-0.5">{`{${p}}`}</code>
          ))}
        </p>
      </div>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormMessage state={state} errors={e} success={t.common.saved} />
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
          <Field label={t.assistant.language} htmlFor="msg-language">
            <Select
              id="msg-language"
              name="language"
              value={language}
              onChange={(ev) => {
                const l = ev.target.value as MessageLanguage;
                // Texts still equal to the old language's defaults switch to the new language's
                setTexts((prev) => Object.fromEntries(messageKinds.map((k) => [k, prev[k] === defaultTemplates[language][k] ? defaultTemplates[l][k] : prev[k]])) as Record<MessageKind, string>);
                setLanguage(l);
              }}
            >
              {messageLanguages.map((l) => (
                <option key={l} value={l}>
                  {t.landingPages.languages[l]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={m.tone} htmlFor="msg-tone">
            <Input id="msg-tone" value={tone} maxLength={200} placeholder={m.tonePlaceholder} onChange={(ev) => setTone(ev.target.value)} />
          </Field>
          <Button type="button" variant="secondary" disabled={task.working} onClick={rewrite} className="mb-[1.4rem]">
            {task.working ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />} {task.working ? t.assistant.working : m.aiWrite}
          </Button>
        </div>
        {task.error && <Alert>{task.error}</Alert>}
        {aiDone && <Alert variant="info">{m.aiDone}</Alert>}
        <div className="grid gap-4 lg:grid-cols-2">
          {messageKinds.map((k) => (
            <Field key={k} label={m.kinds[k]} htmlFor={`msg-${k}`}>
              <Textarea id={`msg-${k}`} name={k} rows={5} dir="auto" maxLength={600} value={texts[k]} onChange={(ev) => setTexts((prev) => ({ ...prev, [k]: ev.target.value }))} />
              {texts[k] !== defaultTemplates[language][k] && (
                <button type="button" className="mt-1 text-xs text-muted hover:text-fg" onClick={() => setTexts((prev) => ({ ...prev, [k]: defaultTemplates[language][k] }))}>
                  ↺ {m.reset}
                </button>
              )}
            </Field>
          ))}
        </div>
        <SubmitButton pending={pending} pendingText={t.common.loading}>
          {m.save}
        </SubmitButton>
      </form>
    </Card>
  );
}
