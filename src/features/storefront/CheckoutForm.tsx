"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Minus, Plus, ShoppingBag } from "lucide-react";
import type { ProductOption, QuantityOffer } from "@/server/db/schema";
import type { StoreText } from "@/i18n/store";
import type { ActionState } from "@/lib/action";
import { fmt, formatPrice } from "@/lib/format";
import { isValidDzPhone, normalizePhone } from "@/lib/phone";
import { useActionForm } from "@/ui/form";
import { MAX_QUANTITY, linePrice, shippingPrice, type RateMap } from "@/features/checkout/pricing";
import { useCheckoutStarted } from "@/features/pixels/PixelScope";
import { defaultForm, type FormSettings } from "@/features/landing/types";

type Variant = { id: string; values: Record<string, string>; price: number | null; stock: number };
type LeadInput = { name?: string; phone?: string; wilaya?: number | null; variantId?: string; quantity?: number };

const field = "w-full rounded-[var(--s-radius-btn)] border border-s-field-edge bg-s-field px-3.5 py-3 text-base outline-none transition focus:border-brand focus:bg-s-surface focus:ring-2 focus:ring-brand/20 aria-[invalid=true]:border-red-500";
const label = "mb-1.5 block text-sm font-semibold text-s-muted";

export function CheckoutForm({
  t,
  currency,
  product,
  variants,
  rates,
  wilayas,
  action,
  saveLead,
  settings = defaultForm,
  embedded = false,
}: {
  t: StoreText;
  currency: string;
  product: { price: number; trackStock: boolean; stock: number; options: ProductOption[]; offers: QuantityOffer[] };
  variants: Variant[];
  rates: RateMap;
  wilayas: { code: number; name: string }[];
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  saveLead: (input: LeadInput) => Promise<void>;
  // Landing page form customization (the store's product page uses the defaults)
  settings?: FormSettings;
  // Inside an iframe on another site: no sticky button
  embedded?: boolean;
}) {
  const { state, pending, onSubmit } = useActionForm(action);
  const errors = t.errors as Record<string, string>;
  const err = (name: string) => {
    const key = state.fieldErrors?.[name];
    return key ? (errors[key] ?? errors.invalid) : undefined;
  };

  const [selected, setSelected] = useState<Record<string, string>>(() =>
    // Preselect the first in-stock combination so the price is right from the start.
    variants.length ? (variants.find((v) => !product.trackStock || v.stock > 0) ?? variants[0]).values : {},
  );
  const [quantity, setQuantity] = useState(1);
  const [wilaya, setWilaya] = useState<number | null>(null);
  const allowedTypes = settings.delivery === "both" ? (["home", "office"] as const) : ([settings.delivery] as const);
  const [deliveryType, setDeliveryType] = useState<"home" | "office">(allowedTypes[0]);
  const formRef = useRef<HTMLFormElement>(null);
  const checkoutStarted = useCheckoutStarted();
  const lastLead = useRef("");
  const [formVisible, setFormVisible] = useState(true);

  // The mobile sticky button is shown only while the form is off screen.
  useEffect(() => {
    const form = formRef.current;
    if (!form || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setFormVisible(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(form);
    return () => observer.disconnect();
  }, []);

  const variant = variants.find((v) => product.options.every((o) => v.values[o.name] === selected[o.name])) ?? null;
  const available = !product.trackStock ? Infinity : variants.length ? (variant?.stock ?? 0) : product.stock;
  const soldOut = available <= 0 || (variants.length > 0 && !variant);
  const line = linePrice(variant?.price ?? product.price, quantity, product.offers);
  const shipping = wilaya ? shippingPrice(rates, wilaya, deliveryType) : undefined;
  const total = line.total + (shipping ?? 0);
  const hasRates = Object.keys(rates).length > 0;

  // A value is unavailable when every variant having it (with the other choices) is sold out.
  const valueAvailable = (option: string, value: string) =>
    !product.trackStock ||
    variants.some((v) => v.values[option] === value && v.stock > 0 && product.options.every((o) => o.name === option || v.values[o.name] === selected[o.name]));

  const quantityChoices = settings.showOffers && product.offers.length ? [1, ...product.offers.map((o) => o.quantity).sort((a, b) => a - b)] : [];
  const maxQuantity = Math.min(MAX_QUANTITY, available);

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

  return (
    <>
      <form ref={formRef} id="order-form" onSubmit={onSubmit} onFocusCapture={checkoutStarted} noValidate className="space-y-5 rounded-[var(--s-radius)] border-2 border-brand/30 bg-s-surface p-4 shadow-[var(--s-shadow)] sm:p-5">
        <div>
          <h2 className="text-xl font-extrabold">{settings.title || t.form.title}</h2>
          <p className="mt-1 text-sm text-s-muted">{settings.subtitle || t.form.subtitle}</p>
        </div>

        <input type="hidden" name="variantId" value={variant?.id ?? ""} />
        <input type="hidden" name="quantity" value={quantity} />
        {/* Honeypot: invisible to people */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -start-[9999px] h-0 w-0 opacity-0" />

        {product.options.map((option) => (
          <fieldset key={option.name}>
            <legend className={label}>{fmt(t.choose, { option: option.name })}</legend>
            <div className="flex flex-wrap gap-2">
              {option.values.map((value) => {
                const active = selected[option.name] === value;
                const ok = valueAvailable(option.name, value);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    disabled={!ok}
                    onClick={() => setSelected((s) => ({ ...s, [option.name]: value }))}
                    className={`min-w-12 rounded-[var(--s-radius-btn)] border-2 px-4 py-2 text-sm font-bold transition ${
                      active ? "border-brand bg-brand text-brand-fg" : "border-s-field-edge bg-s-surface hover:border-brand"
                    } disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        {quantityChoices.length ? (
          <fieldset>
            <legend className={label}>{t.form.quantity}</legend>
            <div className="grid gap-2">
              {quantityChoices.map((q) => {
                const price = linePrice(line.unitPrice, q, product.offers);
                const saving = line.unitPrice * q - price.total;
                const active = quantity === q;
                return (
                  <label
                    key={q}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-[var(--s-radius-btn)] border-2 px-4 py-3 transition ${active ? "border-brand bg-brand/5" : "border-s-field-edge"} ${q > maxQuantity ? "pointer-events-none opacity-40" : ""}`}
                  >
                    <span className="flex items-center gap-3">
                      <input type="radio" name="quantityChoice" checked={active} disabled={q > maxQuantity} onChange={() => setQuantity(q)} className="size-4 accent-[var(--brand)]" />
                      <span className="font-bold">{fmt(t.form.pieces, { n: q })}</span>
                      {price.offer?.label && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">{price.offer.label}</span>}
                    </span>
                    <span className="text-end">
                      <span className="block font-extrabold">{formatPrice(price.total, currency)}</span>
                      {saving > 0 && <span className="block text-xs font-semibold text-green-700">{fmt(t.form.save, { amount: formatPrice(saving, currency) })}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : (
          <div>
            <span className={label}>{t.form.quantity}</span>
            <div className="inline-flex items-center rounded-[var(--s-radius-btn)] border border-s-field-edge">
              <button type="button" aria-label="-" className="p-3 disabled:opacity-30" disabled={quantity <= 1} onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                <Minus size={16} />
              </button>
              <span className="min-w-10 text-center font-bold" data-testid="quantity">
                {quantity}
              </span>
              <button type="button" aria-label="+" className="p-3 disabled:opacity-30" disabled={quantity >= maxQuantity} onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}>
                <Plus size={16} />
              </button>
            </div>
          </div>
        )}

        <div className={`grid gap-4 ${settings.layout === "compact" ? "sm:grid-cols-2" : ""}`}>
          <div>
            <label htmlFor="name" className={label}>
              {t.form.name}
            </label>
            <input id="name" aria-invalid={Boolean(err("name"))} name="name" autoComplete="name" placeholder={t.form.namePlaceholder} className={field} onBlur={rememberLead} />
            {err("name") && <p className="mt-1 text-sm text-red-600">{err("name")}</p>}
          </div>
          <div>
            <label htmlFor="phone" className={label}>
              {t.form.phone}
            </label>
            <input id="phone" aria-invalid={Boolean(err("phone"))} name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder="0555 12 34 56" className={`${field} text-start`} onBlur={rememberLead} />
            {err("phone") && <p className="mt-1 text-sm text-red-600">{err("phone")}</p>}
          </div>
          <div>
            <label htmlFor="wilaya" className={label}>
              {t.form.wilaya}
            </label>
            <select
              id="wilaya" aria-invalid={Boolean(err("wilaya"))}
              name="wilaya"
              className={`${field} select-chevron cursor-pointer appearance-none pe-10`}
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
              <option value="">{t.form.chooseWilaya}</option>
              {wilayas.map((w) => (
                <option key={w.code} value={w.code}>
                  {w.name}
                </option>
              ))}
            </select>
            {err("wilaya") && <p className="mt-1 text-sm text-red-600">{err("wilaya")}</p>}
          </div>
          <div>
            <label htmlFor="commune" className={label}>
              {t.form.commune}
            </label>
            <input id="commune" aria-invalid={Boolean(err("commune"))} name="commune" placeholder={t.form.communePlaceholder} className={field} />
            {err("commune") && <p className="mt-1 text-sm text-red-600">{err("commune")}</p>}
          </div>
          {settings.custom.map((c) => (
            <div key={c.id}>
              <label htmlFor={`custom_${c.id}`} className={label}>
                {c.label}
                {!c.required && <span className="font-normal"> ({t.form.optional})</span>}
              </label>
              {c.type === "select" ? (
                <select id={`custom_${c.id}`} name={`custom_${c.id}`} className={`${field} select-chevron cursor-pointer appearance-none pe-10`} defaultValue="">
                  <option value="">{t.form.choose}</option>
                  {c.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input id={`custom_${c.id}`} name={`custom_${c.id}`} maxLength={200} className={field} />
              )}
              {err(`custom_${c.id}`) && <p className="mt-1 text-sm text-red-600">{err(`custom_${c.id}`)}</p>}
            </div>
          ))}
        </div>

        <fieldset>
          <legend className={label}>{t.form.deliveryType}</legend>
          <div className={`grid gap-2 ${allowedTypes.length > 1 ? "sm:grid-cols-2" : ""}`}>
            {allowedTypes.map((type) => {
              const price = wilaya ? shippingPrice(rates, wilaya, type) : undefined;
              const unavailable = price === null;
              return (
                <label
                  key={type}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-[var(--s-radius-btn)] border-2 px-4 py-3 text-sm transition ${deliveryType === type ? "border-brand bg-brand/5" : "border-s-field-edge"} ${unavailable ? "pointer-events-none opacity-40" : ""}`}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <input type="radio" name="deliveryType" value={type} checked={deliveryType === type} disabled={unavailable} onChange={() => setDeliveryType(type)} className="size-4 accent-[var(--brand)]" />
                    {type === "home" ? t.form.home : t.form.office}
                  </span>
                  {price !== undefined && <span className="font-bold">{price === null ? t.summary.notDelivered : price === 0 ? t.summary.free : formatPrice(price, currency)}</span>}
                </label>
              );
            })}
          </div>
        </fieldset>

        {deliveryType === "home" && settings.address !== "hidden" && (
          <div>
            <label htmlFor="address" className={label}>
              {settings.address === "required" ? t.form.addressRequired : t.form.address}
            </label>
            <input id="address" aria-invalid={Boolean(err("address"))} name="address" autoComplete="street-address" placeholder={t.form.addressPlaceholder} className={field} />
            {err("address") && <p className="mt-1 text-sm text-red-600">{err("address")}</p>}
          </div>
        )}
        {settings.note && (
          <div>
            <label htmlFor="note" className={label}>
              {t.form.note}
            </label>
            <textarea id="note" name="note" rows={2} maxLength={500} className={field} />
          </div>
        )}

        <dl className={`space-y-2 rounded-[var(--s-radius-btn)] bg-s-bg p-4 text-sm ${settings.showSummary ? "" : "hidden"}`} data-testid="summary">
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

        {state.error && (
          <p role="alert" className="rounded-[var(--s-radius-btn)] bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errors[state.error] ?? errors.unexpected}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || soldOut}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--s-radius-btn)] bg-brand px-6 py-4 text-lg font-extrabold text-brand-fg shadow-lg shadow-brand/30 transition hover:brightness-110 disabled:opacity-60"
        >
          {pending ? <LoaderCircle className="animate-spin" size={20} /> : <ShoppingBag size={20} />}
          {soldOut ? t.outOfStock : pending ? t.form.sending : `${settings.buttonText || t.form.submit} · ${formatPrice(total, currency)}`}
        </button>
        {product.trackStock && !soldOut && available <= 5 && <p className="text-center text-sm font-semibold text-amber-700">{fmt(t.inStockLow, { n: available })}</p>}
      </form>

      {/* Mobile: a sticky button that brings the form into view */}
      <a href="#order-form" aria-hidden={formVisible} className={`${formVisible || embedded || !settings.stickyButton ? "hidden" : "flex"} fixed inset-x-3 bottom-3 z-30 items-center justify-center gap-2 rounded-[var(--s-radius-btn)] bg-brand py-3.5 text-base font-extrabold text-brand-fg shadow-xl md:hidden`}>
        <ShoppingBag size={18} /> {settings.buttonText || t.form.title}
      </a>
    </>
  );
}
