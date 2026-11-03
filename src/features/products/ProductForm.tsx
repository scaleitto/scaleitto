"use client";

import { resolveWholesale } from "@/features/checkout/pricing";
import { customFieldTypes, type CustomField, type CustomFieldType } from "@/features/landing/types";
import Link from "next/link";
import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
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
  ListChecks,
  Plus,
  SlidersHorizontal,
  Star,
  Tag,
  Trash2,
  TriangleAlert,
  Truck,
  ShoppingCart,
  Check,
  ChevronUp,
  ChevronDown,
  GripVertical,
  X as XIcon,
} from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import {
  type ProductOption,
  type QuantityOffer,
} from "@/server/db/schema";
import type { ActionState } from "@/lib/action";
import { fmt } from "@/lib/format";
import {
  Alert,
  Card,
  Field,
  Input,
  Select,
  Textarea,
  buttonClass,
  inputClass, Button } from "@/ui";
import {
  FormMessage,
  SubmitButton,
  fieldError,
  useActionForm,
} from "@/ui/form";
import { ImageManager } from "@/ui/ImageManager";
import { offered } from "./variants";
import { VariantsEditor, cleanOptions, emptyVariant, variantRows, type VariantData } from "./VariantsEditor";
import { MAX_IMAGES, MAX_OFFERS } from "./constants";
import type { ProductStatus } from "./types";
import { AiDescriptionBox } from "./AiDescriptionBox";
import { ProductPreview } from "./ProductPreview";
import type { ProductPreviewData } from "./editor-props";
import { RichTextEditor } from "@/ui/RichTextEditor";
import type { AiLanguage as PageLanguage } from "@/features/ai/languages";

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
    compareAtPrice?: number | null;
    stock: number;
    active?: boolean;
  }[];
  maxPerOrder?: number | null;
  deliveryOption?: string | null;
  cardOnly?: boolean;
  carrierAccountId: string | null;
  similarIds: string[] | null;
  collectionIds: string[] | null;
  customFields: unknown[] | null;
  wholesale: unknown;
};

export type ProductFormText = Pick<
  Dictionary,
  "products" | "media" | "errors" | "common" | "assistant"
>;
type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

// Zimam's editor tabs, and which fields live in each (a tab with an error gets a dot and opens after saving)
const tabs = [
  "details",
  "description",
  "variants",
  "delivery",
  "offers",
  "wholesale",
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
  variants: ["stock", "lowStock", "maxPerOrder", "options", "variants"],
  delivery: ["carrierAccountId"],
  offers: ["offers", "similarIds"],
  wholesale: ["wholesale"],
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
  deliveryOptions,
  deliverySettingsHref,
  cardPayments,
  paymentsHref,
  others,
  preview,
  collections,
  collectionsHref,
  customFieldsOn,
  wholesaleOn,
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
  deliveryOptions: { id: string; name: string; type: "home" | "office" | "both" }[];
  deliverySettingsHref: string;
  cardPayments: boolean;
  paymentsHref: string;
  // The store's other products (similar products)
  others: { id: string; name: string; image: string | null }[];
  // What the live preview needs to draw the real product page
  preview: ProductPreviewData;
  // The store's collections (Apps → Collections) and where to manage them
  collections: { id: string; title: string; child: boolean }[];
  collectionsHref: string;
  // Apps → Custom fields is on: the product can ask its own questions at checkout
  customFieldsOn: boolean;
  // Apps → Wholesale is on: the product gets a Wholesale tab (tiers + minimum)
  wholesaleOn: boolean;
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
  const [variantData, setVariantData] = useState<Record<string, VariantData>>(() =>
    Object.fromEntries(values.variants.map((v) => [v.title, { sku: v.sku ?? "", price: v.price, compareAtPrice: v.compareAtPrice ?? null, stock: v.stock, active: v.active ?? true }])),
  );
  const [offers, setOffers] = useState<QuantityOffer[]>(values.offers);
  const [trackStock, setTrackStock] = useState(values.trackStock);
  const [cardOnly, setCardOnly] = useState(Boolean(values.cardOnly));
  const [price, setPrice] = useState(values.price?.toString() ?? "");
  const [oldPrice, setOldPrice] = useState(
    values.compareAtPrice?.toString() ?? "",
  );
  // Similar products: null = all the store's other products (Zimam's default, new products included)
  const [chosen, setChosen] = useState<string[] | null>(values.similarIds);
  const [inCollections, setInCollections] = useState<string[]>(values.collectionIds ?? []);
  const [questions, setQuestions] = useState<Question[]>(() => toQuestions(values.customFields));
  const [bulk, setBulk] = useState(() => {
    const w = resolveWholesale(values.wholesale);
    return { minQty: String(w?.minQty ?? 1), tiers: (w?.tiers ?? []).map((t) => ({ from: String(t.from), price: String(t.price) })) };
  });
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

  // What is saved and previewed: the cleaned options and their combinations
  const effectiveOptions = cleanOptions(options);
  const variants = variantRows(effectiveOptions, variantData);
  const setVariant = (title: string, patch: Partial<VariantData>) => setVariantData((all) => ({ ...all, [title]: { ...(all[title] ?? emptyVariant), ...patch } }));

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
          variants.map(({ title, sku, price, compareAtPrice, stock, active }) => ({ title, sku, price, compareAtPrice, stock, active })),
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
            {tabs.filter((k) => k !== "wholesale" || wholesaleOn).map((k) => (
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
                <div className="space-y-2" data-testid="product-collections">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Layers size={16} className="text-accent" /> {p.collections.title}
                  </p>
                  <p className="text-xs text-muted">{p.collections.hint}</p>
                  {collections.length ? (
                    <div className="flex flex-wrap gap-2">
                      {collections.map((col) => {
                        const on = inCollections.includes(col.id);
                        return (
                          <label key={col.id} className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line"}`}>
                            <input type="checkbox" checked={on} onChange={() => setInCollections((list) => (on ? list.filter((x) => x !== col.id) : [...list, col.id]))} className="size-3.5 accent-[var(--color-accent)]" data-collection={col.title} />
                            {col.child && <span className="text-muted">↳</span>}
                            {col.title}
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted">{p.collections.none}</p>
                  )}
                  <a href={collectionsHref} className="inline-block text-sm font-semibold text-accent hover:underline">
                    {p.collections.manage}
                  </a>
                  <input type="hidden" name="collectionIds" value={JSON.stringify(inCollections)} />
                </div>
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
                  <div className="space-y-2">
                    <label htmlFor="maxPerOrder" className="flex items-center gap-2 text-sm font-semibold">
                      <ShoppingCart size={16} className="text-accent" /> {p.maxPerOrder}
                    </label>
                    <Input id="maxPerOrder" name="maxPerOrder" inputMode="numeric" dir="ltr" defaultValue={values.maxPerOrder ?? ""} placeholder={p.maxPerOrderPlaceholder} />
                    <p className={`text-xs ${err("maxPerOrder") ? "text-danger" : "text-muted"}`}>{err("maxPerOrder") ?? p.maxPerOrderHint}</p>
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

              <div className={`space-y-4 rounded-xl border p-4 ${options.length ? "border-accent/30 bg-accent-soft/30" : "border-line"}`} data-testid="variants">
                {toggleRow(options.length > 0, (on) => setOptions(() => (on ? [{ name: p.variantEditor.defaultNames.color, values: [""], display: "color" }] : [])), <SlidersHorizontal size={18} />, p.hasVariants, p.variantsHint, "has-variants")}
              </div>
              {options.length > 0 && <VariantsEditor options={options} setOptions={setOptions} variantData={variantData} setVariant={setVariant} trackStock={trackStock} t={p.variantEditor} />}
              {err("options") && <Alert>{err("options")}</Alert>}
              </Card>
            </>,
          )}

          {panel(
            "delivery",
            <>
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
              <Field
                label={
                  <span className="flex items-center gap-2">
                    <Truck size={16} className="text-accent" /> {p.deliveryOption}
                  </span>
                }
                htmlFor="deliveryOption"
                hint={p.deliveryOptionHint}
              >
                {deliveryOptions.length ? (
                  <Select id="deliveryOption" name="deliveryOption" defaultValue={values.deliveryOption ?? ""} data-testid="delivery-option">
                    <option value="">{p.deliveryOptionAll}</option>
                    {deliveryOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name || p.deliveryTypes[o.type]}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <p className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-line p-3 text-sm text-muted">
                    {p.noDeliveryOption}
                    <Link href={deliverySettingsHref} className="font-semibold text-accent hover:underline">
                      {p.openDeliverySettings}
                    </Link>
                  </p>
                )}
              </Field>
              <div className="space-y-2 rounded-xl border border-line p-4">
                {toggleRow(cardOnly, setCardOnly, <CreditCard size={18} />, p.onlinePayment, p.onlinePaymentHint, "online-only")}
                {cardOnly && <input type="hidden" name="cardOnly" value="on" />}
                {cardOnly && !cardPayments && (
                  <p className="text-xs font-semibold text-warning" data-testid="online-only-warning">
                    {p.onlinePaymentMissing}{" "}
                    <Link href={paymentsHref} className="underline">
                      {p.openPayments}
                    </Link>
                  </p>
                )}
              </div>
            </Card>
            {customFieldsOn && <CustomFieldsCard value={questions} onChange={setQuestions} t={t} />}
            <input type="hidden" name="wholesale" value={JSON.stringify(wholesaleOn ? { minQty: Number(bulk.minQty) || 1, tiers: bulk.tiers.map((x) => ({ from: Number(x.from), price: Number(x.price) })) } : (values.wholesale ?? null))} />
            <input type="hidden" name="customFields" value={JSON.stringify(customFieldsOn ? questions.map((q) => ({ ...q, options: q.options.split(/[,،\n]/).map((o) => o.trim()).filter(Boolean) })) : (values.customFields ?? []))} />
            </>,
          )}

          {wholesaleOn &&
            panel(
              "wholesale",
              <Card className="space-y-5" data-testid="wholesale">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Layers size={19} className="text-accent" /> {p.wholesale.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted">{p.wholesale.hint}</p>
                </div>
                <Field label={p.wholesale.minQty} htmlFor="ws-min" hint={p.wholesale.minQtyHint}>
                  <Input id="ws-min" inputMode="numeric" dir="ltr" className="max-w-40" value={bulk.minQty} onChange={(ev) => setBulk((b) => ({ ...b, minQty: ev.target.value }))} />
                </Field>
                <div className="space-y-2">
                  <p className="text-sm font-semibold">{p.wholesale.tiers}</p>
                  {bulk.tiers.map((tier, i) => (
                    <div key={i} className="flex items-center gap-2" data-tier={i}>
                      <span className="text-sm text-muted">{p.wholesale.from}</span>
                      <Input inputMode="numeric" dir="ltr" className="w-24" value={tier.from} onChange={(ev) => setBulk((b) => ({ ...b, tiers: b.tiers.map((x, j) => (j === i ? { ...x, from: ev.target.value } : x)) }))} aria-label={p.wholesale.from} data-testid={`tier-from-${i}`} />
                      <span className="text-sm text-muted">{p.wholesale.pieces}</span>
                      <Input inputMode="numeric" dir="ltr" className="w-32" value={tier.price} onChange={(ev) => setBulk((b) => ({ ...b, tiers: b.tiers.map((x, j) => (j === i ? { ...x, price: ev.target.value } : x)) }))} aria-label={p.wholesale.price} data-testid={`tier-price-${i}`} />
                      <span className="text-sm text-muted">{p.wholesale.each}</span>
                      <button type="button" onClick={() => setBulk((b) => ({ ...b, tiers: b.tiers.filter((_, j) => j !== i) }))} className="grid size-10 place-items-center rounded-xl text-muted hover:text-danger" aria-label={t.common.delete}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  {bulk.tiers.length < 10 && (
                    <Button type="button" variant="secondary" onClick={() => setBulk((b) => ({ ...b, tiers: [...b.tiers, { from: "", price: "" }] }))} data-testid="tier-add">
                      <Plus size={15} /> {p.wholesale.addTier}
                    </Button>
                  )}
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
                  <div className="space-y-3" data-testid="offer-rows">
                    {/* Zimam's offer rows: default ★, text, quantity, total price, free delivery, on/off, delete */}
                    <div className="hidden grid-cols-[2rem_2rem_minmax(0,1fr)_4.5rem_7rem_7.5rem_2.5rem_2.5rem] gap-2 px-3 text-xs font-semibold text-muted sm:grid">
                      <span />
                      <span />
                      <span>{p.offerLabel}</span>
                      <span>{p.quantity}</span>
                      <span>{p.totalPrice}</span>
                      <span>{p.offerFreeShipping}</span>
                      <span className="col-span-2 text-center">{p.offerActions}</span>
                    </div>
                    {offers.map((offer, i) => {
                      const set = (patch: Partial<QuantityOffer>) => setOffers((all) => all.map((o, j) => (j === i ? { ...o, ...patch } : o)));
                      const move = (by: number) =>
                        setOffers((all) => {
                          const next = [...all];
                          const [o] = next.splice(i, 1);
                          next.splice(i + by, 0, o);
                          return next;
                        });
                      return (
                        <div key={i} className={`grid items-center gap-2 rounded-xl border border-line bg-panel p-3 sm:grid-cols-[2rem_2rem_minmax(0,1fr)_4.5rem_7rem_7.5rem_2.5rem_2.5rem] ${offer.off ? "opacity-60" : ""}`} data-offer={offer.quantity}>
                          <span className="flex flex-col items-center text-muted">
                            <button type="button" aria-label={p.moveUp} disabled={i === 0} onClick={() => move(-1)} className="disabled:opacity-30">
                              <ChevronUp size={14} />
                            </button>
                            <GripVertical size={14} aria-hidden />
                            <button type="button" aria-label={p.moveDown} disabled={i === offers.length - 1} onClick={() => move(1)} className="disabled:opacity-30">
                              <ChevronDown size={14} />
                            </button>
                          </span>
                          <button
                            type="button"
                            aria-pressed={Boolean(offer.preselected)}
                            title={p.offerPreselected}
                            aria-label={p.offerPreselected}
                            onClick={() => setOffers((all) => all.map((o, j) => ({ ...o, preselected: j === i ? !o.preselected : false })))}
                            className={offer.preselected ? "text-warning" : "text-muted hover:text-warning"}
                            data-testid="offer-preselected"
                          >
                            <Star size={18} fill={offer.preselected ? "currentColor" : "none"} />
                          </button>
                          <Input aria-label={p.offerLabel} placeholder={p.offerLabelPlaceholder} value={offer.label ?? ""} maxLength={60} onChange={(ev) => set({ label: ev.target.value })} />
                          <Input aria-label={p.quantity} inputMode="numeric" dir="ltr" className="text-center" value={offer.quantity || ""} onChange={(ev) => set({ quantity: Number(ev.target.value.replace(/\D/g, "") || 0) })} />
                          <Input aria-label={p.totalPrice} inputMode="numeric" dir="ltr" placeholder={t.common.currency} value={offer.price || ""} onChange={(ev) => set({ price: Number(ev.target.value.replace(/\D/g, "") || 0) })} />
                          <label className="relative flex cursor-pointer items-center gap-2 text-xs text-muted">
                            <input type="checkbox" role="switch" checked={Boolean(offer.freeShipping)} onChange={(ev) => set({ freeShipping: ev.target.checked })} className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0" aria-label={p.offerFreeShipping} data-testid="offer-free-shipping" />
                            <span aria-hidden className="relative h-6 w-11 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-accent after:absolute after:top-0.5 after:start-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:after:start-[1.375rem]" />
                            {offer.freeShipping ? p.yes : p.no}
                          </label>
                          <button
                            type="button"
                            aria-pressed={!offer.off}
                            aria-label={offer.off ? p.offerOff : p.offerOn}
                            title={offer.off ? p.offerOff : p.offerOn}
                            onClick={() => set({ off: !offer.off })}
                            className={`grid size-9 place-items-center rounded-lg ${offer.off ? "border border-line text-muted" : "bg-accent-soft text-accent-ink"}`}
                            data-testid="offer-active"
                          >
                            {offer.off ? <XIcon size={16} /> : <Check size={16} />}
                          </button>
                          <button type="button" aria-label={p.remove} className="grid size-9 place-items-center rounded-lg bg-danger/10 text-danger" onClick={() => setOffers((all) => all.filter((_, j) => j !== i))}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      );
                    })}
                    {offers.length < MAX_OFFERS && (
                      <button
                        type="button"
                        className="mx-auto flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
                        onClick={() => {
                          const quantity = offers.length ? Math.max(...offers.map((o) => o.quantity)) + 1 : 1;
                          setOffers((all) => [...all, { quantity, price: priceNum ? priceNum * quantity : 0, label: "" }]);
                        }}
                        data-testid="add-offer"
                      >
                        <span className="grid size-6 place-items-center rounded-full bg-accent-soft">
                          <Plus size={14} />
                        </span>
                        {offers.length ? p.addOtherOffer : p.addOffer}
                      </button>
                    )}
                  </div>
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
            variants: offered(effectiveOptions, variants.map((v) => ({ ...v, optionValues: v.values }))).map((v) => ({ id: v.title, values: v.values, price: v.price, stock: v.stock })),
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

// Apps → Custom fields: the product's own questions at checkout (label, kind, choices, required)
type Question = { id: string; label: string; type: CustomFieldType; options: string; required: boolean };
const toQuestions = (raw: unknown[] | null): Question[] =>
  (raw ?? []).map((x) => {
    const c = x as Partial<CustomField>;
    return { id: String(c.id ?? Math.random().toString(36).slice(2, 10)), label: String(c.label ?? ""), type: (c.type ?? "text") as CustomFieldType, options: (c.options ?? []).join("، "), required: c.required === true };
  });

function CustomFieldsCard({ value, onChange, t }: { value: Question[]; onChange: (q: Question[]) => void; t: ProductFormText }) {
  const c = t.products.customFields;
  const set = (id: string, patch: Partial<Question>) => onChange(value.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  return (
    <Card className="space-y-4" data-testid="custom-fields">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ListChecks size={19} className="text-accent" /> {c.title}
        </h2>
        <p className="mt-1 text-sm text-muted">{c.hint}</p>
      </div>
      {value.map((q, i) => (
        <div key={q.id} className="space-y-3 rounded-xl border border-line p-4" data-question={i}>
          <div className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
            <Input value={q.label} onChange={(ev) => set(q.id, { label: ev.target.value })} maxLength={60} placeholder={c.labelPlaceholder} aria-label={c.label} data-testid={`question-label-${i}`} />
            <Select value={q.type} onChange={(ev) => set(q.id, { type: ev.target.value as CustomFieldType })} aria-label={c.type} data-testid={`question-type-${i}`}>
              {customFieldTypes.map((k) => (
                <option key={k} value={k}>
                  {c.types[k]}
                </option>
              ))}
            </Select>
            <button type="button" onClick={() => onChange(value.filter((x) => x.id !== q.id))} className="grid size-11 place-items-center rounded-xl border border-line text-muted hover:text-danger" aria-label={t.common.delete}>
              <Trash2 size={16} />
            </button>
          </div>
          {(q.type === "select" || q.type === "radio") && <Input value={q.options} onChange={(ev) => set(q.id, { options: ev.target.value })} placeholder={c.optionsPlaceholder} aria-label={c.options} data-testid={`question-options-${i}`} />}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={q.required} onChange={(ev) => set(q.id, { required: ev.target.checked })} className="size-4 accent-[var(--color-accent)]" /> {c.required}
          </label>
        </div>
      ))}
      {value.length < 5 && (
        <Button type="button" variant="secondary" onClick={() => onChange([...value, { id: Math.random().toString(36).slice(2, 10), label: "", type: "text", options: "", required: false }])} data-testid="question-add">
          <Plus size={15} /> {c.add}
        </Button>
      )}
    </Card>
  );
}
