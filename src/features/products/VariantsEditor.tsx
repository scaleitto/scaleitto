"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, ImagePlus, Layers, Plus, Trash2, X } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { OptionDisplay, ProductOption } from "@/server/db/schema";
import { optionDisplays } from "@/server/db/schema";
import { fmt } from "@/lib/format";
import { colorByName } from "@/lib/colors";
import { Input } from "@/ui";
import { uploadOne } from "@/ui/ImageManager";
import { combinations, displayOf, variantTitle } from "./variants";
import { MAX_OPTIONS, MAX_VALUES, MAX_VARIANTS } from "./constants";

export type VariantData = { sku: string; price: number | null; compareAtPrice: number | null; stock: number; active: boolean };
export const emptyVariant: VariantData = { sku: "", price: null, compareAtPrice: null, stock: 0, active: true };
const DEFAULT_SWATCH = "#9ca3af";
type Labels = Dictionary["products"]["variantEditor"];

// The options as they are saved: trimmed names, no empty or repeated values, a color for every value of color displays
export function cleanOptions(options: ProductOption[]): ProductOption[] {
  return options
    .map((o) => {
      const values = [...new Set(o.values.map((v) => v.trim()).filter(Boolean))];
      const display = displayOf(o);
      const { kind: _kind, ...rest } = o;
      return {
        ...rest,
        name: o.name.trim(),
        values,
        display,
        colors: display === "color" || display === "text_color" ? Object.fromEntries(values.map((v) => [v, o.colors?.[v] ?? colorByName(v) ?? DEFAULT_SWATCH])) : undefined,
        images: display === "image" ? Object.fromEntries(values.flatMap((v) => (o.images?.[v] ? [[v, o.images[v]]] : []))) : undefined,
        off: o.off?.filter((v) => values.includes(v)),
      };
    })
    .filter((o) => o.name && o.values.length);
}

// The combinations of the cleaned options with their saved price / SKU / stock / switch
export function variantRows(options: ProductOption[], data: Record<string, VariantData>) {
  return combinations(options).map((values) => {
    const title = variantTitle(values, options);
    return { title, values, ...(data[title] ?? emptyVariant) };
  });
}

const money = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.round(Number(v.replace(/\s/g, ""))) || 0));

// One value's look in the store (the preview row and the store's buttons share it)
function Swatch({ option, value }: { option: ProductOption; value: string }) {
  const d = displayOf(option);
  const color = option.colors?.[value] ?? colorByName(value) ?? DEFAULT_SWATCH;
  if (d === "color") return <span className="block size-8 rounded-full border border-line" style={{ background: color }} title={value} />;
  if (d === "image")
    return option.images?.[value] ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={option.images[value]} alt={value} className="size-10 rounded-lg border border-line object-cover" />
    ) : (
      <span className="grid size-10 place-items-center rounded-lg border border-dashed border-line text-[10px] text-muted">{value.slice(0, 3)}</span>
    );
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold">
      {d === "text_color" && <span className="size-3.5 rounded-full border border-line" style={{ background: color }} />}
      {value}
    </span>
  );
}

// Zimam's "Product variants": add a color / size / custom variant (3 at most), each with its display, optional and
// visible switches, its values (label, photo, color, on/off — 30 at most) and the generated combinations (150 at most)
// with their own price, old price, SKU, stock and on/off.
export function VariantsEditor({
  options,
  setOptions,
  variantData,
  setVariant,
  trackStock,
  t,
}: {
  options: ProductOption[];
  setOptions: (fn: (all: ProductOption[]) => ProductOption[]) => void;
  variantData: Record<string, VariantData>;
  setVariant: (title: string, patch: Partial<VariantData>) => void;
  trackStock: boolean;
  t: Labels;
}) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  useEffect(() => {
    if (!menu) return;
    const away = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [menu]);

  const update = (i: number, patch: Partial<ProductOption>) => setOptions((all) => all.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const move = (i: number, by: number) =>
    setOptions((all) => {
      const next = [...all];
      const [o] = next.splice(i, 1);
      next.splice(i + by, 0, o);
      return next;
    });
  const add = (kind: "color" | "size" | "custom") => {
    setMenu(false);
    setOptions((all) => [...all, { name: kind === "custom" ? "" : t.defaultNames[kind], values: [""], display: kind === "color" ? "color" : "text" }]);
  };
  const setValue = (i: number, k: number, label: string) =>
    setOptions((all) =>
      all.map((o, j) => {
        if (j !== i) return o;
        const old = o.values[k];
        const rename = <T,>(m?: Record<string, T>) => (m && old in m ? Object.fromEntries(Object.entries(m).map(([v, x]) => [v === old ? label : v, x])) : m);
        return { ...o, values: o.values.map((v, n) => (n === k ? label : v)), colors: rename(o.colors), images: rename(o.images), off: o.off?.map((v) => (v === old ? label : v)) };
      }),
    );
  const moveValue = (i: number, k: number, by: number) =>
    update(i, {
      values: (() => {
        const v = [...options[i].values];
        const [x] = v.splice(k, 1);
        v.splice(k + by, 0, x);
        return v;
      })(),
    });
  const toggleValue = (i: number, value: string) => {
    const off = options[i].off ?? [];
    update(i, { off: off.includes(value) ? off.filter((v) => v !== value) : [...off, value] });
  };
  const pickImage = async (i: number, value: string, file: File | undefined) => {
    if (!file || !value.trim()) return;
    setUploading(`${i}:${value}`);
    const res = await uploadOne(file);
    setUploading(null);
    if ("url" in res) update(i, { images: { ...options[i].images, [value]: res.url } });
  };

  const clean = cleanOptions(options);
  const rows = variantRows(clean, variantData);

  return (
    <div className="space-y-4" data-testid="variant-editor">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">{t.title}</h3>
        <div ref={menuRef} className="relative">
          <button
            type="button"
            disabled={options.length >= MAX_OPTIONS}
            onClick={() => setMenu(!menu)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white shadow-sm hover:bg-accent/90 disabled:opacity-50"
            data-testid="add-variant"
          >
            <Plus size={16} /> {fmt(t.add, { n: options.length, max: MAX_OPTIONS })}
          </button>
          {menu && (
            <div className="absolute end-0 top-12 z-20 w-48 rounded-xl border border-line bg-panel p-1 shadow-lift" role="menu">
              {(["color", "size", "custom"] as const).map((k) => (
                <button key={k} type="button" role="menuitem" onClick={() => add(k)} className="block w-full rounded-lg px-3 py-2 text-start text-sm hover:bg-panel-2" data-variant-kind={k}>
                  {t.kinds[k]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {options.length === 0 && (
        <div className="rounded-xl border border-dashed border-line p-8 text-center" data-testid="variants-empty">
          <Layers size={22} className="mx-auto text-muted" />
          <p className="mt-2 font-semibold">{t.empty}</p>
          <p className="text-sm text-muted">{t.emptyHint}</p>
        </div>
      )}

      {options.map((option, i) => {
        const d = displayOf(option);
        const usedValues = option.values.filter((v) => v.trim());
        return (
          <div key={i} className="overflow-hidden rounded-xl border border-line bg-panel-2/40" data-option={i}>
            <div className="flex flex-wrap items-end gap-4 p-4">
              <label className="min-w-40 flex-1 space-y-1">
                <span className="text-xs text-muted">{t.name}</span>
                <Input value={option.name} maxLength={40} placeholder={t.namePlaceholder} onChange={(e) => update(i, { name: e.target.value })} data-testid="option-name" />
              </label>
              <div className="space-y-1">
                <span className="block text-xs text-muted">{t.display}</span>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t.display}>
                  {optionDisplays.map((m: OptionDisplay) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={d === m}
                      onClick={() => update(i, { display: m, kind: undefined })}
                      className={`h-9 rounded-lg border px-3 text-xs font-semibold ${d === m ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-panel hover:bg-panel-2"}`}
                      data-display={m}
                    >
                      {t.displays[m]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" title={t.up} aria-label={t.up} disabled={i === 0} onClick={() => move(i, -1)} className="grid size-9 place-items-center rounded-lg border border-line bg-panel disabled:opacity-40">
                  <ArrowUp size={15} />
                </button>
                <button type="button" title={t.down} aria-label={t.down} disabled={i === options.length - 1} onClick={() => move(i, 1)} className="grid size-9 place-items-center rounded-lg border border-line bg-panel disabled:opacity-40">
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  aria-pressed={Boolean(option.optional)}
                  title={t.optionalHint}
                  onClick={() => update(i, { optional: !option.optional })}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold ${option.optional ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-panel"}`}
                  data-testid="option-optional"
                >
                  {option.optional && <Check size={13} />} {t.optional}
                </button>
                <button
                  type="button"
                  aria-pressed={!option.hidden}
                  title={option.hidden ? t.hiddenLabel : t.visible}
                  aria-label={option.hidden ? t.hiddenLabel : t.visible}
                  onClick={() => update(i, { hidden: !option.hidden })}
                  className={`grid size-9 place-items-center rounded-lg ${option.hidden ? "border border-line bg-panel text-muted" : "bg-accent-soft text-accent-ink"}`}
                  data-testid="option-visible"
                >
                  {option.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button type="button" title={t.remove} aria-label={t.remove} onClick={() => setOptions((all) => all.filter((_, j) => j !== i))} className="grid size-9 place-items-center rounded-lg text-danger hover:bg-danger/10" data-testid="option-remove">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-3 border-t border-line bg-panel p-4">
              {usedValues.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs text-muted">{t.preview}</span>
                  <div className="flex flex-wrap gap-2" data-testid="option-preview">
                    {usedValues.map((v) => (
                      <span key={v} className={option.off?.includes(v) ? "opacity-30" : ""}>
                        <Swatch option={option} value={v} />
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-transparent">
                    <tr className="text-xs text-muted">
                      <th className="p-2 text-start font-semibold">{t.cols.label}</th>
                      {d === "image" && <th className="p-2 text-center font-semibold">{t.cols.image}</th>}
                      {(d === "color" || d === "text_color") && <th className="p-2 text-center font-semibold">{t.cols.color}</th>}
                      <th className="p-2 text-center font-semibold">{t.cols.status}</th>
                      <th className="p-2 text-center font-semibold">{t.cols.action}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {option.values.map((value, k) => {
                      const on = !option.off?.includes(value);
                      const color = option.colors?.[value] ?? colorByName(value) ?? DEFAULT_SWATCH;
                      return (
                        <tr key={k} className="border-t border-line" data-value-row={k}>
                          <td className="p-2">
                            <Input value={value} maxLength={40} placeholder={t.valuePlaceholder} onChange={(e) => setValue(i, k, e.target.value)} className="min-w-32" aria-label={t.cols.label} data-testid="value-label" />
                          </td>
                          {d === "image" && (
                            <td className="p-2 text-center">
                              <label className={`relative inline-grid size-10 cursor-pointer place-items-center overflow-hidden rounded-lg border border-line text-muted hover:bg-panel-2 ${uploading === `${i}:${value}` ? "animate-pulse" : ""}`} title={t.pickImage}>
                                {option.images?.[value] ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={option.images[value]} alt="" className="size-full object-cover" />
                                ) : (
                                  <ImagePlus size={16} />
                                )}
                                <input type="file" accept="image/*" className="absolute inset-0 cursor-pointer opacity-0" aria-label={t.pickImage} disabled={!value.trim()} onChange={(e) => pickImage(i, value, e.target.files?.[0])} />
                              </label>
                            </td>
                          )}
                          {(d === "color" || d === "text_color") && (
                            <td className="p-2 text-center">
                              <label className="relative inline-block size-9 cursor-pointer overflow-hidden rounded-full border border-line" style={{ background: color }} title={t.pickColor}>
                                <input type="color" value={color} aria-label={t.pickColor} className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => update(i, { colors: { ...option.colors, [value]: e.target.value } })} data-testid="value-color" />
                              </label>
                            </td>
                          )}
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              aria-pressed={on}
                              title={on ? t.valueOn : t.valueOff}
                              aria-label={on ? t.valueOn : t.valueOff}
                              onClick={() => toggleValue(i, value)}
                              className={`inline-grid size-9 place-items-center rounded-lg ${on ? "bg-accent-soft text-accent-ink" : "border border-line text-muted"}`}
                              data-testid="value-status"
                            >
                              {on ? <Check size={16} /> : <X size={16} />}
                            </button>
                          </td>
                          <td className="p-2">
                            <div className="flex items-center justify-center gap-1">
                              <button type="button" aria-label={t.up} disabled={k === 0} onClick={() => moveValue(i, k, -1)} className="grid size-8 place-items-center rounded-lg border border-line disabled:opacity-40">
                                <ArrowUp size={14} />
                              </button>
                              <button type="button" aria-label={t.down} disabled={k === option.values.length - 1} onClick={() => moveValue(i, k, 1)} className="grid size-8 place-items-center rounded-lg border border-line disabled:opacity-40">
                                <ArrowDown size={14} />
                              </button>
                              <button type="button" aria-label={t.removeValue} onClick={() => update(i, { values: option.values.filter((_, n) => n !== k) })} className="grid size-8 place-items-center rounded-lg bg-danger/10 text-danger">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                disabled={option.values.length >= MAX_VALUES}
                onClick={() => update(i, { values: [...option.values, ""] })}
                className="mx-auto flex items-center gap-2 text-sm font-semibold text-accent hover:underline disabled:opacity-50"
                data-testid="add-value"
              >
                <span className="grid size-6 place-items-center rounded-full bg-accent-soft">
                  <Plus size={14} />
                </span>
                {fmt(t.addValue, { n: option.values.length, max: MAX_VALUES })}
              </button>
            </div>
          </div>
        );
      })}

      {options.length > 0 && (
        <p className={`rounded-xl border px-4 py-3 text-sm font-semibold ${rows.length > MAX_VARIANTS ? "border-danger/30 bg-danger/5 text-danger" : "border-line bg-panel-2/40"}`} data-testid="combo-count">
          {rows.length > MAX_VARIANTS ? fmt(t.tooMany, { max: MAX_VARIANTS }) : fmt(t.combos, { n: rows.length, max: MAX_VARIANTS })}
        </p>
      )}

      {rows.length > 0 && rows.length <= MAX_VARIANTS && (
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 font-semibold">
            <Layers size={17} className="text-accent" /> {t.combosTitle}
          </h3>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs">
                  <th className="p-2.5 text-start">{t.combosCols.combo}</th>
                  <th className="p-2.5 text-start">{t.combosCols.price}</th>
                  <th className="p-2.5 text-start">{t.combosCols.oldPrice}</th>
                  <th className="p-2.5 text-start">{t.combosCols.sku}</th>
                  {trackStock && <th className="p-2.5 text-start">{t.combosCols.stock}</th>}
                  <th className="p-2.5 text-center">{t.combosCols.status}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.title} className={`border-t border-line ${v.active ? "" : "opacity-60"}`} data-variant={v.title}>
                    <td className="p-2 font-medium whitespace-nowrap">{v.title}</td>
                    <td className="p-2">
                      <Input inputMode="numeric" dir="ltr" className="min-w-24" placeholder={t.samePrice} value={v.price ?? ""} onChange={(e) => setVariant(v.title, { price: money(e.target.value) })} aria-label={`${t.combosCols.price} ${v.title}`} />
                    </td>
                    <td className="p-2">
                      <Input inputMode="numeric" dir="ltr" className="min-w-24" value={v.compareAtPrice ?? ""} onChange={(e) => setVariant(v.title, { compareAtPrice: money(e.target.value) })} aria-label={`${t.combosCols.oldPrice} ${v.title}`} />
                    </td>
                    <td className="p-2">
                      <Input dir="ltr" className="min-w-24" maxLength={80} value={v.sku} onChange={(e) => setVariant(v.title, { sku: e.target.value })} aria-label={`${t.combosCols.sku} ${v.title}`} />
                    </td>
                    {trackStock && (
                      <td className="p-2">
                        <Input inputMode="numeric" dir="ltr" className="min-w-20" value={v.stock} onChange={(e) => setVariant(v.title, { stock: money(e.target.value) ?? 0 })} aria-label={`${t.combosCols.stock} ${v.title}`} />
                      </td>
                    )}
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        aria-pressed={v.active}
                        aria-label={v.active ? t.valueOn : t.valueOff}
                        onClick={() => setVariant(v.title, { active: !v.active })}
                        className={`inline-grid size-9 place-items-center rounded-lg ${v.active ? "bg-accent-soft text-accent-ink" : "border border-line text-muted"}`}
                        data-testid="variant-status"
                      >
                        {v.active ? <Check size={16} /> : <X size={16} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
