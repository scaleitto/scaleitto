"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { Box, Check, CircleDollarSign, House, MapPin, Pencil, Plus, Star, Trash2, Truck, X } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt } from "@/lib/format";
import { Alert, Button, Card, Field, Input } from "@/ui";
import { SwitchRow } from "@/ui/Switch";
import { useModal } from "@/ui/useModal";
import { saveDeliverySettings } from "./actions";
import { MAX_OPTIONS, MAX_PRICE, optionPricings, optionTypes, wilayaStates, type DeliveryOption, type DeliverySettings, type OptionType, type WilayaRate } from "./settings";

type Text = Pick<Dictionary, "delivery" | "errors" | "common">;
type Wilaya = { code: number; name: string };

const typeIcons: Record<OptionType, ReactNode> = { home: <House size={18} />, office: <Box size={18} />, both: <Truck size={18} /> };
const priceInput = (v: string) => {
  const digits = v.replace(/\D/g, "");
  return digits === "" ? null : Math.min(MAX_PRICE, Number(digits));
};

// A big choice card (Zimam: where you deliver, the pricing model)
function ChoiceCard({ on, onClick, icon, title, hint, badge, testId }: { on: boolean; onClick: () => void; icon?: ReactNode; title: string; hint: string; badge?: string; testId: string }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`relative rounded-xl border-2 p-4 text-start transition-colors ${on ? "border-accent bg-accent-soft/40" : "border-line hover:border-fg-2/30"}`} data-testid={testId}>
      {on && (
        <span className="absolute end-3 top-3 grid size-5 place-items-center rounded-full bg-accent text-white">
          <Check size={13} />
        </span>
      )}
      {icon && <span className={`mb-3 grid size-9 place-items-center rounded-lg ${on ? "bg-accent text-white" : "bg-panel-2 text-fg-2"}`}>{icon}</span>}
      {badge && <span className="mb-2 inline-block rounded-md bg-panel-2 px-1.5 py-0.5 text-xs font-semibold text-fg-2">{badge}</span>}
      <span className="block font-bold">{title}</span>
      <span className="mt-0.5 block text-sm text-muted">{hint}</span>
    </button>
  );
}

// "Set home / office prices" for the selected wilayas
function PriceDialog({ title, hint, t, onApply, dialog }: { title: string; hint: string; t: Text; onApply: (price: number) => void; dialog: React.RefObject<HTMLDialogElement | null> }) {
  const g = t.delivery.general;
  const input = useRef<HTMLInputElement>(null);
  return (
    <dialog ref={dialog} className="m-auto w-[min(440px,calc(100vw-2rem))] rounded-2xl border border-line bg-panel p-0 text-fg shadow-xl backdrop:bg-black/40" data-testid="price-dialog">
      <form
        method="dialog"
        className="divide-y divide-line"
        onSubmit={(ev) => {
          const v = priceInput(input.current?.value ?? "");
          if (v === null) {
            ev.preventDefault();
            input.current?.focus();
            return;
          }
          onApply(v);
          if (input.current) input.current.value = "";
        }}
      >
        <h2 className="p-5 text-lg font-bold">{title}</h2>
        <div className="space-y-2 p-5">
          <Input ref={input} inputMode="numeric" dir="ltr" placeholder={g.enterPrice} aria-label={title} data-testid="price-dialog-input" />
          <p className="text-xs text-muted">{hint}</p>
        </div>
        <div className="flex gap-2 p-5">
          <Button type="submit" className="flex-1" data-testid="price-dialog-apply">
            {g.apply}
          </Button>
          <Button type="button" variant="secondary" onClick={() => dialog.current?.close()}>
            {g.cancel}
          </Button>
        </div>
      </form>
    </dialog>
  );
}

// Zimam's per-wilaya table: tick wilayas, then set their home / office price, free, or not delivered
function RatesTable({ option, wilayas, onChange, t }: { option: DeliveryOption; wilayas: Wilaya[]; onChange: (rates: Record<string, WilayaRate>) => void; t: Text }) {
  const g = t.delivery.general;
  const rates = option.rates ?? {};
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulk, setBulk] = useState<"home" | "office">("home");
  const dialog = useModal();
  const showHome = option.type !== "office";
  const showOffice = option.type !== "home";
  const configured = wilayas.filter((w) => rates[w.code]).length;
  const setRow = (code: number, rate: WilayaRate | null) => {
    const next = { ...rates };
    if (rate) next[code] = rate;
    else delete next[code];
    onChange(next);
  };
  const setMany = (change: (r: WilayaRate | undefined) => WilayaRate) => {
    const next = { ...rates };
    for (const code of selected) next[code] = change(next[code]);
    onChange(next);
  };
  const paid = (r: WilayaRate | undefined): WilayaRate => (r?.state === "paid" ? r : { state: "paid", home: null, office: null });
  const n = selected.size;
  const pill = "rounded-lg px-3 py-1.5 text-sm font-semibold";
  return (
    <div className="overflow-hidden rounded-xl border border-line" data-testid="rates-table">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel-2/50 p-3">
        <h3 className="flex items-center gap-1.5 font-bold">
          <MapPin size={16} className="text-accent" /> {g.rates}
        </h3>
        <span className="rounded-md bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning" data-testid="rates-configured">
          {fmt(g.configured, { n: configured, total: wilayas.length })}
        </span>
        <span className="rounded-md border border-warning/40 px-2 py-0.5 text-xs font-semibold text-warning">{fmt(g.unconfigured, { n: wilayas.length - configured })}</span>
        <div className="ms-auto flex flex-wrap gap-2">
          {n > 0 && (
            <>
              {showHome && (
                <button type="button" className={`${pill} bg-accent text-white`} onClick={() => (setBulk("home"), dialog.current?.showModal())} data-testid="bulk-home">
                  {fmt(g.setHome, { n })}
                </button>
              )}
              {showOffice && (
                <button type="button" className={`${pill} bg-accent text-white`} onClick={() => (setBulk("office"), dialog.current?.showModal())} data-testid="bulk-office">
                  {fmt(g.setOffice, { n })}
                </button>
              )}
              <button type="button" className={`${pill} bg-accent text-white`} onClick={() => setMany(() => ({ state: "free", home: null, office: null }))} data-testid="bulk-free">
                {fmt(g.setFree, { n })}
              </button>
              <button type="button" className={`${pill} bg-fg-2 text-panel`} onClick={() => setMany(() => ({ state: "none", home: null, office: null }))} data-testid="bulk-none">
                {fmt(g.setNone, { n })}
              </button>
              <button type="button" className={`${pill} bg-panel-2 text-fg-2`} onClick={() => setSelected(new Set())}>
                {g.clearSelection}
              </button>
            </>
          )}
          <button type="button" className={`${pill} border border-line bg-panel`} onClick={() => setSelected(new Set(wilayas.map((w) => w.code)))} data-testid="select-all-wilayas">
            {g.selectAll}
          </button>
        </div>
      </div>
      <p className="border-b border-line px-4 py-2 text-xs text-muted">{g.ratesHint}</p>
      <div className="max-h-[480px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-panel">
            <tr className="text-xs text-muted">
              <th className="w-10 p-3">
                <input
                  type="checkbox"
                  aria-label={g.selectAll}
                  checked={n === wilayas.length}
                  onChange={(e) => setSelected(e.target.checked ? new Set(wilayas.map((w) => w.code)) : new Set())}
                  className="size-4 accent-[var(--color-accent)]"
                />
              </th>
              <th className="p-3 text-start font-medium">{g.wilaya}</th>
              <th className="p-3 font-medium">{g.state}</th>
              {showHome && <th className="p-3 text-start font-medium">{g.homePrice}</th>}
              {showOffice && <th className="p-3 text-start font-medium">{g.officePrice}</th>}
            </tr>
          </thead>
          <tbody>
            {wilayas.map((w) => {
              const r = rates[w.code];
              const on = selected.has(w.code);
              return (
                <tr key={w.code} className={`border-t border-line ${on ? "bg-accent-soft/30" : ""}`} data-wilaya={w.code} data-state={r?.state ?? "unset"}>
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      aria-label={w.name}
                      checked={on}
                      onChange={(e) =>
                        setSelected((s) => {
                          const next = new Set(s);
                          if (e.target.checked) next.add(w.code);
                          else next.delete(w.code);
                          return next;
                        })
                      }
                      className="size-4 accent-[var(--color-accent)]"
                    />
                  </td>
                  <td className="p-3 font-semibold">{w.name}</td>
                  <td className="p-3">
                    <div className="mx-auto flex w-fit overflow-hidden rounded-lg border border-line text-xs font-semibold" role="radiogroup" aria-label={w.name}>
                      {wilayaStates.map((st) => (
                        <button
                          key={st}
                          type="button"
                          role="radio"
                          aria-checked={r?.state === st}
                          onClick={() => setRow(w.code, r?.state === st ? null : st === "paid" ? paid(r) : { state: st, home: null, office: null })}
                          className={`px-2.5 py-1.5 ${r?.state === st ? "bg-accent text-white" : "hover:bg-panel-2"}`}
                          data-set={st}
                        >
                          {g.states[st]}
                        </button>
                      ))}
                    </div>
                  </td>
                  {(["home", "office"] as const)
                    .filter((k) => (k === "home" ? showHome : showOffice))
                    .map((k) => (
                      <td key={k} className="p-3">
                        {r?.state === "paid" ? (
                          <Input
                            inputMode="numeric"
                            dir="ltr"
                            className="h-9 w-28"
                            placeholder="—"
                            value={r[k] ?? ""}
                            aria-label={`${k === "home" ? g.homePrice : g.officePrice} ${w.name}`}
                            onChange={(e) => setRow(w.code, { ...r, [k]: priceInput(e.target.value) })}
                            data-price={k}
                          />
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PriceDialog dialog={dialog} title={bulk === "home" ? g.bulkHome : g.bulkOffice} hint={g.ratesHint} t={t} onApply={(v) => setMany((r) => ({ ...paid(r), [bulk]: v }))} />
    </div>
  );
}

// "Add / edit a delivery method": name, active, preferred, where, pricing (+ flat prices or the wilaya table)
function OptionEditor({ initial, isNew, wilayas, pending, error, onSave, onCancel, t }: { initial: DeliveryOption; isNew: boolean; wilayas: Wilaya[]; pending: boolean; error: string | null; onSave: (o: DeliveryOption) => void; onCancel: () => void; t: Text }) {
  const g = t.delivery.general;
  const [o, setO] = useState(initial);
  const [nameError, setNameError] = useState(false);
  const set = (change: Partial<DeliveryOption>) => setO((x) => ({ ...x, ...change }));
  return (
    <Card className="space-y-5 p-6" data-testid="option-editor">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <h2 className="text-lg font-bold">{isNew ? g.newOption : g.editOption}</h2>
        <button type="button" aria-label={g.cancel} className="grid size-8 place-items-center rounded-md text-muted hover:bg-panel-2" onClick={onCancel}>
          <X size={18} />
        </button>
      </div>
      <Field label={`${g.name} *`} htmlFor="opt-name" error={nameError ? g.needName : undefined}>
        <Input id="opt-name" value={o.name} maxLength={60} placeholder={g.namePlaceholder} onChange={(e) => (set({ name: e.target.value }), setNameError(false))} data-testid="option-name" />
      </Field>
      <div className="space-y-3">
        <div className="rounded-xl bg-panel-2/50 p-3">
          <SwitchRow label={g.active} hint={g.activeHint} checked={o.active} onChange={(v) => set({ active: v })} testId="option-active" icon={<span className="size-2.5 rounded-full bg-accent" />} />
        </div>
        <div className="rounded-xl bg-panel-2/50 p-3">
          <SwitchRow label={g.isDefault} hint={g.defaultHint} checked={o.isDefault} onChange={(v) => set({ isDefault: v })} testId="option-default" icon={<Star size={16} />} />
        </div>
      </div>
      <div className="space-y-3">
        <h3 className="flex items-center gap-1.5 font-bold">
          <House size={16} className="text-accent" /> {g.where}
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {optionTypes.map((ty) => (
            <ChoiceCard key={ty} on={o.type === ty} onClick={() => set({ type: ty })} icon={typeIcons[ty]} title={g.types[ty].name} hint={g.types[ty].hint} testId={`type-${ty}`} />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <h3 className="flex items-center gap-1.5 font-bold">
          <CircleDollarSign size={16} className="text-accent" /> {g.pricing}
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {optionPricings.map((pr) => (
            <ChoiceCard key={pr} on={o.pricing === pr} onClick={() => set({ pricing: pr, rates: pr === "wilaya" ? (o.rates ?? {}) : o.rates })} badge={pr === "free" ? `0 ${t.common.currency}` : undefined} title={g.pricings[pr].name} hint={g.pricings[pr].hint} testId={`pricing-${pr}`} />
          ))}
        </div>
      </div>
      {o.pricing === "flat" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {o.type !== "office" && (
            <Field label={g.flatHome} htmlFor="flat-home">
              <Input id="flat-home" inputMode="numeric" dir="ltr" value={o.home} onChange={(e) => set({ home: priceInput(e.target.value) ?? 0 })} data-testid="flat-home" />
            </Field>
          )}
          {o.type !== "home" && (
            <Field label={g.flatOffice} htmlFor="flat-office">
              <Input id="flat-office" inputMode="numeric" dir="ltr" value={o.office} onChange={(e) => set({ office: priceInput(e.target.value) ?? 0 })} data-testid="flat-office" />
            </Field>
          )}
        </div>
      )}
      {o.pricing === "wilaya" && <RatesTable option={o} wilayas={wilayas} onChange={(rates) => set({ rates })} t={t} />}
      {error && <Alert>{error}</Alert>}
      <div className="flex items-center gap-3 border-t border-line pt-5">
        <Button
          type="button"
          className="h-11 px-6"
          disabled={pending}
          onClick={() => {
            if (!o.name.trim()) return setNameError(true);
            onSave({ ...o, name: o.name.trim() });
          }}
          data-testid="save-option"
        >
          {g.saveOption}
        </Button>
        <button type="button" className="px-3 text-muted hover:text-fg" onClick={onCancel}>
          {g.cancel}
        </button>
      </div>
    </Card>
  );
}

function summary(o: DeliveryOption, t: Text) {
  const g = t.delivery.general;
  const money = (n: number) => `${n.toLocaleString("fr-FR")} ${t.common.currency}`;
  if (o.pricing === "free") return g.summary.free;
  if (o.pricing === "wilaya") return fmt(g.summary.wilaya, { n: o.rates ? Object.values(o.rates).filter((r) => r.state !== "none").length : "—" });
  if (o.type === "home") return money(o.home);
  if (o.type === "office") return money(o.office);
  return fmt(g.summary.flat, { home: money(o.home), office: money(o.office) });
}

let counter = 0;
const newOption = (): DeliveryOption => ({ id: `opt-${Date.now().toString(36)}${counter++}`, name: "", type: "home", pricing: "free", home: 0, office: 0, rates: null, active: true, isDefault: false });

// Delivery → General settings (Zimam): delivery on/off (saved at once), the methods as cards, and the method editor
export function DeliverySettingsForm({ lang, initial, legacy, wilayas, t }: { lang: string; initial: DeliverySettings; legacy: DeliveryOption | null; wilayas: Wilaya[]; t: Text }) {
  const g = t.delivery.general;
  const e = t.errors as Record<string, string>;
  const [enabled, setEnabled] = useState(initial.enabled);
  const [options, setOptions] = useState<DeliveryOption[]>(initial.options);
  const [editing, setEditing] = useState<{ option: DeliveryOption; isNew: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const persist = (next: DeliveryOption[], done?: () => void) =>
    start(async () => {
      setError(null);
      const r = await saveDeliverySettings(lang, { options: next });
      if (!r.ok) return setError(e[r.error ?? ""] ?? e.unexpected);
      setOptions(next);
      setSaved(true);
      done?.();
    });
  const save = (o: DeliveryOption) => {
    // An older store adding its first method keeps its wilaya table as a method too (it would stop being used otherwise)
    const base = !options.length && legacy && o.id !== legacy.id ? [{ ...legacy, name: g.pricings.wilaya.name }] : options;
    const rest = base.filter((x) => x.id !== o.id).map((x) => (o.isDefault ? { ...x, isDefault: false } : x));
    const at = base.findIndex((x) => x.id === o.id);
    const next = at < 0 ? [...rest, o] : [...rest.slice(0, at), o, ...rest.slice(at)];
    persist(next, () => setEditing(null));
  };
  const showLegacy = legacy && options.length === 0;
  return (
    <div className="space-y-5" data-testid="delivery-general">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{g.title}</h1>
        <p className="mt-1 text-sm text-muted">{g.hint}</p>
      </div>
      <Card>
        <SwitchRow
          label={g.enabled}
          hint={g.enabledHint}
          icon={<Truck size={18} />}
          checked={enabled}
          onChange={(v) => {
            setEnabled(v);
            start(async () => {
              const r = await saveDeliverySettings(lang, { enabled: v });
              if (!r.ok) setEnabled(!v);
            });
          }}
          testId="delivery-enabled"
        />
      </Card>
      {saved && !editing && !error && (
        <div data-testid="delivery-saved">
          <Alert variant="success">{g.saved}</Alert>
        </div>
      )}
      {error && !editing && <Alert>{error}</Alert>}
      <div className="space-y-3" data-testid="delivery-options">
        {options.length === 0 && !showLegacy && !editing && <p className="rounded-xl border-2 border-dashed border-line p-8 text-center text-muted">{g.noOptions}</p>}
        {showLegacy && !editing && (
          <Card className="flex flex-wrap items-center gap-3" data-testid="legacy-option">
            <span className="grid size-10 place-items-center rounded-xl bg-panel-2 text-fg-2">{typeIcons.both}</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{g.pricings.wilaya.name}</p>
              <p className="text-sm text-muted">{g.tableNote}</p>
            </div>
            <Button type="button" variant="secondary" onClick={() => setEditing({ option: legacy, isNew: true })}>
              <Pencil size={15} /> {g.edit}
            </Button>
          </Card>
        )}
        {options.map((o) =>
          editing?.option.id === o.id ? null : (
            <Card key={o.id} className="flex flex-wrap items-center gap-3" data-option={o.id} data-type={o.type} data-pricing={o.pricing}>
              <span className={`grid size-10 place-items-center rounded-xl ${o.active ? "bg-accent-soft text-accent" : "bg-panel-2 text-muted"}`}>{typeIcons[o.type]}</span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {o.name}
                  {o.isDefault && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-warning/10 px-1.5 py-0.5 text-xs text-warning">
                      <Star size={11} /> {g.defaultBadge}
                    </span>
                  )}
                  {!o.active && <span className="rounded-md bg-panel-2 px-1.5 py-0.5 text-xs text-muted">{g.inactive}</span>}
                </p>
                <p className="text-sm text-muted">
                  {g.types[o.type].name} · {g.pricings[o.pricing].name} · <span data-testid="option-summary">{summary(o, t)}</span>
                </p>
              </div>
              <Button type="button" variant="secondary" disabled={pending} onClick={() => (setError(null), setEditing({ option: o, isNew: false }))} data-testid="edit-option">
                <Pencil size={15} /> {g.edit}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                aria-label={g.remove}
                onClick={() => {
                  if (confirm(g.confirmRemove)) persist(options.filter((x) => x.id !== o.id));
                }}
                data-testid="remove-option"
              >
                <Trash2 size={15} />
              </Button>
            </Card>
          ),
        )}
        {editing && (
          <OptionEditor
            key={editing.option.id}
            initial={editing.option}
            isNew={editing.isNew}
            wilayas={wilayas}
            pending={pending}
            error={error}
            onSave={save}
            onCancel={() => (setEditing(null), setError(null))}
            t={t}
          />
        )}
        {!editing && options.length < MAX_OPTIONS && (
          <button type="button" className="mx-auto flex items-center gap-2 py-2 font-semibold text-accent hover:underline" data-testid="add-delivery-option" onClick={() => (setSaved(false), setError(null), setEditing({ option: newOption(), isNew: true }))}>
            <span className="grid size-7 place-items-center rounded-full bg-accent-soft">
              <Plus size={16} />
            </span>
            {g.addOption}
          </button>
        )}
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
      <SwitchRow
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
