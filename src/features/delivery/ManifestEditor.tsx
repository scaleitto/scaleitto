"use client";

import { useState, useTransition } from "react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt } from "@/lib/format";
import { Alert, Button, Card, Field, Select, Textarea } from "@/ui";
import { saveManifest } from "./actions";
import { Manifest, sampleRows } from "./Manifest";
import { manifestFields, type ManifestTemplate } from "./settings";

type Text = Pick<Dictionary, "delivery" | "errors">;

// Delivery → handover manifest: what the document shows, branding, paper and language, text blocks; a live preview with
// sample parcels; "save draft" keeps the changes, "publish" makes them the printed manifest.
export function ManifestEditor({
  lang,
  initial,
  state,
  store,
  t,
}: {
  lang: string;
  initial: ManifestTemplate;
  state: "default" | "published" | "draft";
  store: { name: string; logo: string | null };
  t: Text;
}) {
  const m = t.delivery.manifest;
  const [tpl, setTpl] = useState(initial);
  const [status, setStatus] = useState(state);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pending, start] = useTransition();
  const set = (patch: Partial<ManifestTemplate>) =>
    setTpl((v) => ({ ...v, ...patch }));
  const save = (publish: boolean) =>
    start(async () => {
      const r = await saveManifest(lang, tpl, publish);
      setMessage(
        r.ok
          ? { ok: true, text: publish ? m.publishedDone : m.draftSaved }
          : {
              ok: false,
              text:
                (t.errors as Record<string, string>)[r.error ?? ""] ??
                t.errors.unexpected,
            },
      );
      if (r.ok) setStatus(publish ? "published" : "draft");
    });
  const check = (
    on: boolean,
    onChange: (v: boolean) => void,
    label: string,
    testId: string,
  ) => (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm">
      {label}
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[var(--color-accent)]"
        data-field={testId}
      />
    </label>
  );
  const text = (
    key: "header" | "footer" | "pickup" | "returns",
    max: number,
  ) => (
    <Field
      label={m[key]}
      htmlFor={`m-${key}`}
      hint={`${fmt(m.left, { n: max - tpl[key].length })} · ${m.textOnly}`}
    >
      <Textarea
        id={`m-${key}`}
        rows={key === "header" || key === "footer" ? 2 : 3}
        maxLength={max}
        value={tpl[key]}
        onChange={(e) => set({ [key]: e.target.value })}
        dir="auto"
      />
    </Field>
  );

  return (
    <div
      className="space-y-6"
      data-testid="manifest-editor"
      data-state={status}
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{m.title}</h1>
        <p className="mt-1 text-sm text-muted">{m.hint}</p>
        <p className="mt-1 text-xs font-semibold text-accent">
          {status === "default"
            ? m.usingDefault
            : status === "published"
              ? m.published
              : m.unpublished}
        </p>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="space-y-3">
            <h2 className="font-semibold">{m.show}</h2>
            <p className="text-xs text-muted">{m.showHint}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {manifestFields.map((f) => (
                <div key={f}>
                  {check(
                    tpl.show[f],
                    (v) => set({ show: { ...tpl.show, [f]: v } }),
                    m.fields[f],
                    f,
                  )}
                </div>
              ))}
            </div>
            {!tpl.show.signatures && (
              <p className="text-xs text-warning">{m.signaturesHint}</p>
            )}
          </Card>
          <Card className="space-y-3">
            <h2 className="font-semibold">{m.branding}</h2>
            {check(tpl.logo, (v) => set({ logo: v }), m.logo, "logo")}
            {text("header", 500)}
            {text("footer", 500)}
          </Card>
          <Card className="space-y-3">
            <h2 className="font-semibold">{m.paper}</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={m.paperSize} htmlFor="m-paper">
                <Select
                  id="m-paper"
                  value={tpl.paper}
                  onChange={(e) =>
                    set({ paper: e.target.value as ManifestTemplate["paper"] })
                  }
                >
                  <option value="a4">A4</option>
                  <option value="a6">A6</option>
                </Select>
              </Field>
              <Field label={m.language} htmlFor="m-language">
                <Select
                  id="m-language"
                  value={tpl.language}
                  onChange={(e) => {
                    const language = e.target
                      .value as ManifestTemplate["language"];
                    set({
                      language,
                      direction: language === "ar" ? "rtl" : "ltr",
                    });
                  }}
                >
                  <option value="ar">العربية</option>
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </Select>
              </Field>
              <Field label={m.direction} htmlFor="m-direction">
                <Select
                  id="m-direction"
                  value={tpl.direction}
                  onChange={(e) =>
                    set({
                      direction: e.target
                        .value as ManifestTemplate["direction"],
                    })
                  }
                >
                  <option value="rtl">{m.directions.rtl}</option>
                  <option value="ltr">{m.directions.ltr}</option>
                </Select>
              </Field>
            </div>
          </Card>
          <Card className="space-y-3">
            <h2 className="font-semibold">{m.blocks}</h2>
            {text("pickup", 2000)}
            {text("returns", 2000)}
          </Card>
          {message && (
            <Alert variant={message.ok ? "success" : "error"}>
              {message.text}
            </Alert>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => save(false)}
              data-testid="manifest-draft"
            >
              {m.saveDraft}
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => save(true)}
              data-testid="manifest-publish"
            >
              {m.publish}
            </Button>
          </div>
        </div>
        <div className="space-y-2 xl:sticky xl:top-20">
          <h2 className="text-sm font-semibold">{m.preview}</h2>
          <p className="text-xs text-muted">{m.sample}</p>
          <div className="overflow-hidden rounded-xl border border-line bg-white p-5 shadow-card">
            <Manifest
              template={tpl}
              store={store}
              carrier="Yalidine"
              date="2026-01-15 09:30"
              rows={sampleRows}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
