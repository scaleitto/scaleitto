"use client";

import { useActionState } from "react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { AiFormState } from "../actions";

const languages = ["ar", "dz", "fr", "en"] as const;
const tones = ["persuasive", "premium", "friendly", "urgent"] as const;

export function AiForm({
  t,
  action,
  products,
  defaultLanguage,
}: {
  t: Dictionary;
  action: (state: AiFormState, formData: FormData) => Promise<AiFormState>;
  products: { id: string; name: string; image: string | null }[];
  defaultLanguage: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const a = t.ai;
  const errorText =
    state.error === "limit" ? a.limitReached : state.error === "pageLimit" ? t.landingPages.limitReached : state.error === "notConfigured" ? a.notConfigured : state.error === "validation" ? t.auth.errors.validation : state.error ? a.failed : null;

  return (
    <form action={formAction} className="card space-y-5">
      <div>
        <label className="label" htmlFor="productId">{a.product}</label>
        <select className="input" id="productId" name="productId" required>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="language">{a.language}</label>
          <select className="input" id="language" name="language" defaultValue={defaultLanguage}>
            {languages.map((l) => (
              <option key={l} value={l}>{a.languages[l]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="tone">{a.tone}</label>
          <select className="input" id="tone" name="tone" defaultValue="persuasive">
            {tones.map((tone) => (
              <option key={tone} value={tone}>{a.tones[tone]}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="audience">{a.audience}</label>
        <input className="input" id="audience" name="audience" maxLength={300} placeholder={a.audiencePlaceholder} />
      </div>
      <div>
        <label className="label" htmlFor="notes">{a.notes}</label>
        <textarea className="input min-h-36" id="notes" name="notes" maxLength={4000} placeholder={a.notesPlaceholder} />
      </div>

      {errorText && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorText}
          {state.detail && <span className="mt-1 block font-mono text-xs" dir="ltr">{state.detail}</span>}
        </p>
      )}

      <button className="btn w-full py-3 text-base" disabled={pending}>
        {pending ? a.generating : a.generate}
      </button>
      {pending && (
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-brand" />
        </div>
      )}
    </form>
  );
}
