"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import {
  AlignLeft,
  ArrowRight,
  BadgeDollarSign,
  Barcode,
  Box,
  Building2,
  CreditCard,
  ExternalLink,
  EyeOff,
  FileText,
  Image as ImageIcon,
  ImageOff,
  Images,
  Layers,
  Link2,
  Lock,
  Package,
  Palette,
  Plus,
  SlidersHorizontal,
  Star,
  Tag,
  Trash2,
  TriangleAlert,
  Truck,
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
import { AiDescriptionBox } from "./AiDescriptionBox";
import { ProductPreview } from "./ProductPreview";
import type { ProductPreviewData } from "./editor-props";
import { RichTextEditor } from "@/ui/RichTextEditor";
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

const noopSubscribe = () => () => {};
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
  preview,
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
  // What the live preview needs to draw the real product page
  preview: ProductPreviewData;
  notice?: string;
}) {
  const p = t.products;
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(action);
  const err = (field: string) => fieldError(state, e, field);
  const formRef = useRef<HTMLFormElement>(null);
  // True once the form answers typing (tests wait for it before filling)
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  const [tab, setTab] = useState<Tab>("details");
  const [name, setName] = useState(values.name);
  const [short, setShort] = useState(values.shortDescription);
  const [description, setDescription] = useState(values.description);
  const [descImagesOn, setDescImagesOn] = useState(values.descriptionImages.length > 0);
  const [offersOn, setOffersOn] = useState(values.offers.length > 0);
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
  // Similar products: null = all the store's other products (Zimam's default, new products included)
  const [chosen, setChosen] = useState<string[] | null>(values.similarIds);
  const similar = chosen ?? others.map((o) => o.id);

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
    setChosen(null);
    setDescription("");
    setDescImagesOn(false);
    setOffersOn(false);
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
      className={`relative flex items-start justify-between gap-4 rounded-xl border border-line p-3 ${disabled ? "opacity-60" : "cursor-pointer"}`}
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
        className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        data-testid={testId}
      />
      <span
        aria-hidden
        className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-accent after:absolute after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition-all after:start-0.5 peer-checked:after:start-[1.125rem]"
      />
    </label>
  );
  // Zimam's setting rows: an icon tile, the title and its hint, the switch at the end
  const toggleRow = (checked: boolean, onChange: (v: boolean) => void, icon: ReactNode, label: string, hint: string, testId: string, disabled = false) => (
    <label className={`relative flex items-center gap-3 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-panel-2 text-fg-2">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        <span className="mt-0.5 block text-sm text-muted">{hint}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(ev) => onChange(ev.target.checked)} className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed" data-testid={testId} />
      <span aria-hidden className="relative h-6 w-11 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-accent after:absolute after:top-0.5 after:start-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:after:start-[1.375rem]" />
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
      data-ready={hydrated || undefined}
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
        value={JSON.stringify(descImagesOn ? descImages : [])}
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
      <input type="hidden" name="offers" value={JSON.stringify(offersOn ? offers : [])} />
      <input type="hidden" name="similar" value={chosen ? "chosen" : "auto"} />
      <input
        type="hidden"
        name="similarIds"
        value={JSON.stringify(chosen ?? [])}
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
                <Field label={`${p.name} *`} htmlFor="name" error={err("name")}>
                  <Input
                    id="name"
                    name="name"
                    value={name}
                    onChange={(ev) => setName(ev.target.value)}
                    maxLength={150}
                    placeholder={p.namePlaceholder}
                  />
                  <span className="mt-1 block text-end text-xs text-muted tabular-nums" dir="ltr">
                    {name.length}/150
                  </span>
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
                    label={
                      <span className="flex items-center gap-2">
                        <BadgeDollarSign size={16} className="text-accent" /> {`${p.price} (${t.common.currency}) *`}
                      </span>
                    }
                    htmlFor="price"
                    error={err("price")}
                  >
                    <Input
                      id="price"
                      name="price"
                      inputMode="numeric"
                      dir="ltr"
                      value={price}
                      placeholder="0"
                      onChange={(ev) => setPrice(ev.target.value)}
                    />
                  </Field>
                  <Field
                    label={
                      <span className="flex items-center gap-2">
                        <Tag size={16} className="text-accent" /> {p.compareAtPrice}
                      </span>
                    }
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
                      placeholder="0"
                      onChange={(ev) => setOldPrice(ev.target.value)}
                    />
                  </Field>
                  <Field
                    label={
                      <span className="flex items-center gap-2">
                        <Barcode size={16} className="text-accent" /> {p.sku}
                      </span>
                    }
                    htmlFor="sku"
                    error={err("sku")}
                  >
                    <Input
                      id="sku"
                      name="sku"
                      dir="ltr"
                      defaultValue={values.sku}
                      maxLength={80}
                      placeholder="PROD-001"
                      className="font-mono"
                    />
                  </Field>
                </div>
                <Field
                  label={
                    <span className="flex items-center gap-2">
                      <Link2 size={16} className="text-accent" /> {p.productUrl}
                    </span>
                  }
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
            <Card className="space-y-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <FileText size={19} className="text-accent" /> {p.descriptionMedia}
              </h2>
              <AiDescriptionBox
                lang={ai.lang}
                language={ai.language}
                name={name}
                price={toNumber(price)}
                images={images}
                onResult={setDescription}
                t={t}
              />
              <div className="space-y-2">
                <label htmlFor="shortDescription" className="flex items-center gap-2 text-sm font-semibold">
                  <AlignLeft size={16} className="text-accent" /> {p.shortDescription}
                  <span className="text-xs font-normal text-muted">{p.shortDescriptionMax}</span>
                </label>
                <Textarea
                  id="shortDescription"
                  name="shortDescription"
                  value={short}
                  rows={3}
                  maxLength={120}
                  placeholder={p.shortDescriptionPlaceholder}
                  onChange={(ev) => setShort(ev.target.value)}
                  dir="auto"
                />
                <p className={`text-xs ${wordCount(short) > 7 || err("shortDescription") ? "text-danger" : "text-muted"}`} data-testid="short-words">
                  {err("shortDescription") ?? fmt(p.wordsOf, { n: wordCount(short) })}
                </p>
              </div>
              <div className="space-y-2">
                <label htmlFor="description" className="flex items-center gap-2 text-sm font-semibold">
                  <FileText size={16} className="text-accent" /> {p.description}
                </label>
                <RichTextEditor id="description" name="description" value={description} onChange={setDescription} placeholder={p.descriptionPlaceholder} labels={p.editor} invalid={Boolean(err("description"))} />
                {err("description") && <p className="text-xs text-danger">{err("description")}</p>}
              </div>
              <div className="space-y-4 rounded-xl border border-line p-4">
                {toggleRow(descImagesOn, setDescImagesOn, <Images size={18} />, p.descriptionImages, p.descriptionImagesHint, "description-images")}
                {descImagesOn && <ImageManager t={t.media} value={descImages} onChange={setDescImages} max={MAX_IMAGES} />}
              </div>
            </Card>,
          )}

          {panel(
            "variants",
            <>
              <Card className="space-y-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Package size={19} className="text-accent" /> {p.variantsStock}
              </h2>
              <div className="space-y-4 rounded-xl border border-line p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="relative flex cursor-pointer items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <Package size={16} className="text-accent" /> {p.stock}
                      </span>
                      <input type="checkbox" role="switch" checked={trackStock} onChange={(ev) => setTrackStock(ev.target.checked)} className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed" data-testid="track-stock" aria-label={p.trackStock} />
                      <span aria-hidden className="relative h-6 w-11 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-accent after:absolute after:top-0.5 after:start-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:after:start-[1.375rem]" />
                    </label>
                    {trackStock && <input type="hidden" name="trackStock" value="on" />}
                    {variants.length > 0 ? (
                      <p className="rounded-lg bg-panel-2 px-3 py-2.5 text-xs text-muted">{p.stockPerVariant}</p>
                    ) : (
                      <Input id="stock" name="stock" inputMode="numeric" dir="ltr" defaultValue={values.stock} disabled={!trackStock} placeholder="100" aria-label={p.stock} />
                    )}
                    {err("stock") && <p className="text-xs text-danger">{err("stock")}</p>}
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="lowStock" className="flex items-center gap-2 text-sm font-semibold">
                      <TriangleAlert size={16} className="text-warning" /> {p.lowStock}
                    </label>
                    <Input id="lowStock" name="lowStock" inputMode="numeric" dir="ltr" defaultValue={values.lowStock ?? ""} placeholder="0" disabled={!trackStock} />
                    <p className="text-xs text-muted">{err("lowStock") ?? p.lowStockHint}</p>
                  </div>
                </div>
                <ShowOutOfStock
                  initial={values.showOutOfStock}
                  render={(v, set) => (
                    <label className="relative flex cursor-pointer items-center justify-between gap-3 border-t border-line pt-4">
                      <span>
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          <EyeOff size={16} className="text-accent" /> {p.showOutOfStock}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted">{p.showOutOfStockHint}</span>
                      </span>
                      <input type="checkbox" role="switch" checked={v} onChange={(ev) => set(ev.target.checked)} className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed" data-testid="show-out-of-stock" />
                      <span aria-hidden className="relative h-6 w-11 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-accent after:absolute after:top-0.5 after:start-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:after:start-[1.375rem]" />
                    </label>
                  )}
                />
              </div>

              <div className="space-y-4 rounded-xl border border-line p-4" data-testid="variants">
                {toggleRow(
                  options.length > 0,
                  (on) => {
                    if (on) addOption({ name: "", values: [] });
                    else {
                      setOptions([]);
                      setPendingValues([]);
                    }
                  },
                  <SlidersHorizontal size={18} />,
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
              </div>
              </Card>
            </>,
          )}

          {panel(
            "delivery",
            <Card className="space-y-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Truck size={19} className="text-accent" /> {p.deliverySection}
              </h2>
              <Field
                label={
                  <span className="flex items-center gap-2">
                    <Building2 size={16} className="text-accent" /> {p.carrier}
                  </span>
                }
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
              <div className="rounded-xl border border-line p-4">
                {toggleRow(false, () => undefined, <CreditCard size={18} />, p.onlinePayment, p.onlinePaymentHint, "online-only", true)}
              </div>
            </Card>,
          )}

          {panel(
            "offers",
            <Card className="space-y-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Star size={19} className="text-accent" /> {p.offersTitle}
              </h2>
              <div className="space-y-4 rounded-xl border border-line p-4" data-testid="offers">
                {toggleRow(offersOn, setOffersOn, <Star size={18} />, p.upsell, p.upsellHint, "upsell-offers")}
                {offersOn && (
                <>
                <p className="text-sm text-muted">{p.offersHint}</p>
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
                </>
                )}
                {err("offers") && <Alert>{err("offers")}</Alert>}
              </div>

              <div className="space-y-4 rounded-xl border border-line p-4" data-testid="similar">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-panel-2 text-fg-2">
                    <Layers size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{p.similar}</span>
                    <span className="mt-0.5 block text-sm text-muted">{p.similarHint}</span>
                  </span>
                  {others.length > 0 && (
                    <span className="flex gap-2">
                      <button type="button" className={buttonClass("secondary", "px-3 py-1.5 text-xs")} onClick={() => setChosen(null)} data-testid="similar-all">
                        {p.selectAll}
                      </button>
                      <button type="button" className={buttonClass("secondary", "px-3 py-1.5 text-xs")} onClick={() => setChosen([])} data-testid="similar-none">
                        {p.clearAll}
                      </button>
                    </span>
                  )}
                </div>
                {others.length === 0 ? (
                  <p className="text-sm text-muted">{p.noOther}</p>
                ) : (
                  <>
                    <p className="text-xs text-muted" data-testid="similar-count">
                      {fmt(p.similarCount, { n: similar.length, total: others.length })}
                    </p>
                    <ul className="max-h-80 space-y-2 overflow-y-auto">
                      {others.map((o) => {
                        const on = similar.includes(o.id);
                        return (
                          <li key={o.id}>
                            <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${on ? "border-accent/40 bg-accent-soft/60" : "border-line hover:bg-panel-2"}`}>
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={(ev) => {
                                  const next = ev.target.checked ? [...similar, o.id] : similar.filter((x) => x !== o.id);
                                  // Everything ticked = all products, new ones included
                                  setChosen(next.length === others.length ? null : next);
                                }}
                                className="size-4 accent-[var(--color-accent)]"
                                data-similar-id={o.id}
                              />
                              {o.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={o.image} alt="" className="size-9 rounded-md object-cover" />
                              ) : (
                                <span className="grid size-9 place-items-center rounded-md bg-panel-2 text-muted">
                                  <ImageOff size={14} />
                                </span>
                              )}
                              <span className="truncate text-sm font-medium">{o.name}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            </Card>,
          )}
        </div>

        <ProductPreview
          data={preview}
          storeName={store.name}
          labels={{ title: p.preview, mobile: p.mobileView, tip: p.previewHint, tipTitle: p.proTip, namePlaceholder: p.previewName }}
          product={{
            name,
            short,
            price: priceNum && !Number.isNaN(priceNum) ? priceNum : 0,
            compareAtPrice: oldNum && !Number.isNaN(oldNum) ? oldNum : null,
            images,
            description,
            descriptionImages: descImagesOn ? descImages : [],
            trackStock: false,
            stock: 0,
            options: effectiveOptions,
            offers: offersOn ? offers : [],
            variants: variants.map((v) => ({ id: v.title, values: v.values, price: v.price, stock: v.stock })),
          }}
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
