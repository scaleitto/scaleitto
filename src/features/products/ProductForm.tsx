"use client";

import Link from "next/link";
import { useState, type KeyboardEvent } from "react";
import { ArrowRight, ExternalLink, Palette, Plus, Trash2, X } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { offerBadges, type ProductOption, type QuantityOffer } from "@/server/db/schema";
import { offerTemplate } from "@/features/checkout/pricing";

// The quick offer buttons: 2 pieces −10%, 3 pieces −15%, buy 2 get 1 free, buy 3 get 2 free
const offerPresets = [
  { key: "2-10", kind: "pct", quantity: 2, value: 10 },
  { key: "3-15", kind: "pct", quantity: 3, value: 15 },
  { key: "3-1", kind: "free", quantity: 3, value: 1 },
  { key: "5-2", kind: "free", quantity: 5, value: 2 },
] as const;
import type { ActionState } from "@/lib/action";
import { fmt, formatPrice } from "@/lib/format";
import { colorByName, colorPalette } from "@/lib/colors";
import { Alert, Card, Field, Input, PageHeader, Select, Textarea, inputClass } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { ImageManager } from "@/ui/ImageManager";
import { combinations, variantTitle } from "./variants";
import { MAX_IMAGES, MAX_OFFERS, MAX_OPTIONS } from "./constants";
import type { ProductStatus } from "./types";
import { DescriptionButton } from "@/features/ai/DescriptionButton";
import type { PageLanguage } from "@/features/landing/types";

export type ProductFormValues = {
  name: string;
  slug: string;
  description: string;
  price: number | null;
  compareAtPrice: number | null;
  costPrice: number | null;
  sku: string;
  trackStock: boolean;
  stock: number;
  status: ProductStatus;
  images: string[];
  options: ProductOption[];
  offers: QuantityOffer[];
  variants: { title: string; sku: string | null; price: number | null; stock: number }[];
};

export type ProductFormText = Pick<Dictionary, "products" | "media" | "errors" | "common" | "assistant">;
type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;
type VariantData = { sku: string; price: number | null; stock: number };
const DEFAULT_SWATCH = "#9ca3af";

const toNumber = (v: string) => (v.trim() === "" ? null : Number(v.replace(/\s/g, "")));

export function ProductForm({ t, action, values, backHref, viewHref, isNew, ai }: { t: ProductFormText; action: Action; values: ProductFormValues; backHref: string; viewHref?: string; isNew: boolean; ai: { lang: string; language: PageLanguage } }) {
  const p = t.products;
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(action);
  const err = (field: string) => fieldError(state, e, field);

  const [images, setImages] = useState(values.images);
  const [options, setOptions] = useState<ProductOption[]>(values.options);
  const [pendingValues, setPendingValues] = useState<string[]>(values.options.map(() => ""));
  const [variantData, setVariantData] = useState<Record<string, VariantData>>(() =>
    Object.fromEntries(values.variants.map((v) => [v.title, { sku: v.sku ?? "", price: v.price, stock: v.stock }])),
  );
  const [offers, setOffers] = useState<QuantityOffer[]>(values.offers);
  const [trackStock, setTrackStock] = useState(values.trackStock);
  const [price, setPrice] = useState(values.price?.toString() ?? "");
  const [cost, setCost] = useState(values.costPrice?.toString() ?? "");

  // Values typed but not confirmed with Enter still count when saving.
  const effectiveOptions = options
    .map((o, i) => {
      const typed = pendingValues[i]?.trim();
      const values = typed && !o.values.includes(typed) ? [...o.values, typed] : o.values;
      if (o.kind !== "color") return { name: o.name.trim(), values };
      return { name: o.name.trim(), values, kind: o.kind, colors: Object.fromEntries(values.map((v) => [v, o.colors?.[v] ?? colorByName(v) ?? DEFAULT_SWATCH])) };
    })
    .filter((o) => o.name && o.values.length);
  const variants = combinations(effectiveOptions).map((values) => {
    const title = variantTitle(values, effectiveOptions);
    return { title, values, ...(variantData[title] ?? { sku: "", price: null, stock: 0 }) };
  });

  const updateOption = (i: number, patch: Partial<ProductOption>) => setOptions((all) => all.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const addValue = (i: number, color?: string) => {
    const value = pendingValues[i]?.trim();
    if (value && !options[i].values.includes(value)) addColorValue(i, value, color);
    setPendingValues((all) => all.map((v, j) => (j === i ? "" : v)));
  };
  // A value (with its swatch on color options); an existing value only gets the new color
  const addColorValue = (i: number, value: string, color?: string) =>
    setOptions((all) =>
      all.map((o, j) => {
        if (j !== i) return o;
        const values = o.values.includes(value) ? o.values : [...o.values, value];
        if (o.kind !== "color") return { ...o, values };
        return { ...o, values, colors: { ...o.colors, [value]: color ?? o.colors?.[value] ?? colorByName(value) ?? DEFAULT_SWATCH } };
      }),
    );
  const paletteName = (c: (typeof colorPalette)[number]) => c[ai.lang as "ar" | "fr" | "en"] ?? c.ar;
  const onValueKey = (i: number) => (ev: KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === "Enter" || ev.key === ",") {
      ev.preventDefault();
      addValue(i);
    } else if (ev.key === "Backspace" && !pendingValues[i] && options[i].values.length) {
      updateOption(i, { values: options[i].values.slice(0, -1) });
    }
  };
  const setVariant = (title: string, patch: Partial<VariantData>) =>
    setVariantData((all) => ({ ...all, [title]: { ...(all[title] ?? { sku: "", price: null, stock: 0 }), ...patch } }));

  const priceNum = toNumber(price);
  const costNum = toNumber(cost);
  const margin = priceNum && costNum !== null && !Number.isNaN(priceNum) && !Number.isNaN(costNum) ? priceNum - costNum : null;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <PageHeader
        title={isNew ? p.newTitle : p.editTitle}
        actions={
          <>
            <Link href={backHref} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-panel-2 hover:text-fg">
              <ArrowRight size={16} className="ltr:rotate-180" /> {t.common.back}
            </Link>
            {viewHref && (
              <a href={viewHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-panel-2 hover:text-fg">
                <ExternalLink size={16} /> {p.viewInStore}
              </a>
            )}
            <SubmitButton pending={pending} pendingText={t.common.loading}>
              {t.common.save}
            </SubmitButton>
          </>
        }
      />
      <FormMessage state={state} errors={e} success={t.common.saved} />

      <input type="hidden" name="images" value={JSON.stringify(images)} />
      <input type="hidden" name="options" value={JSON.stringify(effectiveOptions)} />
      <input type="hidden" name="variants" value={JSON.stringify(variants.map(({ title, sku, price, stock }) => ({ title, sku, price, stock })))} />
      <input type="hidden" name="offers" value={JSON.stringify(offers)} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="space-y-4">
            <h2 className="font-semibold">{p.basics}</h2>
            <Field label={p.name} htmlFor="name" error={err("name")}>
              <Input id="name" name="name" defaultValue={values.name} maxLength={200} />
            </Field>
            <Field label={p.description} htmlFor="description" hint={p.descriptionHint} error={err("description")}>
              <Textarea id="description" name="description" defaultValue={values.description} rows={6} dir="auto" />
            </Field>
            <DescriptionButton lang={ai.lang} language={ai.language} images={images} t={t} />
          </Card>

          <Card className="space-y-4">
            <h2 className="font-semibold">{p.images}</h2>
            <ImageManager t={t.media} value={images} onChange={setImages} max={MAX_IMAGES} />
            {err("images") && <p className="text-xs text-danger">{err("images")}</p>}
          </Card>

          <Card className="space-y-4" data-testid="variants">
            <div>
              <h2 className="font-semibold">{p.variants}</h2>
              <p className="mt-1 text-sm text-muted">{p.variantsHint}</p>
            </div>
            {options.map((option, i) => (
              <div key={i} className="grid gap-3 rounded-lg border border-line bg-panel-2/50 p-3 sm:grid-cols-[10rem_1fr_auto]" data-option={i}>
                <div className="space-y-2">
                  <Input aria-label={p.optionName} placeholder={p.optionNamePlaceholder} value={option.name} maxLength={40} onChange={(ev) => updateOption(i, { name: ev.target.value })} />
                  <Select aria-label={p.optionKind} value={option.kind ?? "text"} onChange={(ev) => updateOption(i, ev.target.value === "color" ? { kind: "color", colors: option.colors ?? {} } : { kind: undefined })} data-testid="option-kind">
                    <option value="text">{p.optionKinds.text}</option>
                    <option value="color">{p.optionKinds.color}</option>
                  </Select>
                </div>
                <div className={`${inputClass} flex flex-wrap items-center gap-1.5 self-start py-1.5`}>
                  {option.values.map((value) => (
                    <span key={value} className="inline-flex items-center gap-1 rounded-md bg-panel-2 px-2 py-0.5 text-xs">
                      {option.kind === "color" && (
                        <label className="relative size-4 cursor-pointer overflow-hidden rounded-full border border-field-line" style={{ background: option.colors?.[value] ?? colorByName(value) ?? DEFAULT_SWATCH }} title={p.pickColor}>
                          <input
                            type="color"
                            aria-label={`${p.pickColor} ${value}`}
                            className="absolute inset-0 cursor-pointer opacity-0"
                            value={option.colors?.[value] ?? colorByName(value) ?? DEFAULT_SWATCH}
                            onChange={(ev) => addColorValue(i, value, ev.target.value)}
                          />
                        </label>
                      )}
                      {value}
                      <button type="button" aria-label={`${p.remove} ${value}`} className="text-muted hover:text-danger" onClick={() => updateOption(i, { values: option.values.filter((v) => v !== value) })}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <input
                    aria-label={p.optionValues}
                    className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
                    placeholder={option.values.length ? "" : p.optionValuesPlaceholder}
                    value={pendingValues[i] ?? ""}
                    maxLength={40}
                    onChange={(ev) => setPendingValues((all) => all.map((v, j) => (j === i ? ev.target.value.replace(",", "") : v)))}
                    onKeyDown={onValueKey(i)}
                    onBlur={() => addValue(i)}
                  />
                </div>
                <button
                  type="button"
                  title={p.removeOption}
                  aria-label={p.removeOption}
                  className="justify-self-end rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger"
                  onClick={() => {
                    setOptions((all) => all.filter((_, j) => j !== i));
                    setPendingValues((all) => all.filter((_, j) => j !== i));
                  }}
                >
                  <Trash2 size={16} />
                </button>
                {option.kind === "color" && (
                  <div className="space-y-1.5 sm:col-span-3" data-testid="color-palette">
                    <p className="text-xs text-muted">{p.paletteHint}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {colorPalette.map((c) => {
                        const name = paletteName(c);
                        const used = option.values.includes(name);
                        return (
                          <button
                            key={c.hex}
                            type="button"
                            title={name}
                            aria-label={name}
                            aria-pressed={used}
                            onClick={() => (used ? updateOption(i, { values: option.values.filter((v) => v !== name) }) : addColorValue(i, name, c.hex))}
                            className={`size-7 rounded-full border border-field-line transition hover:scale-110 ${used ? "ring-2 ring-accent ring-offset-2 ring-offset-panel" : ""}`}
                            style={{ background: c.hex }}
                          />
                        );
                      })}
                      <label className="relative inline-flex size-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-field-line text-muted hover:text-fg" title={p.customColor}>
                        <Plus size={14} />
                        <input
                          type="color"
                          aria-label={p.customColor}
                          className="absolute inset-0 cursor-pointer opacity-0"
                          defaultValue="#4f3bd6"
                          onChange={(ev) => {
                            const hex = ev.target.value;
                            const typed = pendingValues[i]?.trim();
                            if (typed) addValue(i, hex);
                            else addColorValue(i, hex.toUpperCase(), hex);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div className="flex flex-wrap gap-x-5 gap-y-2">
            {options.length < MAX_OPTIONS && (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
                onClick={() => {
                  setOptions((all) => [...all, { name: "", values: [] }]);
                  setPendingValues((all) => [...all, ""]);
                }}
              >
                <Plus size={16} /> {p.addOption}
              </button>
            )}
            {options.length < MAX_OPTIONS && !options.some((o) => o.kind === "color") && (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
                data-testid="add-color-option"
                onClick={() => {
                  setOptions((all) => [...all, { name: p.colorOptionName, values: [], kind: "color", colors: {} }]);
                  setPendingValues((all) => [...all, ""]);
                }}
              >
                <Palette size={16} /> {p.addColorOption}
              </button>
            )}
            </div>
            {err("options") && <Alert>{err("options")}</Alert>}
            {variants.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-sm">
                  <thead className="bg-panel-2 text-xs text-muted">
                    <tr>
                      <th className="p-2 text-start font-medium">{p.variant}</th>
                      <th className="p-2 text-start font-medium">{p.price}</th>
                      <th className="p-2 text-start font-medium">{p.sku}</th>
                      {trackStock && <th className="p-2 text-start font-medium">{p.stock}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v) => (
                      <tr key={v.title} className="border-t border-line" data-variant={v.title}>
                        <td className="p-2 font-medium whitespace-nowrap">{v.title}</td>
                        <td className="p-2">
                          <Input
                            aria-label={`${p.price} ${v.title}`}
                            inputMode="numeric"
                            dir="ltr"
                            className="min-w-24"
                            placeholder={p.samePrice}
                            value={v.price ?? ""}
                            onChange={(ev) => setVariant(v.title, { price: toNumber(ev.target.value.replace(/\D/g, "")) })}
                          />
                        </td>
                        <td className="p-2">
                          <Input aria-label={`${p.sku} ${v.title}`} dir="ltr" className="min-w-24" value={v.sku} maxLength={80} onChange={(ev) => setVariant(v.title, { sku: ev.target.value })} />
                        </td>
                        {trackStock && (
                          <td className="p-2">
                            <Input
                              aria-label={`${p.stock} ${v.title}`}
                              inputMode="numeric"
                              dir="ltr"
                              className="min-w-20"
                              value={v.stock}
                              onChange={(ev) => setVariant(v.title, { stock: Number(ev.target.value.replace(/\D/g, "") || 0) })}
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="space-y-4" data-testid="offers">
            <div>
              <h2 className="font-semibold">{p.offers}</h2>
              <p className="mt-1 text-sm text-muted">{p.offersHint}</p>
            </div>
            {/* Ready-made offers from the price: percent off, or "buy N get M free" */}
            {(priceNum ?? 0) > 0 && offers.length < MAX_OFFERS && (
              <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="offer-templates">
                <span className="text-muted">{p.offerTemplates}</span>
                {offerPresets.map((t0) => {
                  const offer = offerTemplate(priceNum ?? 0, t0.kind, t0.quantity, t0.value);
                  const exists = offers.some((o) => o.quantity === offer.quantity);
                  return (
                    <button
                      key={t0.key}
                      type="button"
                      disabled={exists}
                      data-template={t0.key}
                      className="rounded-full border border-line px-3 py-1 font-medium hover:border-accent/40 hover:text-accent disabled:opacity-40"
                      onClick={() => setOffers((all) => [...all, { ...offer, label: fmt(t0.kind === "pct" ? p.presetPct : p.presetFree, { n: t0.quantity, v: t0.value, paid: t0.quantity - t0.value }) }].sort((a, b) => a.quantity - b.quantity))}
                    >
                      {fmt(t0.kind === "pct" ? p.presetPct : p.presetFree, { n: t0.quantity, v: t0.value, paid: t0.quantity - t0.value })}
                    </button>
                  );
                })}
              </div>
            )}
            {offers.map((offer, i) => {
              const set = (patch: Partial<QuantityOffer>) => setOffers((all) => all.map((o, j) => (j === i ? { ...o, ...patch } : o)));
              const full = (priceNum ?? 0) * offer.quantity;
              const saving = full > 0 && offer.price > 0 && offer.price < full ? Math.round(((full - offer.price) / full) * 100) : 0;
              return (
                <div key={i} className="space-y-3 rounded-lg border border-line bg-panel-2/50 p-3" data-offer={offer.quantity}>
                  <div className="grid items-end gap-3 sm:grid-cols-[6rem_9rem_1fr_auto]">
                    <Field label={p.quantity}>
                      <Input aria-label={p.quantity} inputMode="numeric" dir="ltr" value={offer.quantity || ""} onChange={(ev) => set({ quantity: Number(ev.target.value.replace(/\D/g, "") || 0) })} />
                    </Field>
                    <Field label={p.totalPrice}>
                      <Input aria-label={p.totalPrice} inputMode="numeric" dir="ltr" value={offer.price || ""} onChange={(ev) => set({ price: Number(ev.target.value.replace(/\D/g, "") || 0) })} />
                    </Field>
                    <Field label={p.offerLabel}>
                      <Input aria-label={p.offerLabel} placeholder={p.offerLabelPlaceholder} value={offer.label ?? ""} maxLength={60} onChange={(ev) => set({ label: ev.target.value })} />
                    </Field>
                    <button type="button" aria-label={p.remove} className="mb-1 rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger" onClick={() => setOffers((all) => all.filter((_, j) => j !== i))}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={p.offerGift}>
                      <Input aria-label={p.offerGift} placeholder={p.offerGiftPlaceholder} value={offer.gift ?? ""} maxLength={80} onChange={(ev) => set({ gift: ev.target.value })} />
                    </Field>
                    <Field label={p.offerBadge}>
                      <Select aria-label={p.offerBadge} value={offer.badge ?? ""} onChange={(ev) => set({ badge: (ev.target.value || undefined) as QuantityOffer["badge"] })}>
                        <option value="">{p.offerBadgeNone}</option>
                        {offerBadges.map((b) => (
                          <option key={b} value={b}>
                            {p.offerBadges[b]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input type="checkbox" checked={Boolean(offer.freeShipping)} onChange={(ev) => set({ freeShipping: ev.target.checked })} className="size-4 accent-[var(--color-accent)]" data-testid="offer-free-shipping" />
                      {p.offerFreeShipping}
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(offer.preselected)}
                        onChange={(ev) => setOffers((all) => all.map((o, j) => ({ ...o, preselected: j === i ? ev.target.checked : false })))}
                        className="size-4 accent-[var(--color-accent)]"
                        data-testid="offer-preselected"
                      />
                      {p.offerPreselected}
                    </label>
                    {offer.quantity >= 2 && offer.price > 0 && (
                      <span className="ms-auto text-xs text-muted">
                        {fmt(p.perPiece, { price: formatPrice(Math.round(offer.price / offer.quantity), t.common.currency) })}
                        {saving > 0 && <span className="ms-2 font-semibold text-accent">−{saving}%</span>}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {offers.length < MAX_OFFERS && (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
                onClick={() => {
                  const quantity = Math.max(1, ...offers.map((o) => o.quantity)) + 1;
                  setOffers((all) => [...all, { quantity, price: priceNum ? priceNum * quantity : 0, label: "" }]);
                }}
              >
                <Plus size={16} /> {p.addOffer}
              </button>
            )}
            {err("offers") && <Alert>{err("offers")}</Alert>}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-4">
            <Field label={p.status} htmlFor="status" hint={p.statusHint}>
              <Select id="status" name="status" defaultValue={values.status}>
                <option value="active">{p.statuses.active}</option>
                <option value="draft">{p.statuses.draft}</option>
              </Select>
            </Field>
            <Field label={p.slug} htmlFor="slug" hint={p.slugHint} error={err("slug")}>
              <Input id="slug" name="slug" dir="ltr" defaultValue={values.slug} maxLength={120} />
            </Field>
          </Card>

          <Card className="space-y-4">
            <h2 className="font-semibold">{p.pricing}</h2>
            <Field label={`${p.price} (${t.common.currency})`} htmlFor="price" error={err("price")}>
              <Input id="price" name="price" inputMode="numeric" dir="ltr" value={price} onChange={(ev) => setPrice(ev.target.value)} />
            </Field>
            <Field label={p.compareAtPrice} htmlFor="compareAtPrice" hint={p.compareAtPriceHint} error={err("compareAtPrice")}>
              <Input id="compareAtPrice" name="compareAtPrice" inputMode="numeric" dir="ltr" defaultValue={values.compareAtPrice ?? ""} />
            </Field>
            <Field label={p.costPrice} htmlFor="costPrice" hint={p.costPriceHint} error={err("costPrice")}>
              <Input id="costPrice" name="costPrice" inputMode="numeric" dir="ltr" value={cost} onChange={(ev) => setCost(ev.target.value)} />
            </Field>
            {margin !== null && priceNum ? (
              <p className={`text-sm ${margin >= 0 ? "text-accent" : "text-danger"}`}>
                {fmt(p.margin, { amount: formatPrice(margin, t.common.currency), percent: Math.round((margin / priceNum) * 100) })}
              </p>
            ) : null}
          </Card>

          <Card className="space-y-4">
            <h2 className="font-semibold">{p.inventory}</h2>
            <Field label={p.sku} htmlFor="sku" error={err("sku")}>
              <Input id="sku" name="sku" dir="ltr" defaultValue={values.sku} maxLength={80} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="trackStock" checked={trackStock} onChange={(ev) => setTrackStock(ev.target.checked)} className="size-4 accent-[var(--color-accent)]" />
              {p.trackStock}
            </label>
            {trackStock && variants.length === 0 && (
              <Field label={p.stock} htmlFor="stock" error={err("stock")}>
                <Input id="stock" name="stock" inputMode="numeric" dir="ltr" defaultValue={values.stock} />
              </Field>
            )}
          </Card>
        </div>
      </div>
      <div className="flex justify-end border-t border-line pt-4">
        <SubmitButton pending={pending} pendingText={t.common.loading}>
          {t.common.save}
        </SubmitButton>
      </div>
    </form>
  );
}
