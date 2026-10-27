"use client";

import { Plus, Trash2 } from "lucide-react";
import { Card, Field, Input, Select, Textarea } from "@/ui";
import type { EditorText } from "./SectionFields";
import { MAX_CUSTOM_FIELDS, newSectionId, type CustomField, type FormSettings } from "./types";

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
      {label}
    </label>
  );
}

// Customization of the order form: only choices that keep it clean and trustworthy.
export function FormEditor({ form, set, t, defaults }: { form: FormSettings; set: (patch: Partial<FormSettings>) => void; t: EditorText; defaults: { title: string; subtitle: string; button: string } }) {
  const ed = t.landingPages.editor;
  const setField = (i: number, patch: Partial<CustomField>) => set({ custom: form.custom.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  return (
    <div className="space-y-4" data-testid="form-editor">
      <Card className="space-y-3">
        <Field label={ed.formTitle}>
          <Input value={form.title} maxLength={120} placeholder={defaults.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label={ed.formSubtitle}>
          <Input value={form.subtitle} maxLength={300} placeholder={defaults.subtitle} onChange={(e) => set({ subtitle: e.target.value })} />
        </Field>
        <Field label={ed.buttonText}>
          <Input value={form.buttonText} maxLength={60} placeholder={defaults.button} onChange={(e) => set({ buttonText: e.target.value })} aria-label={ed.buttonText} />
        </Field>
      </Card>

      <Card className="grid gap-3 sm:grid-cols-2">
        <Field label={ed.layout}>
          <Select value={form.layout} onChange={(e) => set({ layout: e.target.value as FormSettings["layout"] })} aria-label={ed.layout}>
            {(["compact", "stacked"] as const).map((v) => (
              <option key={v} value={v}>
                {ed.layouts[v]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={ed.delivery}>
          <Select value={form.delivery} onChange={(e) => set({ delivery: e.target.value as FormSettings["delivery"] })} aria-label={ed.delivery}>
            {(["both", "home", "office"] as const).map((v) => (
              <option key={v} value={v}>
                {ed.deliveryModes[v]}
              </option>
            ))}
          </Select>
        </Field>
        {/* The address is only asked for home delivery */}
        {form.delivery !== "office" && (
          <Field label={ed.address}>
            <Select value={form.address} onChange={(e) => set({ address: e.target.value as FormSettings["address"] })} aria-label={ed.address}>
              {(["hidden", "optional", "required"] as const).map((v) => (
                <option key={v} value={v}>
                  {ed.addressModes[v]}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="space-y-2 pt-6">
          <Toggle checked={form.note} onChange={(note) => set({ note })} label={ed.note} />
          <Toggle checked={form.showSummary} onChange={(showSummary) => set({ showSummary })} label={ed.showSummary} />
          <Toggle checked={form.showOffers} onChange={(showOffers) => set({ showOffers })} label={ed.showOffers} />
          <Toggle checked={form.stickyButton} onChange={(stickyButton) => set({ stickyButton })} label={ed.stickyButton} />
        </div>
      </Card>

      <Card className="space-y-3">
        <div>
          <h3 className="font-semibold">{ed.customFields}</h3>
          <p className="mt-0.5 text-xs text-muted">{ed.customHint}</p>
        </div>
        {form.custom.map((c, i) => (
          <div key={c.id} className="space-y-2 rounded-lg border border-line p-3" data-custom-field={i}>
            <div className="flex flex-wrap items-center gap-2">
              <Input aria-label={ed.fieldLabel} placeholder={ed.fieldLabel} className="min-w-40 flex-1" value={c.label} maxLength={60} onChange={(e) => setField(i, { label: e.target.value })} />
              <Select aria-label={ed.fieldType} className="w-auto" value={c.type} onChange={(e) => setField(i, { type: e.target.value as CustomField["type"] })}>
                <option value="text">{ed.fieldTypes.text}</option>
                <option value="select">{ed.fieldTypes.select}</option>
              </Select>
              <Toggle checked={c.required} onChange={(required) => setField(i, { required })} label={ed.required} />
              <button type="button" aria-label={ed.remove} className="rounded-lg p-2 text-muted hover:text-danger" onClick={() => set({ custom: form.custom.filter((_, j) => j !== i) })}>
                <Trash2 size={15} />
              </button>
            </div>
            {c.type === "select" && (
              <Field label={ed.fieldOptions}>
                <Textarea rows={3} value={c.options.join("\n")} onChange={(e) => setField(i, { options: e.target.value.split("\n") })} aria-label={ed.fieldOptions} />
              </Field>
            )}
          </div>
        ))}
        {form.custom.length < MAX_CUSTOM_FIELDS && (
          <button type="button" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline" onClick={() => set({ custom: [...form.custom, { id: newSectionId(), label: "", type: "text", options: [], required: false }] })}>
            <Plus size={15} /> {ed.addField}
          </button>
        )}
      </Card>

      <Card>
        <Field label={ed.thankYou}>
          <Textarea rows={2} maxLength={500} placeholder={ed.thankYouPlaceholder} value={form.thankYou} onChange={(e) => set({ thankYou: e.target.value })} aria-label={ed.thankYou} />
        </Field>
      </Card>
    </div>
  );
}
