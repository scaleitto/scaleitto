"use client";

import { TurnstileBox, type StoreCaptcha } from "./Turnstile";
import { addToCart } from "./cart";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BadgeCheck, Check, ShoppingCart, Building2, ChevronLeft, LoaderCircle, Truck, Zap, MapPin, MessageCircle, Minus, NotebookPen, Phone, Plus, ShoppingBag, Signpost, User, X } from "lucide-react";
import type { ProductOption, QuantityOffer } from "@/server/db/schema";
import { dimensionOptions, displayOf, valueOn } from "@/features/products/variants";
import type { OnlineMethod } from "@/features/payments/methods";
import type { StoreText } from "@/i18n/store";
import type { ActionState } from "@/lib/action";
import { fmt, formatPrice } from "@/lib/format";
import { intlPhone, isValidDzPhone, normalizePhone } from "@/lib/phone";
import { useActionForm } from "@/ui/form";
import { defaultQuantity, maxQuantityFor, type Wholesale, lineShipping, linePrice, shippingPrice, type RateMap } from "@/features/checkout/pricing";
import { useCheckoutStarted } from "@/features/pixels/PixelScope";
import { defaultForm, type CustomField, type FormBlock, type FormSettings, type TextField } from "@/features/landing/types";
import { CommuneSelect } from "@/features/checkout/CommuneSelect";

type Variant = { id: string; values: Record<string, string>; price: number | null; stock: number };
type LeadInput = { name?: string; phone?: string; wilaya?: number | null; variantId?: string; quantity?: number };

const field = "w-full rounded-[var(--s-radius-btn)] border border-s-field-edge bg-s-field px-3.5 py-3 text-base outline-none transition focus:border-brand focus:bg-s-surface focus:ring-2 focus:ring-brand/20 aria-[invalid=true]:border-red-500";
const selectField = `${field} select-chevron cursor-pointer appearance-none pe-10`;
const label = "mb-1.5 block text-sm font-semibold text-s-muted";
const icons: Record<TextField, ReactNode> = {
  name: <User size={17} />,
  phone: <Phone size={17} />,
  wilaya: <Signpost size={17} />,
  commune: <Building2 size={17} />,
  address: <MapPin size={17} />,
  note: <NotebookPen size={17} />,
};

export function CheckoutForm({
  t,
  currency,
  product,
  variants,
  rates,
  wilayas,
  action,
  saveLead,
  cart = null,
  payMethods = [],
  captcha = null,
  settings = defaultForm,
  embedded = false,
  whatsapp,
}: {
  t: StoreText;
  currency: string;
  product: { price: number; trackStock: boolean; stock: number; options: ProductOption[]; offers: QuantityOffer[]; wholesale?: Wholesale | null; maxPerOrder?: number | null; cardOnly?: boolean };
  variants: Variant[];
  rates: RateMap;
  wilayas: { code: number; name: string }[];
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  saveLead: (input: LeadInput) => Promise<void>;
  // The order form's settings (the store's form on product pages, the page's own on landing pages)
  settings?: FormSettings;
  // Inside the landing builder's preview: no sticky button, no popup
  embedded?: boolean;
  // "Order on WhatsApp": the store's number and the product's name for the message
  whatsapp?: { phone: string; product: string };
  // Apps → Shopping cart: "Add to cart" beside the order button
  cart?: { shopId: string; productId: string; href: string } | null;
  // Apps → Online payments: the buyer may pay by card
  payMethods?: OnlineMethod[];
  // Apps → Fake OrderGuard → Checkout captcha
  captcha?: StoreCaptcha;
}) {
  const { state, pending, onSubmit } = useActionForm(action);
  const errors = t.errors as Record<string, string>;
  const err = (name: string) => {
    const local = name === "name" || name === "phone" ? stepErrors[name] : undefined;
    if (local) return local;
    const key = state.fieldErrors?.[name];
    return key ? (errors[key] ?? errors.invalid) : undefined;
  };

  const [selected, setSelected] = useState<Record<string, string>>(() =>
    // Preselect the first in-stock combination so the price is right from the start.
    variants.length ? (variants.find((v) => !product.trackStock || v.stock > 0) ?? variants[0]).values : {},
  );
  // The merchant's preselected offer opens chosen (when offers are shown)
  const minQuantity = product.wholesale?.minQty ?? 1;
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(() => Math.max(minQuantity, settings.showOffers ? defaultQuantity(product.offers) : 1));
  const [wilaya, setWilaya] = useState<number | null>(null);
  const allowedTypes = settings.delivery === "both" ? (["home", "office"] as const) : ([settings.delivery] as const);
  const [deliveryType, setDeliveryType] = useState<"home" | "office">(allowedTypes.includes(settings.preferDelivery as never) ? settings.preferDelivery : allowedTypes[0]);
  const formRef = useRef<HTMLFormElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const checkoutStarted = useCheckoutStarted();
  const lastLead = useRef("");
  // Fake-order protection: seconds from the first touch of the form to sending it (robots without a browser send nothing)
  const startedAt = useRef<number | null>(null);
  const fillRef = useRef<HTMLInputElement>(null);
  const [formVisible, setFormVisible] = useState(true);
  // Popup / drawer forms open from an order button (and from every link to #order-form on the page)
  const overlay = embedded ? null : settings.appearance === "direct" ? null : settings.appearance;
  const [open, setOpen] = useState(false);
  // Two-step form: name and phone first (step 1 ends at the later of the two), the rest second
  const stepper = settings.stepper;
  const [step, setStep] = useState<1 | 2>(1);
  const split = Math.max(settings.order.indexOf("name"), settings.order.indexOf("phone"));
  const [stepErrors, setStepErrors] = useState<{ name?: string; phone?: string }>({});
  // The server refused the name or phone: show the first step again (derived from the new answer, while rendering)
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    if (state.fieldErrors?.name || state.fieldErrors?.phone) setStep(1);
  }

  // The mobile sticky button is shown only while the form (or its order button) is off screen.
  useEffect(() => {
    const target = overlay ? anchorRef.current : formRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setFormVisible(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [overlay]);

  useEffect(() => {
    if (!overlay) return;
    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest?.('a[href="#order-form"]');
      if (!link) return;
      e.preventDefault();
      setOpen(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [overlay]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  // The options that make the combinations; optional ones are a free choice sent with the order (`choices`)
  const dims = dimensionOptions(product.options);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const variant = variants.find((v) => dims.every((o) => v.values[o.name] === selected[o.name])) ?? null;
  const available = !product.trackStock ? Infinity : variants.length ? (variant?.stock ?? 0) : product.stock;
  // Online payment only, and the store takes no card: it cannot be ordered
  const soldOut = available <= 0 || (variants.length > 0 && !variant) || (Boolean(product.cardOnly) && payMethods.length === 0);
  const line = linePrice(variant?.price ?? product.price, quantity, product.offers, product.wholesale ?? null);
  const shipping = wilaya ? lineShipping(shippingPrice(rates, wilaya, deliveryType), line.offer) : undefined;
  const total = line.total + (shipping ?? 0);
  const hasRates = Object.keys(rates).length > 0;

  // A value is unavailable when every variant having it (with the other choices) is sold out.
  // (only offered combinations reach the form: switched-off ones are missing, so their values are unavailable too)
  const valueAvailable = (option: string, value: string) =>
    variants.some((v) => v.values[option] === value && (!product.trackStock || v.stock > 0) && dims.every((o) => o.name === option || v.values[o.name] === selected[o.name]));

  // The offer cards (Zimam: "buy 1" is an offer row of its own when the merchant adds one)
  const quantityChoices = settings.showOffers && product.offers.length ? [...new Set([1, ...product.offers.map((o) => o.quantity)])].sort((a, b) => a - b) : [];
  const maxQuantity = Math.min(maxQuantityFor(product.wholesale ?? null), available, product.maxPerOrder || Infinity);

  // Abandoned cart: remember the visitor as soon as a valid phone is typed.
  const rememberLead = () => {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const phone = normalizePhone(String(data.get("phone") ?? ""));
    if (!isValidDzPhone(phone)) return;
    const input = { name: String(data.get("name") ?? ""), phone, wilaya, variantId: variant?.id ?? "", quantity };
    const key = JSON.stringify(input);
    if (key === lastLead.current) return;
    lastLead.current = key;
    saveLead(input).catch(() => {});
  };

  // The merchant's own wording, else the default
  const text = (key: TextField, fallback: string) => settings.labels[key]?.label || fallback;
  const hint = (key: TextField, fallback?: string) => settings.labels[key]?.placeholder || fallback;
  const withIcon = (key: TextField, input: ReactNode) =>
    settings.icons ? (
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 start-0 z-[1] flex w-11 items-center justify-center text-s-muted">{icons[key]}</span>
        {input}
      </div>
    ) : (
      input
    );
  const pad = settings.icons ? " ps-11" : "";
  const error = (name: string) => err(name) && <p className="mt-1 text-sm text-red-600">{err(name)}</p>;
  const wide = settings.layout === "compact" ? "@min-[40rem]:col-span-2" : "";

  const nextStep = () => {
    const data = new FormData(formRef.current ?? undefined);
    const problems = {
      name: String(data.get("name") ?? "").trim().length < 2 ? errors.name : undefined,
      phone: isValidDzPhone(normalizePhone(String(data.get("phone") ?? ""))) ? undefined : errors.phone,
    };
    setStepErrors(problems);
    if (problems.name || problems.phone) return;
    rememberLead();
    setStep(2);
  };

  const orderOnWhatsapp = () => {
    const form = formRef.current;
    if (!form || !whatsapp?.phone) return;
    rememberLead();
    const data = new FormData(form);
    const choice = product.options.map((o) => selected[o.name]).filter(Boolean).join(" / ");
    const lines = [
      t.form.whatsappIntro,
      `${whatsapp.product}${choice ? ` (${choice})` : ""} × ${quantity}`,
      `${t.form.name}: ${data.get("name") ?? ""}`,
      `${t.form.phone}: ${data.get("phone") ?? ""}`,
      `${t.form.wilaya}: ${wilayas.find((w) => w.code === wilaya)?.name ?? ""}`,
      `${t.form.commune}: ${data.get("commune") ?? ""}`,
      data.get("address") ? `${t.form.addressRequired}: ${data.get("address")}` : "",
      `${t.form.deliveryType}: ${deliveryType === "home" ? settings.homeLabel || t.form.home : settings.officeLabel || t.form.office}`,
      `${t.summary.total}: ${formatPrice(total, currency)}`,
    ].filter(Boolean);
    window.open(`https://wa.me/${intlPhone(whatsapp.phone)}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noopener");
  };

  const custom = new Map(settings.custom.map((c) => [`custom:${c.id}`, c]));
  const blocks = new Map((settings.blocks ?? []).map((b) => [`el:${b.id}`, b]));
  const customInput = (c: CustomField) => {
    const common = { id: `custom_${c.id}`, name: `custom_${c.id}`, "aria-invalid": Boolean(err(`custom_${c.id}`)) };
    switch (c.type) {
      case "select":
        return (
          <select {...common} className={selectField} defaultValue="">
            <option value="">{t.form.choose}</option>
            {c.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        );
      case "radio":
        return (
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {c.options.map((o) => (
              <label key={o} className="flex cursor-pointer items-center gap-2 rounded-[var(--s-radius-btn)] border-2 border-s-field-edge px-3.5 py-2 text-sm font-semibold has-[:checked]:border-brand has-[:checked]:bg-brand/5">
                <input type="radio" name={common.name} value={o} className="size-4 accent-[var(--brand)]" />
                {o}
              </label>
            ))}
          </div>
        );
      case "textarea":
        return <textarea {...common} rows={3} maxLength={500} className={field} />;
      case "number":
        return <input {...common} inputMode="decimal" dir="ltr" maxLength={20} className={`${field} text-start`} />;
      case "email":
        return <input {...common} type="email" dir="ltr" maxLength={200} className={`${field} text-start`} />;
      case "date":
        return <input {...common} type="date" dir="ltr" className={field} />;
      default:
        return <input {...common} maxLength={200} className={field} />;
    }
  };
  // The merchant's blocks between the fields
  const formBlock = (b: FormBlock) => {
    switch (b.kind) {
      case "heading":
        return <h3 className="text-lg font-extrabold">{b.text}</h3>;
      case "text":
        return <p className="text-sm leading-relaxed whitespace-pre-line text-s-muted">{b.text}</p>;
      case "notice":
        return <p className="rounded-[var(--s-radius-btn)] border border-brand/30 bg-brand/5 px-4 py-3 text-sm font-semibold whitespace-pre-line">{b.text}</p>;
      case "divider":
        return <hr className="border-s-edge" />;
      case "image":
        // eslint-disable-next-line @next/next/no-img-element
        return b.image ? <img src={b.image} alt={b.text} className="w-full rounded-[var(--s-radius-btn)]" loading="lazy" /> : null;
      case "badges":
        return (
          <ul className="grid grid-cols-3 gap-2 text-center text-xs font-semibold">
            {[
              [<BadgeCheck key="i" size={18} />, t.cod],
              [<Truck key="i" size={18} />, t.fastDelivery],
              [<Zap key="i" size={18} />, t.easyOrder],
            ].map(([icon, label], i) => (
              <li key={i} className="flex flex-col items-center gap-1 rounded-[var(--s-radius-btn)] bg-s-bg p-2.5">
                <span className="text-brand-ink">{icon}</span>
                {label}
              </li>
            ))}
          </ul>
        );
    }
  };
  const element = (key: string): ReactNode => {
    switch (key) {
      case "variants":
        // Zimam's displays: text, color circle, text + color, image. Hidden options and switched-off values are not shown.
        return product.options
          .filter((o) => !o.hidden && o.name && o.values.some((v) => valueOn(o, v)))
          .map((option) => {
            const d = displayOf(option);
            const chosen = option.optional ? picked[option.name] : selected[option.name];
            const choose = (value: string) =>
              option.optional ? setPicked((s) => ({ ...s, [option.name]: s[option.name] === value ? "" : value })) : setSelected((s) => ({ ...s, [option.name]: value }));
            return (
              <fieldset key={option.name} className={wide} data-store-option={option.name} data-display={d}>
                <legend className={label}>
                  {fmt(t.choose, { option: option.name })}
                  {option.optional && <span className="font-normal text-s-muted"> ({t.form.optional})</span>}
                  {d !== "text" && chosen && <span className="font-bold text-s-text">: {chosen}</span>}
                </legend>
                {/* Zimam: a text option with more than 6 values, or a value longer than 18 characters, is a dropdown — unless the
                    store shows options as buttons (Store settings → Product page) */}
                {d === "text" && !settings.optionButtons && (option.values.filter((v) => valueOn(option, v)).length > 6 || option.values.some((v) => valueOn(option, v) && v.length > 18)) ? (
                  <select className={selectField} value={chosen ?? ""} onChange={(e) => e.target.value ? choose(e.target.value) : option.optional && setPicked((st) => ({ ...st, [option.name]: "" }))} aria-label={option.name} data-option-select={option.name}>
                    {(option.optional || !chosen) && <option value="">{fmt(t.choose, { option: option.name })}</option>}
                    {option.values
                      .filter((value) => valueOn(option, value))
                      .map((value) => (
                        <option key={value} value={value} disabled={!(option.optional || valueAvailable(option.name, value))}>
                          {value}
                        </option>
                      ))}
                  </select>
                ) : (
                <div className="flex flex-wrap gap-2">
                  {option.values
                    .filter((value) => valueOn(option, value))
                    .map((value) => {
                      const active = chosen === value;
                      const ok = option.optional || valueAvailable(option.name, value);
                      const color = option.colors?.[value];
                      const common = { type: "button" as const, "aria-pressed": active, disabled: !ok, onClick: () => choose(value) };
                      if (d === "color" && color)
                        return (
                          <button
                            key={value}
                            {...common}
                            title={value}
                            aria-label={value}
                            className={`relative size-10 rounded-full border border-s-field-edge transition ${active ? "ring-2 ring-brand ring-offset-2 ring-offset-s-surface" : "hover:scale-105"} disabled:cursor-not-allowed disabled:opacity-30 disabled:after:absolute disabled:after:inset-x-1 disabled:after:top-1/2 disabled:after:h-0.5 disabled:after:-rotate-45 disabled:after:bg-s-text`}
                            style={{ background: color }}
                          />
                        );
                      if (d === "image")
                        return (
                          <button
                            key={value}
                            {...common}
                            title={value}
                            className={`flex w-20 flex-col items-center gap-1 rounded-[var(--s-radius)] border-2 p-1 text-xs font-semibold transition ${active ? "border-brand" : "border-s-field-edge hover:border-brand"} disabled:cursor-not-allowed disabled:opacity-40`}
                          >
                            {option.images?.[value] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={option.images[value]} alt="" className="aspect-square w-full rounded-[calc(var(--s-radius)-4px)] object-cover" />
                            ) : (
                              <span className="grid aspect-square w-full place-items-center rounded bg-s-bg text-s-muted">{value.slice(0, 2)}</span>
                            )}
                            <span className="w-full truncate">{value}</span>
                          </button>
                        );
                      return (
                        <button
                          key={value}
                          {...common}
                          className={`inline-flex min-w-12 items-center justify-center gap-2 rounded-[var(--s-radius-btn)] border-2 px-4 py-2 text-sm font-bold transition ${
                            active ? "border-brand bg-brand text-brand-fg" : "border-s-field-edge bg-s-surface hover:border-brand"
                          } disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through`}
                        >
                          {d === "text_color" && color && <span className="size-4 rounded-full border border-black/10" style={{ background: color }} />}
                          {value}
                        </button>
                      );
                    })}
                </div>
                )}
              </fieldset>
            );
          });
      case "quantity":
        if (quantityChoices.length)
          return (
            <fieldset className={wide}>
              <legend className={label}>{t.form.quantity}</legend>
              <div className="grid gap-2">
                {quantityChoices.map((q) => {
                  const price = linePrice(line.unitPrice, q, product.offers);
                  const full = line.unitPrice * q;
                  const saving = full - price.total;
                  const offer = price.offer;
                  const active = quantity === q;
                  return (
                    <label
                      key={q}
                      data-offer-card={q}
                      className={`relative flex cursor-pointer flex-col gap-1.5 rounded-[var(--s-radius-btn)] border-2 px-4 py-3 transition ${active ? "border-brand bg-brand/5 shadow-sm" : "border-s-field-edge"} ${offer?.badge ? "mt-2" : ""} ${q > maxQuantity ? "pointer-events-none opacity-40" : ""}`}
                    >
                      {/* The merchant's badge, as a ribbon on the card's edge */}
                      {offer?.badge && (
                        <span className="absolute -top-2.5 start-3 rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-bold text-brand-fg shadow-sm" data-testid="offer-badge">
                          {t.form.offerBadges[offer.badge]}
                        </span>
                      )}
                      <span className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-3">
                          <input type="radio" name="quantityChoice" checked={active} disabled={q > maxQuantity} onChange={() => setQuantity(q)} className="size-4 shrink-0 accent-[var(--brand)]" />
                          <span className="min-w-0">
                            <span className="block font-bold">{offer?.label || fmt(t.form.pieces, { n: q })}</span>
                            {offer?.label && <span className="block text-xs text-s-muted">{fmt(t.form.pieces, { n: q })}</span>}
                          </span>
                        </span>
                        <span className="shrink-0 text-end">
                          <span className="block font-extrabold">{formatPrice(price.total, currency)}</span>
                          {saving > 0 && (
                            <span className="block text-xs text-s-muted">
                              <s>{formatPrice(full, currency)}</s> <span className="font-bold text-green-700">{fmt(t.form.offerOff, { n: Math.round((saving / full) * 100) })}</span>
                            </span>
                          )}
                        </span>
                      </span>
                      {/* What comes with it: saving, per-piece price, free delivery, gift */}
                      {(saving > 0 || offer?.freeShipping || offer?.gift) && (
                        <span className="flex flex-wrap gap-1.5 ps-7 text-[11px] font-semibold">
                          {saving > 0 && <span className="rounded-full bg-green-50 px-2 py-0.5 text-green-800">{fmt(t.form.save, { amount: formatPrice(saving, currency) })}</span>}
                          {q > 1 && <span className="rounded-full bg-s-surface px-2 py-0.5 text-s-muted">{fmt(t.form.offerPerPiece, { price: formatPrice(Math.round(price.total / q), currency) })}</span>}
                          {offer?.freeShipping && (
                            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-800" data-testid="offer-free-shipping">
                              {t.form.offerFreeShipping}
                            </span>
                          )}
                          {offer?.gift && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800" data-testid="offer-gift">
                              🎁 {fmt(t.form.offerGift, { gift: offer.gift })}
                            </span>
                          )}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        if (!settings.showQuantity && !product.wholesale) return null;
        return (
          <div className={wide}>
            <span className={label}>{t.form.quantity}</span>
            <div className="inline-flex items-center rounded-[var(--s-radius-btn)] border border-s-field-edge">
              <button type="button" aria-label="-" className="p-3 disabled:opacity-30" disabled={quantity <= minQuantity} onClick={() => setQuantity((q) => Math.max(minQuantity, q - 1))}>
                <Minus size={16} />
              </button>
              {product.wholesale ? (
                <input
                  type="number"
                  inputMode="numeric"
                  min={minQuantity}
                  max={maxQuantity}
                  value={quantity}
                  onChange={(ev) => setQuantity(Math.max(1, Math.min(maxQuantity, Math.trunc(Number(ev.target.value) || 1))))}
                  onBlur={() => setQuantity((q) => Math.max(minQuantity, q))}
                  className="w-16 bg-transparent text-center font-bold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  aria-label={t.form.quantity}
                  data-testid="quantity"
                />
              ) : (
                <span className="min-w-10 text-center font-bold" data-testid="quantity">
                  {quantity}
                </span>
              )}
              <button type="button" aria-label="+" className="p-3 disabled:opacity-30" disabled={quantity >= maxQuantity} onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}>
                <Plus size={16} />
              </button>
            </div>
            {product.wholesale && (
              <ul className="mt-2 space-y-1 text-sm" data-testid="wholesale-tiers">
                {minQuantity > 1 && <li className="font-semibold text-s-muted">{fmt(t.form.minQuantity, { n: minQuantity })}</li>}
                {product.wholesale.tiers.map((tier) => (
                  <li key={tier.from} className={line.offer === null && line.unitPrice === tier.price && quantity >= tier.from ? "font-bold text-brand-ink" : "text-s-muted"}>
                    {fmt(t.form.tier, { n: tier.from, price: formatPrice(tier.price, currency) })}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      case "name":
        if (settings.name === "hidden") return null;
        return (
          <div>
            <label htmlFor="name" className={label}>
              {text("name", t.form.name)}
              {settings.name === "optional" && <span className="font-normal text-s-muted"> ({t.form.optional})</span>}
            </label>
            {withIcon("name", <input id="name" aria-invalid={Boolean(err("name"))} name="name" autoComplete="name" placeholder={hint("name", t.form.namePlaceholder)} className={field + pad} onBlur={rememberLead} />)}
            {error("name")}
          </div>
        );
      case "phone":
        return (
          <div>
            <label htmlFor="phone" className={label}>
              {text("phone", t.form.phone)}
            </label>
            {withIcon(
              "phone",
              <input id="phone" aria-invalid={Boolean(err("phone"))} name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder={hint("phone", "0555 12 34 56")} className={`${field} text-start${pad}`} onBlur={rememberLead} />,
            )}
            {error("phone")}
          </div>
        );
      case "wilaya":
        return (
          <div>
            <label htmlFor="wilaya" className={label}>
              {text("wilaya", t.form.wilaya)}
            </label>
            {withIcon(
              "wilaya",
              <select
                id="wilaya"
                aria-invalid={Boolean(err("wilaya"))}
                name="wilaya"
                className={selectField + pad}
                value={wilaya ?? ""}
                onChange={(e) => {
                  const code = Number(e.target.value) || null;
                  setWilaya(code);
                  // Switch to the other delivery type when the chosen one is not delivered there.
                  if (code && shippingPrice(rates, code, deliveryType) === null) {
                    const other = deliveryType === "home" ? "office" : "home";
                    if (allowedTypes.includes(other as never) && shippingPrice(rates, code, other) !== null) setDeliveryType(other);
                  }
                }}
                onBlur={rememberLead}
              >
                <option value="">{hint("wilaya", t.form.chooseWilaya)}</option>
                {wilayas.map((w) => (
                  <option key={w.code} value={w.code}>
                    {w.name}
                  </option>
                ))}
              </select>,
            )}
            {error("wilaya")}
          </div>
        );
      case "commune":
        if (settings.commune === "hidden") return null;
        return (
          <div>
            <label htmlFor="commune" className={label}>
              {text("commune", t.form.commune)}
              {settings.commune === "optional" && <span className="font-normal text-s-muted"> ({t.form.optional})</span>}
            </label>
            {withIcon(
              "commune",
              <CommuneSelect
                key={wilaya ?? 0}
                wilaya={wilaya}
                arabic={t.arabicNames}
                invalid={Boolean(err("commune"))}
                className={field + pad}
                placeholder={t.form.communePlaceholder}
                choose={hint("commune", t.form.chooseCommune)!}
                chooseWilayaFirst={t.summary.chooseWilayaFirst}
              />,
            )}
            {error("commune")}
          </div>
        );
      case "delivery":
        // Store settings → Checkout: delivery type hidden = always the store's one, no choice shown
        if (allowedTypes.length === 1) return <input type="hidden" name="deliveryType" value={allowedTypes[0]} />;
        return (
          <fieldset className={wide}>
            <legend className={label}>{t.form.deliveryType}</legend>
            <div className={`grid gap-2 ${allowedTypes.length > 1 ? "@min-[40rem]:grid-cols-2" : ""}`}>
              {allowedTypes.map((type) => {
                const price = wilaya ? lineShipping(shippingPrice(rates, wilaya, type), line.offer) : undefined;
                const unavailable = price === null;
                return (
                  <label
                    key={type}
                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-[var(--s-radius-btn)] border-2 px-4 py-3 text-sm transition ${deliveryType === type ? "border-brand bg-brand/5" : "border-s-field-edge"} ${unavailable ? "pointer-events-none opacity-40" : ""}`}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      <input type="radio" name="deliveryType" value={type} checked={deliveryType === type} disabled={unavailable} onChange={() => setDeliveryType(type)} className="size-4 accent-[var(--brand)]" />
                      {type === "home" ? settings.homeLabel || t.form.home : settings.officeLabel || t.form.office}
                    </span>
                    {price !== undefined && <span className="font-bold">{price === null ? t.summary.notDelivered : price === 0 ? t.summary.free : formatPrice(price, currency)}</span>}
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      case "address":
        if (deliveryType !== "home" || settings.address === "hidden") return null;
        return (
          <div className={wide}>
            <label htmlFor="address" className={label}>
              {text("address", settings.address === "required" ? t.form.addressRequired : t.form.address)}
            </label>
            {withIcon(
              "address",
              <input id="address" aria-invalid={Boolean(err("address"))} name="address" autoComplete="street-address" placeholder={hint("address", t.form.addressPlaceholder)} className={field + pad} />,
            )}
            {error("address")}
          </div>
        );
      case "note":
        if (!settings.note) return null;
        return (
          <div className={wide}>
            <label htmlFor="note" className={label}>
              {text("note", t.form.note)}
            </label>
            <textarea id="note" name="note" rows={2} maxLength={500} placeholder={hint("note")} className={field} />
          </div>
        );
      case "summary":
        return (
          <dl className={`space-y-2 rounded-[var(--s-radius-btn)] bg-s-bg p-4 text-sm ${wide} ${settings.showSummary ? "" : "hidden"}`} data-testid="summary">
            <div className="flex justify-between">
              <dt className="text-s-muted">
                {t.summary.product} {quantity > 1 && `(×${quantity})`}
              </dt>
              <dd className="font-semibold">{formatPrice(line.total, currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-s-muted">{t.summary.shipping}</dt>
              <dd className="font-semibold">
                {!hasRates ? t.summary.free : shipping === undefined ? t.summary.chooseWilayaFirst : shipping === null ? t.summary.notDelivered : shipping === 0 ? t.summary.free : formatPrice(shipping, currency)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-s-edge pt-2 text-base">
              <dt className="font-bold">{t.summary.total}</dt>
              <dd className="font-extrabold text-brand-ink" data-testid="total">
                {formatPrice(total, currency)}
              </dd>
            </div>
          </dl>
        );
    }
    const b = blocks.get(key);
    if (b) return <div className={wide}>{formBlock(b)}</div>;
    const c = custom.get(key);
    if (!c) return null;
    // A box to tick: the label sits beside it
    if (c.type === "checkbox")
      return (
        <div className={wide}>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input type="checkbox" id={`custom_${c.id}`} name={`custom_${c.id}`} value="1" className="mt-0.5 size-4 accent-[var(--brand)]" aria-invalid={Boolean(err(`custom_${c.id}`))} />
            <span>{c.label}</span>
          </label>
          {error(`custom_${c.id}`)}
        </div>
      );
    return (
      <div>
        <label htmlFor={`custom_${c.id}`} className={label}>
          {c.label}
          {!c.required && <span className="font-normal"> ({t.form.optional})</span>}
        </label>
        {customInput(c)}
        {error(`custom_${c.id}`)}
      </div>
    );
  };

  const effect = settings.buttonEffect === "pulse" ? "btn-pulse" : settings.buttonEffect === "shake" ? "btn-shake" : "";
  const submitLabel = soldOut ? t.outOfStock : `${settings.buttonText || t.form.submit} · ${formatPrice(total, currency)}`;
  const form = (
    <form
      ref={formRef}
      id={overlay ? "order-form-fields" : "order-form"}
      onSubmit={onSubmit}
      onFocusCapture={() => {
        startedAt.current ??= Date.now();
        checkoutStarted();
      }}
      onSubmitCapture={() => {
        if (fillRef.current) fillRef.current.value = String(Math.round((Date.now() - (startedAt.current ?? Date.now())) / 1000));
      }}
      noValidate
      className={overlay ? "space-y-5 p-4 @min-[40rem]:p-5" : "space-y-5 rounded-[var(--s-radius)] border-2 border-brand/30 bg-s-surface p-4 shadow-[var(--s-shadow)] @min-[40rem]:p-5"}
    >
      <div className={overlay ? "pe-8" : ""}>
        <h2 className="text-xl font-extrabold">{settings.title || t.form.title}</h2>
        <p className="mt-1 text-sm text-s-muted">{settings.subtitle || t.form.subtitle}</p>
      </div>

      <input type="hidden" name="variantId" value={variant?.id ?? ""} />
      <input type="hidden" name="choices" value={JSON.stringify(picked)} />
      <input type="hidden" name="quantity" value={quantity} />
      <input ref={fillRef} type="hidden" name="fill" defaultValue="" />
      {/* Honeypot: invisible to people */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -start-[9999px] h-0 w-0 opacity-0" />

      {stepper && (
        <ol className="flex items-center gap-2 text-xs font-semibold text-s-muted" data-testid="form-steps" data-step={step}>
          {[1, 2].map((n) => (
            <li key={n} className={`flex flex-1 items-center gap-2 ${step >= n ? "text-brand-ink" : ""}`}>
              <span className={`flex size-6 items-center justify-center rounded-full ${step >= n ? "bg-brand text-brand-fg" : "bg-s-bg"}`}>{n}</span>
              {n === 1 ? t.form.stepContact : t.form.stepDelivery}
            </li>
          ))}
        </ol>
      )}
      <div className={`grid gap-4 ${settings.layout === "compact" ? "@min-[40rem]:grid-cols-2" : ""}`}>
        {settings.order.map((key, i) => {
          const node = element(key);
          // Two steps: the second step's fields stay in the form (hidden) so everything is sent together
          const later = stepper && step === 1 && i > split;
          const earlier = stepper && step === 2 && i <= split;
          return node ? (
            <div key={key} className={later || earlier ? "hidden" : "contents"} data-element={key}>
              {node}
            </div>
          ) : null;
        })}
      </div>

      {state.error && (
        <p role="alert" className="rounded-[var(--s-radius-btn)] bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {errors[state.error] ?? errors.unexpected}
        </p>
      )}

      {payMethods.length > 0 && (!stepper || step === 2) && <PaymentChoice t={t} methods={payMethods} cardOnly={product.cardOnly} />}
      {captcha && (captcha.mode === "always" || state.error === "captcha") && (!stepper || step === 2) && <TurnstileBox siteKey={captcha.siteKey} lang={t.lang} />}
      {stepper && step === 1 ? (
        <button type="button" onClick={nextStep} disabled={soldOut} className="flex w-full items-center justify-center gap-2 rounded-[var(--s-radius-btn)] bg-brand px-6 py-4 text-lg font-extrabold text-brand-fg shadow-lg shadow-brand/30 transition hover:brightness-110 disabled:opacity-60" data-testid="form-next">
          {soldOut ? t.outOfStock : t.form.next} <ChevronLeft size={20} className="ltr:rotate-180" />
        </button>
      ) : (
      <button
        type="submit"
        disabled={pending || soldOut}
        className={`flex w-full items-center justify-center gap-2 rounded-[var(--s-radius-btn)] bg-brand px-6 py-4 text-lg font-extrabold text-brand-fg shadow-lg shadow-brand/30 transition hover:brightness-110 disabled:opacity-60 ${pending || soldOut ? "" : effect}`}
      >
        {pending ? <LoaderCircle className="animate-spin" size={20} /> : <ShoppingBag size={20} />}
        {pending ? t.form.sending : submitLabel}
      </button>
      )}
      {stepper && step === 2 && (
        <button type="button" onClick={() => setStep(1)} className="w-full text-center text-sm font-semibold text-s-muted hover:text-s-text" data-testid="form-back">
          {t.form.previous}
        </button>
      )}
      {cart && !soldOut && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              if (variants.length > 0 && !variant) return;
              addToCart(cart.shopId, { productId: cart.productId, variantId: variant?.id ?? null, quantity });
              setAdded(true);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--s-radius-btn)] border-2 border-brand px-6 py-3 text-base font-bold text-brand-ink transition hover:bg-brand/10"
            data-testid="add-to-cart"
          >
            <ShoppingCart size={19} /> {t.cart.add}
          </button>
          {added && (
            <p className="flex items-center justify-center gap-2 text-sm font-semibold" data-testid="cart-added">
              <Check size={16} className="text-brand-ink" /> {t.cart.added} ·{" "}
              <a href={cart.href} className="text-brand-ink underline">
                {t.cart.view}
              </a>
            </p>
          )}
        </div>
      )}
      {settings.whatsapp && whatsapp?.phone && !soldOut && (
        <button
          type="button"
          onClick={orderOnWhatsapp}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--s-radius-btn)] border-2 border-[#25d366] px-6 py-3 text-base font-bold text-[#128c4b] transition hover:bg-[#25d366]/10"
          data-testid="whatsapp-order"
        >
          <MessageCircle size={19} /> {t.form.whatsapp}
        </button>
      )}
      {product.trackStock && !soldOut && available <= 5 && <p className="text-center text-sm font-semibold text-amber-700">{fmt(t.inStockLow, { n: available })}</p>}
    </form>
  );

  return (
    <>
      {overlay ? (
        <>
          {/* In the page: the order button (links to #order-form land here and open the form) */}
          <div ref={anchorRef} id="order-form" className="rounded-[var(--s-radius)] border-2 border-brand/30 bg-s-surface p-4 shadow-[var(--s-shadow)] @min-[40rem]:p-5">
            <h2 className="text-xl font-extrabold">{settings.title || t.form.title}</h2>
            <p className="mt-1 text-sm text-s-muted">{settings.subtitle || t.form.subtitle}</p>
            <button
              type="button"
              onClick={() => setOpen(true)}
              disabled={soldOut}
              className={`mt-4 flex w-full items-center justify-center gap-2 rounded-[var(--s-radius-btn)] bg-brand px-6 py-4 text-lg font-extrabold text-brand-fg shadow-lg shadow-brand/30 transition hover:brightness-110 disabled:opacity-60 ${soldOut ? "" : effect}`}
              data-testid="open-order-form"
            >
              <ShoppingBag size={20} /> {soldOut ? t.outOfStock : `${settings.buttonText || t.form.title} · ${formatPrice(line.total, currency)}`}
            </button>
          </div>
          {/* The form stays mounted while closed, so nothing typed is lost */}
          <div className={open ? "fixed inset-0 z-50" : "hidden"} data-testid="order-overlay" data-kind={overlay}>
            <button type="button" aria-label={t.form.close} className="absolute inset-0 bg-black/55" onClick={() => setOpen(false)} tabIndex={-1} />
            <div
              role="dialog"
              aria-modal="true"
              className={
                overlay === "popup"
                  ? "absolute inset-x-3 top-1/2 mx-auto max-h-[92vh] max-w-lg -translate-y-1/2 overflow-y-auto rounded-[var(--s-radius)] bg-s-surface text-s-text shadow-2xl"
                  : "absolute inset-y-0 end-0 w-full max-w-md overflow-y-auto bg-s-surface text-s-text shadow-2xl"
              }
            >
              <button type="button" onClick={() => setOpen(false)} aria-label={t.form.close} className="absolute end-3 top-3 z-10 rounded-full p-1.5 text-s-muted hover:bg-s-bg" data-testid="close-order-form">
                <X size={20} />
              </button>
              {form}
            </div>
          </div>
        </>
      ) : (
        form
      )}

      {/* Mobile: a sticky button that brings the form into view (or opens it) */}
      <a
        href="#order-form"
        aria-hidden={formVisible}
        className={`${formVisible || embedded || !settings.stickyButton || open ? "hidden" : "flex"} fixed inset-x-3 bottom-3 z-30 items-center justify-center gap-2 rounded-[var(--s-radius-btn)] bg-brand py-3.5 text-base font-extrabold text-brand-fg shadow-xl @min-[48rem]:hidden ${effect}`}
      >
        <ShoppingBag size={18} /> {settings.buttonText || t.form.title}
      </a>
    </>
  );
}

// Apps → Online payments: cash on delivery (default) and each method the store connected, listed separately.
// cardOnly: the product is sold with online payment only (no cash on delivery)
export function PaymentChoice({ t, methods, cardOnly = false }: { t: StoreText; methods: OnlineMethod[]; cardOnly?: boolean }) {
  const choices = [...(cardOnly ? [] : (["cod"] as const)), ...methods];
  return (
    <fieldset className="space-y-2" data-testid="payment-choice">
      <legend className="mb-1 text-sm font-semibold">{t.payment.title}</legend>
      {choices.map((m, i) => (
        <label key={m} className="flex cursor-pointer items-center gap-2 rounded-[var(--s-radius-btn)] border border-s-field-edge p-3 text-sm has-checked:border-brand">
          <input type="radio" name="payment" value={m} defaultChecked={i === 0} className="accent-[var(--brand)]" data-testid={`payment-${m}`} />
          <span className="flex-1 font-semibold">{t.payment.methods[m]}</span>
        </label>
      ))}
      {methods.length > 0 && <p className="text-xs text-s-muted">{t.payment.cardHint}</p>}
    </fieldset>
  );
}
