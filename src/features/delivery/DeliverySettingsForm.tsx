"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { Alert, Button, Card, Field, Input, Select } from "@/ui";
import { saveDeliverySettings } from "./actions";
import { MAX_OPTIONS, optionPricings, type DeliveryOption, type DeliverySettings } from "./settings";

type Text = Pick<Dictionary, "delivery" | "errors">;

function Switch({ checked, onChange, label, hint, testId }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string; testId: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="mt-0.5 block text-sm text-muted">{hint}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" data-testid={testId} />
      <span aria-hidden className="relative mt-1 h-5 w-9 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-accent after:absolute after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition-all after:start-0.5 peer-checked:after:start-[1.125rem]" />
    </label>
  );
}

// Delivery → general settings: delivery on/off and the options offered at checkout (one per type)
export function DeliverySettingsForm({ lang, initial, t }: { lang: string; initial: DeliverySettings; t: Text }) {
  const g = t.delivery.general;
  const [enabled, setEnabled] = useState(initial.enabled);
  const [options, setOptions] = useState<DeliveryOption[]>(initial.options);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const free = (["home", "office"] as const).find((type) => !options.some((o) => o.type === type));
  const patch = (i: number, change: Partial<DeliveryOption>) => setOptions((all) => all.map((o, j) => (j === i ? { ...o, ...change } : o)));
  const save = () =>
    start(async () => {
      const r = await saveDeliverySettings(lang, { enabled, options });
      setMessage(r.ok ? { ok: true, text: g.saved } : { ok: false, text: (t.errors as Record<string, string>)[r.error ?? ""] ?? t.errors.unexpected });
    });
  return (
    // Zimam's layout: the title, the "Enable delivery" card, the options (dashed when empty), "Add new option" centred
    <div className="space-y-5" data-testid="delivery-general">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{g.title}</h1>
        <p className="mt-1 text-sm text-muted">{g.hint}</p>
      </div>
      <Card>
        <Switch checked={enabled} onChange={setEnabled} label={g.enabled} hint={g.enabledHint} testId="delivery-enabled" />
      </Card>
      <div className="space-y-3">
        {options.length === 0 && <p className="rounded-xl border-2 border-dashed border-line p-8 text-center text-muted">{g.noOptions}</p>}
        {options.map((o, i) => (
          <Card key={o.type} className="space-y-3" data-option={o.type}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={g.name} htmlFor={`opt-name-${i}`}>
                <Input id={`opt-name-${i}`} value={o.name} maxLength={60} placeholder={g.namePlaceholder} onChange={(e) => patch(i, { name: e.target.value })} />
              </Field>
              <Field label={g.type} htmlFor={`opt-type-${i}`}>
                <Select id={`opt-type-${i}`} value={o.type} onChange={(e) => patch(i, { type: e.target.value as DeliveryOption["type"] })}>
                  {(["home", "office"] as const).map((type) => (
                    <option key={type} value={type} disabled={type !== o.type && options.some((x) => x.type === type)}>
                      {g.types[type]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={g.pricing} htmlFor={`opt-pricing-${i}`}>
                <Select id={`opt-pricing-${i}`} value={o.pricing} onChange={(e) => patch(i, { pricing: e.target.value as DeliveryOption["pricing"] })} data-field="pricing">
                  {optionPricings.map((p) => (
                    <option key={p} value={p}>
                      {g.pricings[p]}
                    </option>
                  ))}
                </Select>
              </Field>
              {o.pricing === "flat" ? (
                <Field label={g.price} htmlFor={`opt-price-${i}`}>
                  <Input id={`opt-price-${i}`} inputMode="numeric" dir="ltr" value={o.price || ""} onChange={(e) => patch(i, { price: Number(e.target.value.replace(/\D/g, "")) || 0 })} data-field="price" />
                </Field>
              ) : (
                <Field label={g.days} htmlFor={`opt-days-${i}`}>
                  <Input id={`opt-days-${i}`} value={o.days} maxLength={40} placeholder={g.daysPlaceholder} onChange={(e) => patch(i, { days: e.target.value })} />
                </Field>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={o.active} onChange={(e) => patch(i, { active: e.target.checked })} className="size-4 accent-[var(--color-accent)]" data-field="active" />
                {g.active}
              </label>
              <button type="button" className="inline-flex items-center gap-1.5 text-muted hover:text-danger" onClick={() => setOptions((all) => all.filter((_, j) => j !== i))}>
                <Trash2 size={15} /> {g.remove}
              </button>
            </div>
          </Card>
        ))}
        {free && options.length < MAX_OPTIONS && (
          <button
            type="button"
            className="mx-auto flex items-center gap-2 py-2 font-semibold text-accent hover:underline"
            data-testid="add-delivery-option"
            onClick={() => setOptions((all) => [...all, { id: free, name: "", type: free, pricing: "wilaya", price: 0, days: "", active: true }])}
          >
            <span className="grid size-7 place-items-center rounded-full bg-accent-soft">
              <Plus size={16} />
            </span>
            {g.addOption}
          </button>
        )}
      </div>
      {message && <Alert variant={message.ok ? "success" : "error"}>{message.text}</Alert>}
      <div className="flex justify-end">
        <Button type="button" disabled={pending} onClick={save} data-testid="save-delivery-settings">
          {g.save}
        </Button>
      </div>
    </div>
  );
}

// Delivery → companies: send confirmed orders automatically (saved as soon as it is switched)
export function AutoSendSwitch({ lang, initial, t }: { lang: string; initial: boolean; t: Text }) {
  const a = t.delivery.auto;
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <Card aria-busy={pending} data-testid="auto-send" data-state={on ? "on" : "off"}>
      <Switch
        checked={on}
        onChange={(v) => {
          setOn(v);
          start(async () => {
            const r = await saveDeliverySettings(lang, { autoSend: v });
            if (!r.ok) setOn(!v);
          });
        }}
        label={a.title}
        hint={a.hint}
        testId="auto-send-switch"
      />
    </Card>
  );
}
