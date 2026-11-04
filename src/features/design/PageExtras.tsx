"use client";

// Store Design → page settings of the home page (Google & sharing) and the Pages panel's policy pages. They were on Store
// settings before; Zimam keeps a store's pages and their texts in the builder.
import { useState, useTransition } from "react";
import { Check, FileText } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { policyKinds, type PolicyKind } from "@/lib/enums";
import { Button, Field, Input, Textarea } from "@/ui";
import { saveHomeSeo, savePolicyPage } from "./actions";

type Text = Pick<Dictionary, "settings" | "errors" | "common">;

export function HomeSeoFields({ lang, initial, shopName, url, t }: { lang: string; initial: { title: string; description: string }; shopName: string; url: string; t: Text }) {
  const s = t.settings.seo;
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [state, setState] = useState<"idle" | "saved" | "failed">("idle");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4" data-testid="home-seo">
      <p className="font-semibold">{s.title}</p>
      <Field label={s.metaTitle} htmlFor="seo-title" hint={`${s.metaTitleHint} · ${title.length}/70`}>
        <Input id="seo-title" dir="auto" maxLength={70} value={title} placeholder={shopName} onChange={(e) => (setTitle(e.target.value), setState("idle"))} />
      </Field>
      <Field label={s.metaDescription} htmlFor="seo-description" hint={`${s.metaDescriptionHint} · ${description.length}/160`}>
        <Textarea id="seo-description" dir="auto" rows={2} maxLength={160} value={description} onChange={(e) => (setDescription(e.target.value), setState("idle"))} />
      </Field>
      {/* How it looks in search results (always light, like Google) */}
      <div className="rounded-lg border border-line bg-white p-3" dir="auto">
        <p className="truncate text-xs text-emerald-700" dir="ltr">
          {url}
        </p>
        <p className="truncate text-base text-blue-800">{title || shopName}</p>
        {description && <p className="line-clamp-2 text-xs text-slate-600">{description}</p>}
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" disabled={pending} onClick={() => start(async () => setState((await saveHomeSeo(lang, { title, description })).ok ? "saved" : "failed"))} data-testid="save-seo">
          {t.common.save}
        </Button>
        {state === "saved" && <span className="text-sm text-accent">{t.common.saved}</span>}
        {state === "failed" && <span className="text-sm text-danger">{(t.errors as Record<string, string>).unexpected}</span>}
      </div>
    </div>
  );
}

export function PolicyPages({ lang, initial, t }: { lang: string; initial: Partial<Record<PolicyKind, string>>; t: Text }) {
  const p = t.settings.policies;
  const [texts, setTexts] = useState(initial);
  const [open, setOpen] = useState<PolicyKind | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-1 border-t border-line pt-3" data-testid="policy-pages">
      <p className="font-semibold">{p.title}</p>
      <p className="pb-1 text-xs text-muted">{p.hint}</p>
      {policyKinds.map((k) => (
        <div key={k}>
          <button
            type="button"
            onClick={() => {
              setOpen(open === k ? null : k);
              setDraft(texts[k] ?? "");
            }}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm ${open === k ? "bg-accent-soft font-semibold" : "hover:bg-panel-2"}`}
            data-policy={k}
          >
            <FileText size={15} className="text-muted" /> <span className="min-w-0 flex-1 truncate">{p.kinds[k]}</span>
            {texts[k] && <Check size={14} className="text-accent" />}
          </button>
          {open === k && (
            <div className="space-y-2 px-1 py-2">
              <Textarea id={`policy-${k}`} dir="auto" rows={6} maxLength={10_000} value={draft} placeholder={p.placeholder} onChange={(e) => setDraft(e.target.value)} />
              <Button
                type="button"
                className="w-full"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    if ((await savePolicyPage(lang, k, draft)).ok) {
                      setTexts({ ...texts, [k]: draft.trim() });
                      setOpen(null);
                    }
                  })
                }
                data-testid="save-policy"
              >
                {t.common.save}
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
