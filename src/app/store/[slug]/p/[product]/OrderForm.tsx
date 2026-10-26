"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import type { StoreDictionary } from "@/i18n/store";
import type { ProductOption, QuantityOffer } from "@/db/schema";
import { wilayas } from "@/lib/wilayas";
import { formatPrice } from "@/lib/format";
import { isValidDzPhone, normalizePhone } from "@/lib/phone";
import { trackInitiateCheckout } from "@/lib/track";
import type { OrderFormState } from "../../actions";

type Variant = { id: string; title: string; optionValues: Record<string, string>; price: number | null; stock: number };
type Rates = Record<number, { home: number | null; desk: number | null }> | null;

export function OrderForm({
  action,
  saveLead,
  product,
  offers,
  s,
  locale,
  currency,
  currencyCode,
  price,
  options,
  variants,
  trackStock,
  productStock,
  rates,
}: {
  action: (state: OrderFormState, formData: FormData) => Promise<OrderFormState>;
  saveLead: (input: { name: string; phone: string; wilaya: number | null }) => Promise<void>;
  product: { id: string; name: string };
  offers: QuantityOffer[];
  s: StoreDictionary;
  locale: string;
  currency: string;
  currencyCode: string;
  price: number;
  options: ProductOption[];
  variants: Variant[];
  trackStock: boolean;
  productStock: number;
  rates: Rates;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(options.map((o) => [o.name, o.values[0]])),
  );
  const [quantity, setQuantity] = useState(1);
  const [wilaya, setWilaya] = useState<number | "">("");
  const [deliveryType, setDeliveryType] = useState<"home" | "desk">("home");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const checkoutTracked = useRef(false);

  const variant = variants.find((v) => options.every((o) => v.optionValues[o.name] === selected[o.name])) ?? null;
  const unitPrice = variant?.price ?? price;
  const stock = variant ? variant.stock : productStock;
  const outOfStock = trackStock && stock < 1;

  const rate = rates && wilaya !== "" ? rates[wilaya] : null;
  const shipping = rates === null ? 0 : wilaya === "" ? null : deliveryType === "home" ? rate?.home ?? null : rate?.desk ?? null;
  const offer = offers.find((o) => o.quantity === quantity);
  const subtotal = offer ? offer.price : unitPrice * quantity;
  const money = (n: number) => formatPrice(n, currency);

  const onFirstInteraction = () => {
    if (checkoutTracked.current) return;
    checkoutTracked.current = true;
    trackInitiateCheckout({ id: product.id, name: product.name, price: unitPrice }, currencyCode);
  };

  // Save the visitor as a lead (abandoned cart) once the phone looks valid.
  const normalized = normalizePhone(phone);
  const phoneValid = isValidDzPhone(normalized);
  useEffect(() => {
    if (!phoneValid) return;
    const t = setTimeout(() => {
      saveLead({ name, phone: normalized, wilaya: wilaya === "" ? null : wilaya }).catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [phoneValid, normalized, name, wilaya, saveLead]);

  return (
    // Submitting through onSubmit (not action=) keeps what the customer typed when the server returns an error.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      onFocus={onFirstInteraction}
      className="space-y-4 rounded-2xl border-2 border-brand/30 bg-white p-5 shadow-lg"
    >
      <h2 className="text-lg font-bold">{s.orderTitle}</h2>
      <input type="hidden" name="variantId" value={variant?.id ?? ""} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      {options.map((o) => (
        <div key={o.name}>
          <div className="label">{o.name}</div>
          <div className="flex flex-wrap gap-2">
            {o.values.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setSelected({ ...selected, [o.name]: v })}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${selected[o.name] === v ? "border-brand bg-brand text-white" : "border-slate-300 bg-white"}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="grid gap-3 sm:grid-cols-2">
        <input className="input" name="name" required minLength={2} placeholder={s.name} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          className="input text-start"
          name="phone"
          required
          type="tel"
          inputMode="tel"
          placeholder={s.phone}
          dir="ltr"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <select className="input" name="wilaya" required value={wilaya} onChange={(e) => setWilaya(e.target.value ? Number(e.target.value) : "")}>
          <option value="">{s.chooseWilaya}</option>
          {wilayas.map((w) => (
            <option key={w.code} value={w.code}>
              {String(w.code).padStart(2, "0")} - {locale === "ar" ? w.ar : w.fr}
            </option>
          ))}
        </select>
        <input className="input" name="commune" required minLength={2} placeholder={s.commune} />
      </div>
      <input className="input" name="address" placeholder={s.address} />

      <div className="grid grid-cols-2 gap-2">
        {(["home", "desk"] as const).map((type) => (
          <label key={type} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${deliveryType === type ? "border-brand bg-brand/5" : "border-slate-200"}`}>
            <input type="radio" name="deliveryType" value={type} checked={deliveryType === type} onChange={() => setDeliveryType(type)} />
            {type === "home" ? s.home : s.desk}
          </label>
        ))}
      </div>

      {offers.length > 0 && (
        <div>
          <div className="label">{s.offersTitle}</div>
          <div className="grid gap-2">
            {[{ quantity: 1, price: unitPrice, label: undefined } as QuantityOffer, ...offers].map((o) => {
              const saving = unitPrice * o.quantity - o.price;
              return (
                <button
                  key={o.quantity}
                  type="button"
                  onClick={() => setQuantity(o.quantity)}
                  className={`flex items-center justify-between rounded-lg border-2 px-3 py-2 text-start text-sm ${quantity === o.quantity ? "border-brand bg-brand/5" : "border-slate-200"}`}
                >
                  <span className="font-semibold">
                    {o.label || `${o.quantity} ${s.pieces}`}
                    {saving > 0 && <span className="badge ms-2 bg-green-100 text-green-700">{s.save} {money(saving)}</span>}
                  </span>
                  <span className="font-bold text-brand">{money(o.price)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{s.quantity}</span>
        <div className="flex items-center rounded-lg border border-slate-300">
          <button type="button" className="px-3 py-1 text-lg" onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button>
          <input name="quantity" value={quantity} readOnly className="w-10 text-center" />
          <button type="button" className="px-3 py-1 text-lg" onClick={() => setQuantity(Math.min(20, quantity + 1))}>+</button>
        </div>
      </div>

      <dl className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
        <div className="flex justify-between"><dt>{s.subtotal}</dt><dd>{money(subtotal)}</dd></div>
        <div className="flex justify-between">
          <dt>{s.shipping}</dt>
          <dd>{shipping === null ? "—" : shipping === 0 ? s.free : money(shipping)}</dd>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-bold">
          <dt>{s.total}</dt>
          <dd className="text-brand">{money(subtotal + (shipping ?? 0))}</dd>
        </div>
      </dl>

      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{s.errors[state.error]}</p>}

      <button className="btn w-full py-3 text-base" disabled={pending || outOfStock}>
        {outOfStock ? s.outOfStock : pending ? "…" : `${s.orderNow} · ${s.cod}`}
      </button>
    </form>
  );
}
