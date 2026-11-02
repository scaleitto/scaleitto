"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  ArrowRight,
  Box,
  ExternalLink,
  Image as ImageIcon,
  ImageOff,
  Lock,
  Palette,
  Plus,
  ScanEye,
  Smartphone,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import {
  offerBadges,
  type ProductOption,
  type QuantityOffer,
} from "@/server/db/schema";
import { offerTemplate } from "@/features/checkout/pricing";
import type { ActionState } from "@/lib/action";
import { fmt, formatPrice } from "@/lib/format";
import { colorByName, colorPalette } from "@/lib/colors";
import {
  Alert,
  Card,
  Field,
  Input,
  Select,
  Textarea,
  buttonClass,
  inputClass,
} from "@/ui";
import {
  FormMessage,
  SubmitButton,
  fieldError,
  useActionForm,
} from "@/ui/form";
import { ImageManager } from "@/ui/ImageManager";
import { combinations, variantTitle } from "./variants";
import { MAX_IMAGES, MAX_OFFERS, MAX_OPTIONS } from "./constants";
import type { ProductStatus } from "./types";
import { DescriptionButton } from "@/features/ai/DescriptionButton";
import type { AiLanguage as PageLanguage } from "@/features/ai/languages";

// The quick offer buttons: 2 pieces −10%, 3 pieces −15%, buy 2 get 1 free, buy 3 get 2 free
const offerPresets = [
  { key: "2-10", kind: "pct", quantity: 2, value: 10 },
  { key: "3-15", kind: "pct", quantity: 3, value: 15 },
  { key: "3-1", kind: "free", quantity: 3, value: 1 },
  { key: "5-2", kind: "free", quantity: 5, value: 2 },
] as const;

export type ProductFormValues = {
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  price: number | null;
  compareAtPrice: number | null;
  sku: string;
  trackStock: boolean;
  stock: number;
  lowStock: number | null;
  showOutOfStock: boolean;
  status: ProductStatus;
  images: string[];
  descriptionImages: string[];
  options: ProductOption[];
  offers: QuantityOffer[];
  variants: {
    title: string;
    sku: string | null;
    price: number | null;
    stock: number;
  }[];
  carrierAccountId: string | null;
  similarIds: string[] | null;
};

export type ProductFormText = Pick<
  Dictionary,
  "products" | "media" | "errors" | "common" | "assistant"
>;
type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;
type VariantData = { sku: string; price: number | null; stock: number };
const DEFAULT_SWATCH = "#9ca3af";

// Zimam's editor tabs, and which fields live in each (a tab with an error gets a dot and opens after saving)
const tabs = [
  "details",
  "description",
  "variants",
  "delivery",
  "offers",
] as const;
type Tab = (typeof tabs)[number];
const tabFields: Record<Tab, string[]> = {
  details: [
    "name",
    "price",
    "compareAtPrice",
    "sku",
    "slug",
    "status",
    "images",
  ],
  description: ["description", "shortDescription", "descriptionImages"],
  variants: ["stock", "lowStock", "options", "variants"],
  delivery: ["carrierAccountId"],
  offers: ["offers", "similarIds"],
};

const toNumber = (v: string) =>
  v.trim() === "" ? null : Number(v.replace(/\s/g, ""));
const wordCount = (v: string) => v.split(/\s+/).filter(Boolean).length;

export function ProductForm({
  t,
  action,
  values,
  backHref,
  viewHref,
  isNew,
  ai,
  store,
  accounts,
  deliveryHref,
  others,
  notice,
}: {
  t: ProductFormText;
  action: Action;
  values: ProductFormValues;
  backHref: string;
  viewHref?: string;
  isNew: boolean;
  ai: { lang: string; language: PageLanguage };
  // The store's name and address (preview, product link)
  store: { name: string; host: string };
  // Connected delivery companies
  accounts: { id: string; name: string }[];
  deliveryHref: string;
  // The store's other products (similar products)
  others: { id: string; name: string; image: string | null }[];
  notice?: string;
}) {
  const p = t.products;
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(action);
  const err = (field: string) => fieldError(state, e, field);
  const formRef = useRef<HTMLFormElement>(null);

  const [tab, setTab] = useState<Tab>("details");
  const [name, setName] = useState(values.name);
  const [short, setShort] = useState(values.shortDescription);
  const [visible, setVisible] = useState(values.status === "active");
  const [images, setImages] = useState(values.images);
  const [descImages, setDescImages] = useState(values.descriptionImages);
  const [options, setOptions] = useState<ProductOption[]>(values.options);
  const [pendingValues, setPendingValues] = useState<string[]>(
    values.options.map(() => ""),
  );
  const [variantData, setVariantData] = useState<Record<string, VariantData>>(
    () =>
      Object.fromEntries(
        values.variants.map((v) => [
          v.title,
          { sku: v.sku ?? "", price: v.price, stock: v.stock },
        ]),
      ),
  );
  const [offers, setOffers] = useState<QuantityOffer[]>(values.offers);
  const [trackStock, setTrackStock] = useState(values.trackStock);
  const [price, setPrice] = useState(values.price?.toString() ?? "");
  const [oldPrice, setOldPrice] = useState(
    values.compareAtPrice?.toString() ?? "",
  );
  const [similarMode, setSimilarMode] = useState<"auto" | "chosen">(
    values.similarIds ? "chosen" : "auto",
  );
  const [similar, setSimilar] = useState<string[]>(values.similarIds ?? []);

  // After a failed save, open the first tab that holds an error
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    const bad = tabs.find((k) =>
      tabFields[k].some((f) => state.fieldErrors?.[f]),
    );
    if (bad) setTab(bad);
  }
  const tabHasError = (k: Tab) =>
    tabFields[k].some((f) => state.fieldErrors?.[f]);

  // Values typed but not confirmed with Enter still count when saving.
  const effectiveOptions = options
    .map((o, i) => {
      const typed = pendingValues[i]?.trim();
      const values =
        typed && !o.values.includes(typed) ? [...o.values, typed] : o.values;
      if (o.kind !== "color") return { name: o.name.trim(), values };
      return {
        name: o.name.trim(),
        values,
        kind: o.kind,
        colors: Object.fromEntries(
          values.map((v) => [
            v,
            o.colors?.[v] ?? colorByName(v) ?? DEFAULT_SWATCH,
          ]),
        ),
      };
    })
    .filter((o) => o.name && o.values.length);
  const variants = combinations(effectiveOptions).map((values) => {
    const title = variantTitle(values, effectiveOptions);
    return {
      title,
      values,
      ...(variantData[title] ?? { sku: "", price: null, stock: 0 }),
    };
  });

  const updateOption = (i: number, patch: Partial<ProductOption>) =>
    setOptions((all) => all.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const addValue = (i: number, color?: string) => {
    const value = pendingValues[i]?.trim();
    if (value && !options[i].values.includes(value))
      addColorValue(i, value, color);
    setPendingValues((all) => all.map((v, j) => (j === i ? "" : v)));
  };
  // A value (with its swatch on color options); an existing value only gets the new color
  const addColorValue = (i: number, value: string, color?: string) =>
    setOptions((all) =>
      all.map((o, j) => {
        if (j !== i) return o;
        const values = o.values.includes(value)
          ? o.values
          : [...o.values, value];
        if (o.kind !== "color") return { ...o, values };
        return {
          ...o,
          values,
          colors: {
            ...o.colors,
            [value]:
              color ??
              o.colors?.[value] ??
              colorByName(value) ??
              DEFAULT_SWATCH,
          },
        };
      }),
    );
  const addOption = (option: ProductOption) => {
    setOptions((all) => [...all, option]);
    setPendingValues((all) => [...all, ""]);
  };
  const paletteName = (c: (typeof colorPalette)[number]) =>
    c[ai.lang as "ar" | "fr" | "en"] ?? c.ar;
  const onValueKey = (i: number) => (ev: KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === "Enter" || ev.key === ",") {
      ev.preventDefault();
      addValue(i);
    } else if (
      ev.key === "Backspace" &&
      !pendingValues[i] &&
      options[i].values.length
    ) {
      updateOption(i, { values: options[i].values.slice(0, -1) });
    }
  };
  const setVariant = (title: string, patch: Partial<VariantData>) =>
    setVariantData((all) => ({
      ...all,
      [title]: {
        ...(all[title] ?? { sku: "", price: null, stock: 0 }),
        ...patch,
      },
    }));

  const priceNum = toNumber(price);
  const oldNum = toNumber(oldPrice);

  // "Clear": an empty form again (new products only)
  const clear = () => {
    formRef.current?.reset();
    setName("");
    setShort("");
    setVisible(true);
    setImages([]);
    setDescImages([]);
    setOptions([]);
    setPendingValues([]);
    setVariantData({});
    setOffers([]);
    setTrackStock(false);
    setPrice("");
    setOldPrice("");
    setSimilarMode("auto");
    setSimilar([]);
    setTab("details");
  };

  const toggle = (
    checked: boolean,
    onChange: (v: boolean) => void,
    label: string,
    hint?: string,
    testId?: string,
    disabled?: boolean,
  ) => (
    <label
      className={`flex items-start justify-between gap-4 rounded-xl border border-line p-3 ${disabled ? "opacity-60" : "cursor-pointer"}`}
    >
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && (
          <span className="mt-0.5 block text-xs text-muted">{hint}</span>
        )}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(ev) => onChange(ev.target.checked)}
        className="peer sr-only"
        data-testid={testId}
      />
      <span
        aria-hidden
        className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-accent after:absolute after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition-all after:start-0.5 peer-checked:after:start-[1.125rem]"
      />
    </label>
  );
  const panel = (key: Tab, children: ReactNode) => (
    <div hidden={tab !== key} className="space-y-6" data-panel={key}>
      {children}
    </div>
  );

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      className="space-y-6"
      data-testid="product-form"
    >
      {/* Zimam's header: a square back button next to the title */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href={backHref} className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-panel text-fg hover:bg-panel-2" title={t.common.back} aria-label={t.common.back}>
          <ArrowRight size={18} className="ltr:rotate-180" />
        </Link>
        <h1 className="me-auto text-2xl font-bold tracking-tight text-fg">{isNew ? p.newTitle : p.editTitle}</h1>
        {viewHref && (
          <a href={viewHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-panel-2 hover:text-fg">
            <ExternalLink size={16} /> {p.viewInStore}
          </a>
        )}
      </div>
      {notice && <Alert variant="success">{notice}</Alert>}

      <input type="hidden" name="status" value={visible ? "active" : "draft"} />
      <input type="hidden" name="images" value={JSON.stringify(images)} />
      <input
        type="hidden"
        name="descriptionImages"
        value={JSON.stringify(descImages)}
      />
      <input
        type="hidden"
        name="options"
        value={JSON.stringify(effectiveOptions)}
      />
      <input
        type="hidden"
        name="variants"
        value={JSON.stringify(
          variants.map(({ title, sku, price, stock }) => ({
            title,
            sku,
            price,
            stock,
          })),
        )}
      />
      <input type="hidden" name="offers" value={JSON.stringify(offers)} />
      <input type="hidden" name="similar" value={similarMode} />
      <input
        type="hidden"
        name="similarIds"
        value={JSON.stringify(similarMode === "chosen" ? similar : [])}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <nav className="flex gap-1 overflow-x-auto border-b border-line" role="tablist" data-testid="product-tabs">
            {tabs.map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                data-form-tab={k}
                onClick={() => setTab(k)}
                className={`relative -mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${tab === k ? "border-accent font-semibold text-fg" : "border-transparent text-muted hover:text-fg"}`}
              >
                {p.tabs[k]}
                {tabHasError(k) && <span className="absolute top-2 end-0.5 size-1.5 rounded-full bg-danger" aria-hidden />}
              </button>
            ))}
          </nav>

          {panel(
            "details",
            <>
              <Card className="space-y-6">
                <div className="space-y-2">
                  <div className="inline-flex overflow-hidden rounded-lg border border-line" aria-label={p.kind}>
                    <span className="flex items-center gap-1.5 bg-accent px-3.5 py-2 text-sm font-semibold text-white" aria-current="true">
                      <Box size={15} /> {p.kinds.physical}
                    </span>
                    <span className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-muted" aria-disabled="true">
                      <Lock size={14} /> {p.kinds.digital}
                    </span>
                  </div>
                  <p className="text-xs text-muted">{p.kindHint}</p>
                </div>

                <div className="space-y-3">
                  <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
                    <ImageIcon size={17} className="text-accent" /> {p.images}
                  </h2>
                  <ImageManager t={t.media} value={images} onChange={setImages} max={MAX_IMAGES} dropzone />
                  {err("images") && <p className="text-xs text-danger">{err("images")}</p>}
                </div>

                <div className="space-y-4 border-t border-line pt-6">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Tag size={18} className="text-accent" /> {p.info}
                </h2>
                <Field label={p.name} htmlFor="name" error={err("name")}>
                  <Input
                    id="name"
                    name="name"
                    value={name}
                    onChange={(ev) => setName(ev.target.value)}
                    maxLength={200}
                  />
                </Field>
                {toggle(
                  visible,
                  setVisible,
                  p.visible,
                  p.visibleHint,
                  "visible",
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label={`${p.price} (${t.common.currency})`}
                    htmlFor="price"
                    error={err("price")}
                  >
                    <Input
                      id="price"
                      name="price"
                      inputMode="numeric"
                      dir="ltr"
                      value={price}
                      onChange={(ev) => setPrice(ev.target.value)}
                    />
                  </Field>
                  <Field
                    label={p.compareAtPrice}
                    htmlFor="compareAtPrice"
                    hint={p.compareAtPriceHint}
                    error={err("compareAtPrice")}
                  >
                    <Input
                      id="compareAtPrice"
                      name="compareAtPrice"
                      inputMode="numeric"
                      dir="ltr"
                      value={oldPrice}
                      onChange={(ev) => setOldPrice(ev.target.value)}
                    />
                  </Field>
                  <Field label={p.sku} htmlFor="sku" error={err("sku")}>
                    <Input
                      id="sku"
                      name="sku"
                      dir="ltr"
                      defaultValue={values.sku}
                      maxLength={80}
                    />
                  </Field>
                </div>
                <Field
                  label={p.productUrl}
                  htmlFor="slug"
                  hint={p.slugHint}
                  error={err("slug")}
                >
                  <div
                    className={`${inputClass} flex items-center gap-0 p-0`}
                    dir="ltr"
                  >
                    <span className="shrink-0 border-e border-field-line px-3 py-2.5 text-xs text-muted">
                      {store.host}/p/
                    </span>
                    <input
                      id="slug"
                      name="slug"
                      defaultValue={values.slug}
                      maxLength={120}
                      className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
                    />
                  </div>
                </Field>
                </div>
              </Card>
            </>,
          )}

          {panel(
            "description",
            <>
              <Card className="space-y-2 border-accent/30 bg-accent-soft/40">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Sparkles size={17} className="text-accent" /> {p.aiWriter}
                </h2>
                <p className="text-sm text-muted">{p.aiWriterHint}</p>
                <DescriptionButton
                  lang={ai.lang}
                  language={ai.language}
                  images={images}
                  t={t}
                />
              </Card>
              <Card className="space-y-4">
                <Field
                  label={p.shortDescription}
                  htmlFor="shortDescription"
                  hint={`${p.shortDescriptionHint} · ${fmt(p.words, { n: wordCount(short) })}`}
                  error={err("shortDescription")}
                >
                  <Input
                    id="shortDescription"
                    name="shortDescription"
                    value={short}
                    maxLength={120}
                    onChange={(ev) => setShort(ev.target.value)}
                    dir="auto"
                  />
                </Field>
                <Field
                  label={p.description}
                  htmlFor="description"
                  hint={p.descriptionHint}
                  error={err("description")}
                >
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={values.description}
                    rows={8}
                    dir="auto"
                  />
                </Field>
              </Card>
              <Card className="space-y-4">
                <div>
                  <h2 className="font-semibold">{p.descriptionImages}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {p.descriptionImagesHint}
                  </p>
                </div>
                <ImageManager
                  t={t.media}
                  value={descImages}
                  onChange={setDescImages}
                  max={MAX_IMAGES}
                />
              </Card>
            </>,
          )}

          {panel(
            "variants",
            <>
              <Card className="space-y-4">
                <h2 className="font-semibold">{p.stockSection}</h2>
                {toggle(
                  trackStock,
                  setTrackStock,
                  p.trackStock,
                  undefined,
                  "track-stock",
                )}
                {trackStock && (
                  <input type="hidden" name="trackStock" value="on" />
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  {trackStock && variants.length === 0 && (
                    <Field label={p.stock} htmlFor="stock" error={err("stock")}>
                      <Input
                        id="stock"
                        name="stock"
                        inputMode="numeric"
                        dir="ltr"
                        defaultValue={values.stock}
                      />
                    </Field>
                  )}
                  {trackStock && (
                    <Field
                      label={p.lowStock}
                      htmlFor="lowStock"
                      hint={p.lowStockHint}
                      error={err("lowStock")}
                    >
                      <Input
                        id="lowStock"
                        name="lowStock"
                        inputMode="numeric"
                        dir="ltr"
                        defaultValue={values.lowStock ?? ""}
                      />
                    </Field>
                  )}
                </div>
                <ShowOutOfStock
                  initial={values.showOutOfStock}
                  render={(v, set) =>
                    toggle(
                      v,
                      set,
                      p.showOutOfStock,
                      p.showOutOfStockHint,
                      "show-out-of-stock",
                    )
                  }
                />
              </Card>

              <Card className="space-y-4" data-testid="variants">
                {toggle(
                  options.length > 0,
                  (on) => {
                    if (on) addOption({ name: "", values: [] });
                    else {
                      setOptions([]);
                      setPendingValues([]);
                    }
                  },
                  p.hasVariants,
                  p.variantsHint,
                  "has-variants",
                )}
                {options.map((option, i) => (
                  <div
                    key={i}
                    className="grid gap-3 rounded-lg border border-line bg-panel-2/50 p-3 sm:grid-cols-[10rem_1fr_auto]"
                    data-option={i}
                  >
                    <div className="space-y-2">
                      <Input
                        aria-label={p.optionName}
                        placeholder={p.optionNamePlaceholder}
                        value={option.name}
                        maxLength={40}
                        onChange={(ev) =>
                          updateOption(i, { name: ev.target.value })
                        }
                      />
                      <Select
                        aria-label={p.optionKind}
                        value={option.kind ?? "text"}
                        onChange={(ev) =>
                          updateOption(
                            i,
                            ev.target.value === "color"
                              ? { kind: "color", colors: option.colors ?? {} }
                              : { kind: undefined },
                          )
                        }
                        data-testid="option-kind"
                      >
                        <option value="text">{p.optionKinds.text}</option>
                        <option value="color">{p.optionKinds.color}</option>
                      </Select>
                    </div>
                    <div
                      className={`${inputClass} flex flex-wrap items-center gap-1.5 self-start py-1.5`}
                    >
                      {option.values.map((value) => (
                        <span
                          key={value}
                          className="inline-flex items-center gap-1 rounded-md bg-panel-2 px-2 py-0.5 text-xs"
                        >
                          {option.kind === "color" && (
                            <label
                              className="relative size-4 cursor-pointer overflow-hidden rounded-full border border-field-line"
                              style={{
                                background:
                                  option.colors?.[value] ??
                                  colorByName(value) ??
                                  DEFAULT_SWATCH,
                              }}
                              title={p.pickColor}
                            >
                              <input
                                type="color"
                                aria-label={`${p.pickColor} ${value}`}
                                className="absolute inset-0 cursor-pointer opacity-0"
                                value={
                                  option.colors?.[value] ??
                                  colorByName(value) ??
                                  DEFAULT_SWATCH
                                }
                                onChange={(ev) =>
                                  addColorValue(i, value, ev.target.value)
                                }
                              />
                            </label>
                          )}
                          {value}
                          <button
                            type="button"
                            aria-label={`${p.remove} ${value}`}
                            className="text-muted hover:text-danger"
                            onClick={() =>
                              updateOption(i, {
                                values: option.values.filter(
                                  (v) => v !== value,
                                ),
                              })
                            }
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                      <input
                        aria-label={p.optionValues}
                        className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
                        placeholder={
                          option.values.length ? "" : p.optionValuesPlaceholder
                        }
                        value={pendingValues[i] ?? ""}
                        maxLength={40}
                        onChange={(ev) =>
                          setPendingValues((all) =>
                            all.map((v, j) =>
                              j === i ? ev.target.value.replace(",", "") : v,
                            ),
                          )
                        }
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
                        setPendingValues((all) =>
                          all.filter((_, j) => j !== i),
                        );
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                    {option.kind === "color" && (
                      <div
                        className="space-y-1.5 sm:col-span-3"
                        data-testid="color-palette"
                      >
                        <p className="text-xs text-muted">{p.paletteHint}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {colorPalette.map((c) => {
                            const label = paletteName(c);
                            const used = option.values.includes(label);
                            return (
                              <button
                                key={c.hex}
                                type="button"
                                title={label}
                                aria-label={label}
                                aria-pressed={used}
                                onClick={() =>
                                  used
                                    ? updateOption(i, {
                                        values: option.values.filter(
                                          (v) => v !== label,
                                        ),
                                      })
                                    : addColorValue(i, label, c.hex)
                                }
                                className={`size-7 rounded-full border border-field-line transition hover:scale-110 ${used ? "ring-2 ring-accent ring-offset-2 ring-offset-panel" : ""}`}
                                style={{ background: c.hex }}
                              />
                            );
                          })}
                          <label
                            className="relative inline-flex size-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-field-line text-muted hover:text-fg"
                            title={p.customColor}
                          >
                            <Plus size={14} />
                            <input
                              type="color"
                              aria-label={p.customColor}
                              className="absolute inset-0 cursor-pointer opacity-0"
                              defaultValue="#4f3bd6"
                              onChange={(ev) => {
                                const hex = ev.target.value;
                                if (pendingValues[i]?.trim()) addValue(i, hex);
                                else addColorValue(i, hex.toUpperCase(), hex);
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {options.length > 0 && options.length < MAX_OPTIONS && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
                        onClick={() => addOption({ name: "", values: [] })}
                      >
                        <Plus size={16} /> {p.addOption}
                      </button>
                    )}
                    {options.length < MAX_OPTIONS &&
                      !options.some((o) => o.kind === "color") && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
                          data-testid="add-color-option"
                          onClick={() =>
                            addOption({
                              name: p.colorOptionName,
                              values: [],
                              kind: "color",
                              colors: {},
                            })
                          }
                        >
                          <Palette size={16} /> {p.addColorOption}
                        </button>
                      )}
                  </div>
                }
                {err("options") && <Alert>{err("options")}</Alert>}
                {variants.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-line">
                    <table className="w-full text-sm">
                      <thead className="bg-panel-2 text-xs text-muted">
                        <tr>
                          <th className="p-2 text-start font-medium">
                            {p.variant}
                          </th>
                          <th className="p-2 text-start font-medium">
                            {p.price}
                          </th>
                          <th className="p-2 text-start font-medium">
                            {p.sku}
                          </th>
                          {trackStock && (
                            <th className="p-2 text-start font-medium">
                              {p.stock}
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {variants.map((v) => (
                          <tr
                            key={v.title}
                            className="border-t border-line"
                            data-variant={v.title}
                          >
                            <td className="p-2 font-medium whitespace-nowrap">
                              {v.title}
                            </td>
                            <td className="p-2">
                              <Input
                                aria-label={`${p.price} ${v.title}`}
                                inputMode="numeric"
                                dir="ltr"
                                className="min-w-24"
                                placeholder={p.samePrice}
                                value={v.price ?? ""}
                                onChange={(ev) =>
                                  setVariant(v.title, {
                                    price: toNumber(
                                      ev.target.value.replace(/\D/g, ""),
                                    ),
                                  })
                                }
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                aria-label={`${p.sku} ${v.title}`}
                                dir="ltr"
                                className="min-w-24"
                                value={v.sku}
                                maxLength={80}
                                onChange={(ev) =>
                                  setVariant(v.title, { sku: ev.target.value })
                                }
                              />
                            </td>
                            {trackStock && (
                              <td className="p-2">
                                <Input
                                  aria-label={`${p.stock} ${v.title}`}
                                  inputMode="numeric"
                                  dir="ltr"
                                  className="min-w-20"
                                  value={v.stock}
                                  onChange={(ev) =>
                                    setVariant(v.title, {
                                      stock: Number(
                                        ev.target.value.replace(/\D/g, "") || 0,
                                      ),
                                    })
                                  }
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
            </>,
          )}

          {panel(
            "delivery",
            <Card className="space-y-4">
              <h2 className="font-semibold">{p.deliverySection}</h2>
              <Field
                label={p.carrier}
                htmlFor="carrierAccountId"
                hint={p.carrierHint}
                error={err("carrierAccountId")}
              >
                {accounts.length ? (
                  <Select
                    id="carrierAccountId"
                    name="carrierAccountId"
                    defaultValue={values.carrierAccountId ?? ""}
                  >
                    <option value="">{p.carrierAuto}</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <p className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-line p-3 text-sm text-muted">
                    {p.noCarrier}
                    <Link
                      href={deliveryHref}
                      className="font-semibold text-accent hover:underline"
                    >
                      {p.connectCarrier}
                    </Link>
                  </p>
                )}
              </Field>
              {toggle(
                false,
                () => undefined,
                p.onlinePayment,
                p.onlinePaymentHint,
                "online-only",
                true,
              )}
            </Card>,
          )}

          {panel(
            "offers",
            <>
              <Card className="space-y-4" data-testid="offers">
                <div>
                  <h2 className="font-semibold">{p.offers}</h2>
                  <p className="mt-1 text-sm text-muted">{p.offersHint}</p>
                </div>
                {/* Ready-made offers from the price: percent off, or "buy N get M free" */}
                {(priceNum ?? 0) > 0 && offers.length < MAX_OFFERS && (
                  <div
                    className="flex flex-wrap items-center gap-2 text-sm"
                    data-testid="offer-templates"
                  >
                    <span className="text-muted">{p.offerTemplates}</span>
                    {offerPresets.map((t0) => {
                      const offer = offerTemplate(
                        priceNum ?? 0,
                        t0.kind,
                        t0.quantity,
                        t0.value,
                      );
                      const exists = offers.some(
                        (o) => o.quantity === offer.quantity,
                      );
                      const label = fmt(
                        t0.kind === "pct" ? p.presetPct : p.presetFree,
                        {
                          n: t0.quantity,
                          v: t0.value,
                          paid: t0.quantity - t0.value,
                        },
                      );
                      return (
                        <button
                          key={t0.key}
                          type="button"
                          disabled={exists}
                          data-template={t0.key}
                          className="rounded-full border border-line px-3 py-1 font-medium hover:border-accent/40 hover:text-accent disabled:opacity-40"
                          onClick={() =>
                            setOffers((all) =>
                              [...all, { ...offer, label }].sort(
                                (a, b) => a.quantity - b.quantity,
                              ),
                            )
                          }
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
                {offers.map((offer, i) => {
                  const set = (patch: Partial<QuantityOffer>) =>
                    setOffers((all) =>
                      all.map((o, j) => (j === i ? { ...o, ...patch } : o)),
                    );
                  const full = (priceNum ?? 0) * offer.quantity;
                  const saving =
                    full > 0 && offer.price > 0 && offer.price < full
                      ? Math.round(((full - offer.price) / full) * 100)
                      : 0;
                  return (
                    <div
                      key={i}
                      className="space-y-3 rounded-lg border border-line bg-panel-2/50 p-3"
                      data-offer={offer.quantity}
                    >
                      <div className="grid items-end gap-3 sm:grid-cols-[6rem_9rem_1fr_auto]">
                        <Field label={p.quantity}>
                          <Input
                            aria-label={p.quantity}
                            inputMode="numeric"
                            dir="ltr"
                            value={offer.quantity || ""}
                            onChange={(ev) =>
                              set({
                                quantity: Number(
                                  ev.target.value.replace(/\D/g, "") || 0,
                                ),
                              })
                            }
                          />
                        </Field>
                        <Field label={p.totalPrice}>
                          <Input
                            aria-label={p.totalPrice}
                            inputMode="numeric"
                            dir="ltr"
                            value={offer.price || ""}
                            onChange={(ev) =>
                              set({
                                price: Number(
                                  ev.target.value.replace(/\D/g, "") || 0,
                                ),
                              })
                            }
                          />
                        </Field>
                        <Field label={p.offerLabel}>
                          <Input
                            aria-label={p.offerLabel}
                            placeholder={p.offerLabelPlaceholder}
                            value={offer.label ?? ""}
                            maxLength={60}
                            onChange={(ev) => set({ label: ev.target.value })}
                          />
                        </Field>
                        <button
                          type="button"
                          aria-label={p.remove}
                          className="mb-1 rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger"
                          onClick={() =>
                            setOffers((all) => all.filter((_, j) => j !== i))
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label={p.offerGift}>
                          <Input
                            aria-label={p.offerGift}
                            placeholder={p.offerGiftPlaceholder}
                            value={offer.gift ?? ""}
                            maxLength={80}
                            onChange={(ev) => set({ gift: ev.target.value })}
                          />
                        </Field>
                        <Field label={p.offerBadge}>
                          <Select
                            aria-label={p.offerBadge}
                            value={offer.badge ?? ""}
                            onChange={(ev) =>
                              set({
                                badge: (ev.target.value ||
                                  undefined) as QuantityOffer["badge"],
                              })
                            }
                          >
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
                          <input
                            type="checkbox"
                            checked={Boolean(offer.freeShipping)}
                            onChange={(ev) =>
                              set({ freeShipping: ev.target.checked })
                            }
                            className="size-4 accent-[var(--color-accent)]"
                            data-testid="offer-free-shipping"
                          />
                          {p.offerFreeShipping}
                        </label>
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(offer.preselected)}
                            onChange={(ev) =>
                              setOffers((all) =>
                                all.map((o, j) => ({
                                  ...o,
                                  preselected:
                                    j === i ? ev.target.checked : false,
                                })),
                              )
                            }
                            className="size-4 accent-[var(--color-accent)]"
                            data-testid="offer-preselected"
                          />
                          {p.offerPreselected}
                        </label>
                        {offer.quantity >= 2 && offer.price > 0 && (
                          <span className="ms-auto text-xs text-muted">
                            {fmt(p.perPiece, {
                              price: formatPrice(
                                Math.round(offer.price / offer.quantity),
                                t.common.currency,
                              ),
                            })}
                            {saving > 0 && (
                              <span className="ms-2 font-semibold text-accent">
                                −{saving}%
                              </span>
                            )}
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
                      const quantity =
                        Math.max(1, ...offers.map((o) => o.quantity)) + 1;
                      setOffers((all) => [
                        ...all,
                        {
                          quantity,
                          price: priceNum ? priceNum * quantity : 0,
                          label: "",
                        },
                      ]);
                    }}
                  >
                    <Plus size={16} /> {p.addOffer}
                  </button>
                )}
                {err("offers") && <Alert>{err("offers")}</Alert>}
              </Card>

              <Card className="space-y-4" data-testid="similar">
                <div>
                  <h2 className="font-semibold">{p.similar}</h2>
                  <p className="mt-1 text-sm text-muted">{p.similarHint}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(["auto", "chosen"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={similarMode === m}
                      data-similar={m}
                      onClick={() => setSimilarMode(m)}
                      className={`rounded-xl border p-3 text-start text-sm font-semibold ${similarMode === m ? "border-accent bg-accent-soft text-accent-ink" : "border-line hover:bg-panel-2"}`}
                    >
                      {m === "auto" ? p.similarAuto : p.similarChosen}
                    </button>
                  ))}
                </div>
                {similarMode === "chosen" &&
                  (others.length === 0 ? (
                    <p className="text-sm text-muted">{p.noOther}</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <button
                          type="button"
                          className="font-semibold text-accent hover:underline"
                          onClick={() => setSimilar(others.map((o) => o.id))}
                        >
                          {p.selectAll}
                        </button>
                        <button
                          type="button"
                          className="font-semibold text-muted hover:underline"
                          onClick={() => setSimilar([])}
                        >
                          {p.clearAll}
                        </button>
                        <span className="ms-auto text-xs text-muted">
                          {fmt(p.similarCount, {
                            n: similar.length,
                            total: others.length,
                          })}
                        </span>
                      </div>
                      <ul className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-line p-1">
                        {others.map((o) => (
                          <li key={o.id}>
                            <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-panel-2">
                              <input
                                type="checkbox"
                                checked={similar.includes(o.id)}
                                onChange={(ev) =>
                                  setSimilar((all) =>
                                    ev.target.checked
                                      ? [...all, o.id]
                                      : all.filter((x) => x !== o.id),
                                  )
                                }
                                className="size-4 accent-[var(--color-accent)]"
                                data-similar-id={o.id}
                              />
                              {o.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={o.image}
                                  alt=""
                                  className="size-8 rounded-md object-cover"
                                />
                              ) : (
                                <span className="grid size-8 place-items-center rounded-md bg-panel-2 text-muted">
                                  <ImageOff size={14} />
                                </span>
                              )}
                              <span className="truncate text-sm">{o.name}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </Card>
            </>,
          )}
        </div>

        <PhonePreview
          t={p}
          currency={t.common.currency}
          store={store.name}
          name={name}
          short={short}
          price={priceNum}
          oldPrice={oldNum}
          image={images[0] ?? null}
        />
      </div>

      {/* The actions stay at the bottom of the screen */}
      <div
        className="sticky bottom-0 z-20 -mx-1 rounded-xl border border-line bg-panel/95 shadow-lift backdrop-blur"
        data-testid="product-actions"
      >
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <div className="me-auto min-w-0 space-y-1 text-sm">
            <FormMessage state={state} errors={e} success={t.common.saved} />
            {state.fieldErrors && (
              <p className="text-xs text-danger">{p.fixErrors}</p>
            )}
            {isNew && !state.fieldErrors && !state.error && <p className="text-xs font-medium text-warning">{p.notCreated}</p>}
          </div>
          {isNew && (
            <button
              type="button"
              onClick={clear}
              className={buttonClass("ghost")}
              data-testid="product-clear"
            >
              {p.clear}
            </button>
          )}
          {isNew && (
            <SubmitButton
              pending={pending}
              variant="secondary"
              name="intent"
              value="another"
              data-testid="create-another"
            >
              {p.createAnother}
            </SubmitButton>
          )}
          <SubmitButton
            pending={pending}
            pendingText={t.common.loading}
            data-testid="save-product"
          >
            {isNew ? p.create : t.common.save}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

// "Show when sold out": its own state, written into the hidden field the form sends
function ShowOutOfStock({
  initial,
  render,
}: {
  initial: boolean;
  render: (value: boolean, set: (v: boolean) => void) => ReactNode;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <input type="hidden" name="showOutOfStock" value={value ? "on" : ""} />
      {render(value, setValue)}
    </>
  );
}

// The product page as a customer sees it on a phone, updated while typing
function PhonePreview({
  t,
  currency,
  store,
  name,
  short,
  price,
  oldPrice,
  image,
}: {
  t: Dictionary["products"];
  currency: string;
  store: string;
  name: string;
  short: string;
  price: number | null;
  oldPrice: number | null;
  image: string | null;
}) {
  const f = t.previewForm;
  const shown = price && !Number.isNaN(price) ? price : 0;
  return (
    <aside
      className="hidden space-y-3 xl:sticky xl:top-20 xl:block"
      data-testid="product-preview"
    >
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
          <ScanEye size={15} /> {t.preview}
        </h2>
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-ink">{t.mobileView}</span>
      </div>
      <div className="mx-auto w-[300px] rounded-[2.2rem] border-[10px] border-fg/90 bg-white text-[#0f172a] shadow-xl">
        <div className="flex items-center justify-between px-5 pt-2 text-[10px] font-semibold">
          <span>9:41</span>
          <span className="h-4 w-16 rounded-full bg-fg/90" />
          <span>100%</span>
        </div>
        <div className="max-h-[540px] space-y-3 overflow-hidden rounded-b-[1.6rem] px-3 pt-2 pb-4">
          <p className="border-b border-slate-200 pb-2 text-center text-sm font-bold">
            {store}
          </p>
          <div className="grid aspect-square place-items-center overflow-hidden rounded-xl bg-slate-100">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="size-full object-cover" />
            ) : (
              <ImageOff size={28} className="text-slate-400" />
            )}
          </div>
          <div className="space-y-1">
            <p
              className="text-sm leading-snug font-bold"
              data-preview="name"
              dir="auto"
            >
              {name || t.name}
            </p>
            {short && (
              <p className="text-xs text-slate-500" dir="auto">
                {short}
              </p>
            )}
            <p className="flex items-baseline gap-2">
              <span
                className="text-base font-extrabold text-[#4f3bd6]"
                data-preview="price"
              >
                {formatPrice(shown, currency)}
              </span>
              {oldPrice && oldPrice > shown ? (
                <span className="text-xs text-slate-400 line-through">
                  {formatPrice(oldPrice, currency)}
                </span>
              ) : null}
            </p>
          </div>
          <div className="space-y-1.5 rounded-xl border border-slate-200 p-2.5 text-[11px]">
            {[f.name, f.phone].map((l) => (
              <div
                key={l}
                className="rounded-md border border-slate-200 px-2 py-1.5 text-slate-400"
              >
                {l}
              </div>
            ))}
            <div className="flex justify-between text-slate-500">
              <span>{f.quantity}</span>
              <span>1</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>{f.delivery}</span>
              <span>{f.free}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>{f.total}</span>
              <span>{formatPrice(shown, currency)}</span>
            </div>
            <div className="rounded-lg bg-[#4f3bd6] py-2 text-center font-bold text-white">
              {f.confirm} · {formatPrice(shown, currency)}
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-3 rounded-xl border border-info/20 bg-info/5 p-3 text-xs text-info">
        <Smartphone size={18} className="shrink-0" />
        <p>
          <span className="mb-0.5 block font-semibold">{t.proTip}</span>
          {t.previewHint}
        </p>
      </div>
    </aside>
  );
}
