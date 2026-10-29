"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  Eye,
  EyeOff,
  GripVertical,
  Layers,
  ListChecks,
  Lock,
  MapPin,
  NotebookPen,
  PanelRight,
  Phone,
  Plus,
  RectangleHorizontal,
  Shapes,
  Settings2,
  Signpost,
  SquareStack,
  TextCursorInput,
  Trash2,
  Truck,
  User,
  Hash,
} from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { Card, Field, Input, Select, Textarea } from "@/ui";
import { ImageManager } from "@/ui/ImageManager";
import {
  MAX_CUSTOM_FIELDS,
  MAX_FORM_BLOCKS,
  choiceTypes,
  customFieldTypes,
  formBlockKinds,
  type FormBlock,
  buttonEffects,
  formAppearances,
  newSectionId,
  textFields,
  type CustomField,
  type FormElement,
  type FormSettings,
  type TextField,
} from "@/features/landing/types";

export type FormBuilderText = Pick<Dictionary, "orderForm" | "media">;
type Tab = "elements" | "settings" | "delivery" | "thanks";

function Toggle({ checked, onChange, label, testId }: { checked: boolean; onChange: (v: boolean) => void; label: string; testId?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--color-accent)]" data-testid={testId} />
      {label}
    </label>
  );
}

const elementIcons: Record<FormElement, ReactNode> = {
  variants: <Layers size={17} />,
  quantity: <Hash size={17} />,
  name: <User size={17} />,
  phone: <Phone size={17} />,
  wilaya: <Signpost size={17} />,
  commune: <Building2 size={17} />,
  delivery: <Truck size={17} />,
  address: <MapPin size={17} />,
  note: <NotebookPen size={17} />,
  summary: <ListChecks size={17} />,
};
const appearanceIcons = { direct: <RectangleHorizontal size={20} />, popup: <SquareStack size={20} />, drawer: <PanelRight size={20} /> };

// The order form builder (WEBI-style): elements in order with show/hide and their settings, general settings,
// delivery and the thank-you message. Used for the store's form (Order form section) and in each landing page's editor.
export function FormBuilder({ form, set, t, defaults }: { form: FormSettings; set: (patch: Partial<FormSettings>) => void; t: FormBuilderText; defaults: { title: string; subtitle: string; button: string } }) {
  const f = t.orderForm;
  const [tab, setTab] = useState<Tab>("elements");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= form.order.length) return;
    const order = [...form.order];
    const [key] = order.splice(from, 1);
    order.splice(to, 0, key);
    set({ order });
  };
  const setCustom = (id: string, patch: Partial<CustomField>) => set({ custom: form.custom.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const setLabel = (key: TextField, patch: Partial<{ label: string; placeholder: string }>) =>
    set({ labels: { ...form.labels, [key]: { label: "", placeholder: "", ...form.labels[key], ...patch } } });
  const setBlock = (id: string, patch: Partial<FormBlock>) => set({ blocks: form.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  const [newBlock, setNewBlock] = useState<FormBlock["kind"]>("heading");
  const addBlock = () => {
    const id = newSectionId();
    const order = [...form.order];
    const summary = order.indexOf("summary");
    order.splice(summary >= 0 ? summary : order.length, 0, `el:${id}`);
    set({ blocks: [...form.blocks, { id, kind: newBlock, text: "", image: "" }], order });
    setOpenKey(`el:${id}`);
  };
  const addCustom = () => {
    const id = newSectionId();
    const order = [...form.order];
    const summary = order.indexOf("summary");
    order.splice(summary >= 0 ? summary : order.length, 0, `custom:${id}`);
    set({ custom: [...form.custom, { id, label: "", type: "text", options: [], required: false }], order });
    setOpenKey(`custom:${id}`);
  };

  // Show / hide for the elements that can be hidden (the others are needed to deliver an order)
  const visibility = (key: string): { visible: boolean; toggle: () => void } | null => {
    switch (key) {
      case "quantity":
        return { visible: form.showQuantity, toggle: () => set({ showQuantity: !form.showQuantity }) };
      case "note":
        return { visible: form.note, toggle: () => set({ note: !form.note }) };
      case "summary":
        return { visible: form.showSummary, toggle: () => set({ showSummary: !form.showSummary }) };
      case "address":
        return { visible: form.address !== "hidden", toggle: () => set({ address: form.address === "hidden" ? "optional" : "hidden" }) };
    }
    return null;
  };

  const textSettings = (key: TextField) => (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={f.label} hint={f.defaultHint}>
        <Input value={form.labels[key]?.label ?? ""} maxLength={60} onChange={(e) => setLabel(key, { label: e.target.value })} aria-label={`${f.label} ${f.names[key]}`} />
      </Field>
      <Field label={f.placeholder} hint={f.defaultHint}>
        <Input value={form.labels[key]?.placeholder ?? ""} maxLength={80} onChange={(e) => setLabel(key, { placeholder: e.target.value })} aria-label={`${f.placeholder} ${f.names[key]}`} />
      </Field>
    </div>
  );

  const settingsOf = (key: string): ReactNode => {
    if (key === "variants") return <p className="text-sm text-muted">{f.variantsHint}</p>;
    if (key === "quantity")
      return (
        <div className="space-y-2">
          <Toggle checked={form.showQuantity} onChange={(showQuantity) => set({ showQuantity })} label={f.showQuantity} />
          <Toggle checked={form.showOffers} onChange={(showOffers) => set({ showOffers })} label={f.showOffers} />
        </div>
      );
    if (key === "summary") return <Toggle checked={form.showSummary} onChange={(showSummary) => set({ showSummary })} label={f.showSummary} />;
    if (key === "delivery") return <p className="text-sm text-muted">{f.deliveryHint}</p>;
    if (key === "address")
      return (
        <div className="space-y-3">
          {/* The address is only asked for home delivery */}
          <Field label={f.address}>
            <Select value={form.address} onChange={(e) => set({ address: e.target.value as FormSettings["address"] })} aria-label={f.address}>
              {(["hidden", "optional", "required"] as const).map((v) => (
                <option key={v} value={v}>
                  {f.addressModes[v]}
                </option>
              ))}
            </Select>
          </Field>
          {textSettings("address")}
        </div>
      );
    if ((textFields as readonly string[]).includes(key)) return textSettings(key as TextField);
    const b = form.blocks.find((x) => `el:${x.id}` === key);
    if (b)
      return (
        <div className="space-y-3" data-form-block={form.blocks.indexOf(b)}>
          {b.kind === "image" ? (
            <ImageManager t={t.media} value={b.image ? [b.image] : []} onChange={(imgs) => setBlock(b.id, { image: imgs[0] ?? "" })} max={1} />
          ) : null}
          {b.kind !== "divider" && b.kind !== "badges" && (
            <Field label={b.kind === "image" ? f.blockAlt : f.blockText}>
              {b.kind === "text" || b.kind === "notice" ? (
                <Textarea rows={2} maxLength={400} value={b.text} onChange={(e) => setBlock(b.id, { text: e.target.value })} aria-label={f.blockText} />
              ) : (
                <Input maxLength={120} value={b.text} onChange={(e) => setBlock(b.id, { text: e.target.value })} aria-label={b.kind === "image" ? f.blockAlt : f.blockText} />
              )}
            </Field>
          )}
          {(b.kind === "divider" || b.kind === "badges") && <p className="text-sm text-muted">{f.blockHints[b.kind]}</p>}
        </div>
      );
    const c = form.custom.find((x) => `custom:${x.id}` === key);
    if (!c) return null;
    return (
      <div className="space-y-2" data-custom-field={form.custom.indexOf(c)}>
        <div className="flex flex-wrap items-center gap-2">
          <Input aria-label={f.fieldLabel} placeholder={f.fieldLabel} className="min-w-40 flex-1" value={c.label} maxLength={60} onChange={(e) => setCustom(c.id, { label: e.target.value })} />
          <Select aria-label={f.fieldType} className="w-auto" value={c.type} onChange={(e) => setCustom(c.id, { type: e.target.value as CustomField["type"] })}>
            {customFieldTypes.map((type) => (
              <option key={type} value={type}>
                {f.fieldTypes[type]}
              </option>
            ))}
          </Select>
          <Toggle checked={c.required} onChange={(required) => setCustom(c.id, { required })} label={f.required} />
        </div>
        {choiceTypes.includes(c.type) && (
          <Field label={f.fieldOptions}>
            <Textarea rows={3} value={c.options.join("\n")} onChange={(e) => setCustom(c.id, { options: e.target.value.split("\n") })} aria-label={f.fieldOptions} />
          </Field>
        )}
      </div>
    );
  };

  const tabs: Tab[] = ["elements", "settings", "delivery", "thanks"];
  return (
    <div className="space-y-4" data-testid="form-editor">
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-panel p-1" role="tablist">
        {tabs.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap transition ${tab === k ? "bg-accent text-accent-fg shadow-sm" : "text-muted hover:bg-panel-2 hover:text-fg"}`}
            data-testid={`form-tab-${k}`}
          >
            {f.tabs[k]}
          </button>
        ))}
      </div>

      {tab === "elements" && (
        <>
          <Card className="space-y-3">
            <div>
              <h3 className="font-semibold">{f.appearance}</h3>
              <p className="mt-0.5 text-xs text-muted">{f.appearanceHint}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={f.appearance}>
              {formAppearances.map((a) => (
                <button
                  key={a}
                  type="button"
                  role="radio"
                  aria-checked={form.appearance === a}
                  onClick={() => set({ appearance: a })}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition ${form.appearance === a ? "border-accent bg-accent/5" : "border-line hover:border-field-line"}`}
                  data-testid={`appearance-${a}`}
                >
                  <span className={form.appearance === a ? "text-accent" : "text-muted"}>{appearanceIcons[a]}</span>
                  <span className="text-sm font-semibold">{f.appearances[a]}</span>
                  <span className="text-xs leading-snug text-muted">{f.appearanceHints[a]}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{f.elements}</h3>
                <p className="mt-0.5 text-xs text-muted">{f.elementsHint}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {form.custom.length < MAX_CUSTOM_FIELDS && (
                  <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white hover:opacity-90" onClick={addCustom}>
                    <Plus size={15} /> {f.addField}
                  </button>
                )}
                {form.blocks.length < MAX_FORM_BLOCKS && (
                  <span className="inline-flex items-center overflow-hidden rounded-lg border border-line">
                    <select aria-label={f.blockKind} value={newBlock} onChange={(e) => setNewBlock(e.target.value as FormBlock["kind"])} className="select-chevron appearance-none bg-panel py-2 ps-3 pe-8 text-sm" data-testid="block-kind">
                      {formBlockKinds.map((k) => (
                        <option key={k} value={k}>
                          {f.blockKinds[k]}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="inline-flex items-center gap-1.5 border-s border-line bg-ink px-3 py-2 text-sm font-semibold text-white hover:opacity-90" onClick={addBlock} data-testid="add-block">
                      <Plus size={15} /> {f.addElement}
                    </button>
                  </span>
                )}
              </div>
            </div>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line" data-testid="form-elements">
              {form.order.map((key, i) => {
                const custom = form.custom.find((c) => `custom:${c.id}` === key);
                const block = form.blocks.find((b) => `el:${b.id}` === key);
                const name = block ? `${f.blockKinds[block.kind]}${block.text ? `: ${block.text.slice(0, 40)}` : ""}` : custom ? custom.label || f.fieldLabel : f.names[key as FormElement];
                const icon = block ? <Shapes size={17} /> : custom ? <TextCursorInput size={17} /> : elementIcons[key as FormElement];
                const v = visibility(key);
                const hidden = v ? !v.visible : false;
                const isOpen = openKey === key;
                return (
                  <li
                    key={key}
                    draggable
                    onDragStart={() => setDragged(key)}
                    onDragEnd={() => setDragged(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragged && dragged !== key) move(form.order.indexOf(dragged), i);
                      setDragged(null);
                    }}
                    className={`bg-panel ${dragged === key ? "opacity-50" : ""}`}
                    data-element={key}
                  >
                    <div className={`flex items-center gap-2 px-2 py-2.5 ${hidden ? "opacity-55" : ""}`}>
                      <GripVertical size={16} className="shrink-0 cursor-grab text-muted" aria-hidden />
                      <span className="shrink-0 text-muted">{icon}</span>
                      <span className="me-auto min-w-0 truncate text-sm font-semibold">{name}</span>
                      <button type="button" title={f.moveUp} aria-label={`${f.moveUp}: ${name}`} disabled={i === 0} onClick={() => move(i, i - 1)} className="rounded-md p-1.5 text-muted hover:bg-panel-2 hover:text-fg disabled:opacity-30">
                        <ArrowUp size={15} />
                      </button>
                      <button type="button" title={f.moveDown} aria-label={`${f.moveDown}: ${name}`} disabled={i === form.order.length - 1} onClick={() => move(i, i + 1)} className="rounded-md p-1.5 text-muted hover:bg-panel-2 hover:text-fg disabled:opacity-30">
                        <ArrowDown size={15} />
                      </button>
                      <button type="button" title={f.settingsOf} aria-label={`${f.settingsOf}: ${name}`} aria-expanded={isOpen} onClick={() => setOpenKey(isOpen ? null : key)} className={`rounded-md p-1.5 hover:bg-panel-2 ${isOpen ? "text-accent" : "text-muted hover:text-fg"}`} data-testid="element-settings">
                        <Settings2 size={15} />
                      </button>
                      {v ? (
                        <button type="button" title={v.visible ? f.hide : f.show} aria-label={`${v.visible ? f.hide : f.show}: ${name}`} aria-pressed={!v.visible} onClick={v.toggle} className="rounded-md p-1.5 text-muted hover:bg-panel-2 hover:text-fg" data-testid="element-visibility">
                          {v.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                        </button>
                      ) : custom || block ? (
                        <button
                          type="button"
                          title={f.remove}
                          aria-label={`${f.remove}: ${name}`}
                          onClick={() =>
                            set({ custom: form.custom.filter((c) => c.id !== custom?.id), blocks: form.blocks.filter((b) => b.id !== block?.id), order: form.order.filter((k) => k !== key) })
                          }
                          className="rounded-md p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 size={15} />
                        </button>
                      ) : (
                        <span title={f.locked} className="p-1.5 text-muted/50">
                          <Lock size={15} />
                        </span>
                      )}
                    </div>
                    {isOpen && <div className="border-t border-line bg-panel-2/60 p-3">{settingsOf(key)}</div>}
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted">{f.customHint}</p>
          </Card>
        </>
      )}

      {tab === "settings" && (
        <>
          <Card className="space-y-3">
            <Field label={f.formTitle}>
              <Input value={form.title} maxLength={120} placeholder={defaults.title} onChange={(e) => set({ title: e.target.value })} aria-label={f.formTitle} />
            </Field>
            <Field label={f.formSubtitle}>
              <Input value={form.subtitle} maxLength={300} placeholder={defaults.subtitle} onChange={(e) => set({ subtitle: e.target.value })} aria-label={f.formSubtitle} />
            </Field>
            <Field label={f.buttonText}>
              <Input value={form.buttonText} maxLength={60} placeholder={defaults.button} onChange={(e) => set({ buttonText: e.target.value })} aria-label={f.buttonText} />
            </Field>
          </Card>
          <Card className="grid gap-3 sm:grid-cols-2">
            <Field label={f.layout}>
              <Select value={form.layout} onChange={(e) => set({ layout: e.target.value as FormSettings["layout"] })} aria-label={f.layout}>
                {(["compact", "stacked"] as const).map((v) => (
                  <option key={v} value={v}>
                    {f.layouts[v]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={f.buttonEffect}>
              <Select value={form.buttonEffect} onChange={(e) => set({ buttonEffect: e.target.value as FormSettings["buttonEffect"] })} aria-label={f.buttonEffect}>
                {buttonEffects.map((v) => (
                  <option key={v} value={v}>
                    {f.buttonEffects[v]}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="space-y-2 sm:col-span-2">
              <Toggle checked={form.icons} onChange={(icons) => set({ icons })} label={f.icons} testId="form-icons" />
              <Toggle checked={form.stepper} onChange={(stepper) => set({ stepper })} label={f.stepper} testId="form-stepper" />
              <p className="ps-6 text-xs text-muted">{f.stepperHint}</p>
              <Toggle checked={form.stickyButton} onChange={(stickyButton) => set({ stickyButton })} label={f.stickyButton} />
              <Toggle checked={form.showOffers} onChange={(showOffers) => set({ showOffers })} label={f.showOffers} />
              <Toggle checked={form.whatsapp} onChange={(whatsapp) => set({ whatsapp })} label={f.whatsapp} testId="form-whatsapp" />
              <p className="ps-6 text-xs text-muted">{f.whatsappHint}</p>
            </div>
          </Card>
        </>
      )}

      {tab === "delivery" && (
        <Card className="space-y-4">
          <Field label={f.delivery} hint={f.deliveryHint}>
            <Select value={form.delivery} onChange={(e) => set({ delivery: e.target.value as FormSettings["delivery"] })} aria-label={f.delivery}>
              {(["both", "home", "office"] as const).map((v) => (
                <option key={v} value={v}>
                  {f.deliveryModes[v]}
                </option>
              ))}
            </Select>
          </Field>
          {form.delivery === "both" && (
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">{f.preferDelivery}</legend>
              <div className="flex flex-wrap gap-4">
                {(["home", "office"] as const).map((v) => (
                  <label key={v} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="radio" name="preferDelivery" checked={form.preferDelivery === v} onChange={() => set({ preferDelivery: v })} className="size-4" />
                    {(v === "home" ? form.homeLabel : form.officeLabel) || f.deliveryModes[v]}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {form.delivery !== "office" && (
              <Field label={f.homeLabel} hint={f.defaultHint}>
                <Input value={form.homeLabel} maxLength={40} onChange={(e) => set({ homeLabel: e.target.value })} aria-label={f.homeLabel} />
              </Field>
            )}
            {form.delivery !== "home" && (
              <Field label={f.officeLabel} hint={f.defaultHint}>
                <Input value={form.officeLabel} maxLength={40} onChange={(e) => set({ officeLabel: e.target.value })} aria-label={f.officeLabel} />
              </Field>
            )}
          </div>
        </Card>
      )}

      {tab === "thanks" && (
        <Card>
          <Field label={f.thankYou}>
            <Textarea rows={3} maxLength={500} placeholder={f.thankYouPlaceholder} value={form.thankYou} onChange={(e) => set({ thankYou: e.target.value })} aria-label={f.thankYou} />
          </Field>
        </Card>
      )}
    </div>
  );
}
