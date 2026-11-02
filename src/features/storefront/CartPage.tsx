"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LoaderCircle, Minus, Plus, ShoppingBag, ShoppingCart, Trash2 } from "lucide-react";
import type { StoreText } from "@/i18n/store";
import type { ActionState } from "@/lib/action";
import { formatPrice } from "@/lib/format";
import { useActionForm } from "@/ui/form";
import { shippingPrice, type RateMap } from "@/features/checkout/pricing";
import { CommuneSelect } from "@/features/checkout/CommuneSelect";
import { onCartChange, readCart, writeCart, type CartItem } from "./cart";
import { priceCart, type PricedLine } from "./cart-actions";
import { PaymentChoice } from "./CheckoutForm";

const emptyCart: CartItem[] = [];

// Apps → Shopping cart: the lines (priced by the server), then one delivery form for the whole order
export function CartPage({ slug, shopId, base, rates, wilayas, arabic, currency, action, cardPayment = false, t }: { slug: string; shopId: string; base: string; rates: RateMap; wilayas: { code: number; name: string }[]; arabic: boolean; currency: string; action: (prev: ActionState, fd: FormData) => Promise<ActionState>; cardPayment?: boolean; t: StoreText }) {
  const snapshot = useRef<{ key: string; items: CartItem[] }>({ key: "", items: emptyCart });
  const items = useSyncExternalStore(
    onCartChange,
    () => {
      const now = readCart(shopId);
      const key = JSON.stringify(now);
      if (key !== snapshot.current.key) snapshot.current = { key, items: now };
      return snapshot.current.items;
    },
    () => emptyCart,
  );
  const [lines, setLines] = useState<PricedLine[] | null>(null);
  useEffect(() => {
    let live = true;
    priceCart(slug, items)
      .then((l) => live && setLines(l))
      .catch(() => live && setLines([]));
    return () => {
      live = false;
    };
  }, [slug, items]);
  const { state, pending, onSubmit } = useActionForm(action);
  const [wilaya, setWilaya] = useState<number | null>(null);
  const [deliveryType, setDeliveryType] = useState<"home" | "office">("home");
  const started = useRef<number | null>(null);
  const fill = useRef<HTMLInputElement>(null);

  const setQty = (i: number, q: number) => writeCart(shopId, items.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, Math.min(1000, q)) } : x)));
  const remove = (i: number) => writeCart(shopId, items.filter((_, j) => j !== i));
  const ok = (lines ?? []).filter((l) => l.available);
  const subtotal = ok.reduce((n, l) => n + l.total, 0);
  const shipping = wilaya ? shippingPrice(rates, wilaya, deliveryType) : null;
  const err = (k: string) => {
    const key = state.fieldErrors?.[k];
    return key ? ((t.errors as Record<string, string>)[key] ?? t.errors.invalid) : null;
  };
  const field = "h-12 w-full rounded-[var(--s-radius-btn)] border border-s-field-edge bg-s-field px-4 outline-none focus:border-brand";

  if (!items.length)
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center" data-testid="cart-empty">
        <ShoppingCart size={48} className="mx-auto text-s-muted" />
        <p className="text-lg font-semibold">{t.cart.empty}</p>
        <Link href={base || "/"} className="inline-flex h-12 items-center rounded-[var(--s-radius-btn)] bg-brand px-6 font-bold text-brand-fg">
          {t.cart.shop}
        </Link>
      </div>
    );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]" data-testid="cart-page">
      <section className="space-y-3">
        <h1 className="text-2xl font-extrabold">{t.cart.title}</h1>
        {items.map((item, i) => {
          const l = lines?.[i];
          return (
            <article key={`${item.productId}-${item.variantId}`} className="flex gap-3 rounded-[var(--s-radius)] border border-s-card-border bg-s-surface p-3 shadow-[var(--s-shadow)]" data-cart-line={i}>
              {l?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.image} alt="" className="size-20 rounded-[var(--s-radius)] object-cover" />
              ) : (
                <span className="grid size-20 place-items-center rounded-[var(--s-radius)] bg-s-bg text-s-muted">
                  <ShoppingBag size={22} />
                </span>
              )}
              <div className="min-w-0 flex-1 space-y-1">
                {l && !l.available ? (
                  <p className="text-sm font-semibold text-red-600">{t.cart.unavailable}</p>
                ) : (
                  <Link href={l?.href ?? "#"} className="block truncate font-bold hover:text-brand-ink">
                    {l?.name ?? "…"}
                  </Link>
                )}
                {l?.variantTitle && <p className="text-sm text-s-muted">{l.variantTitle}</p>}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center rounded-[var(--s-radius-btn)] border border-s-field-edge">
                    <button type="button" aria-label="-" className="p-2 disabled:opacity-30" disabled={item.quantity <= 1} onClick={() => setQty(i, item.quantity - 1)}>
                      <Minus size={14} />
                    </button>
                    <span className="min-w-8 text-center font-bold" data-testid={`cart-qty-${i}`}>
                      {item.quantity}
                    </span>
                    <button type="button" aria-label="+" className="p-2" onClick={() => setQty(i, item.quantity + 1)}>
                      <Plus size={14} />
                    </button>
                  </div>
                  <button type="button" onClick={() => remove(i)} className="inline-flex items-center gap-1 text-sm text-s-muted hover:text-red-600" data-testid={`cart-remove-${i}`}>
                    <Trash2 size={14} /> {t.cart.remove}
                  </button>
                  {l?.available && <span className="ms-auto font-extrabold">{formatPrice(l.total, currency)}</span>}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <form
        onSubmit={(ev) => {
          if (fill.current) fill.current.value = String(Math.round((Date.now() - (started.current ?? Date.now())) / 1000));
          onSubmit(ev);
        }}
        onFocus={() => {
          started.current ??= Date.now();
        }}
        noValidate
        className="space-y-3 self-start rounded-[var(--s-radius)] border border-s-card-border bg-s-surface p-5 shadow-[var(--s-shadow)]"
        data-testid="cart-form"
      >
        <h2 className="text-lg font-extrabold">{t.cart.checkout}</h2>
        <input type="hidden" name="items" value={JSON.stringify(items)} />
        <input ref={fill} type="hidden" name="fill" defaultValue="" />
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -start-[9999px] h-0 w-0 opacity-0" />
        <label className="block space-y-1 text-sm font-semibold">
          {t.form.name}
          <input id="name" name="name" autoComplete="name" placeholder={t.form.namePlaceholder} className={field} />
          {err("name") && <span className="text-xs text-red-600">{err("name")}</span>}
        </label>
        <label className="block space-y-1 text-sm font-semibold">
          {t.form.phone}
          <input id="phone" name="phone" type="tel" inputMode="tel" dir="ltr" placeholder="0555 12 34 56" className={`${field} text-start`} />
          {err("phone") && <span className="text-xs text-red-600">{err("phone")}</span>}
        </label>
        <label className="block space-y-1 text-sm font-semibold">
          {t.form.wilaya}
          <select id="wilaya" name="wilaya" value={wilaya ?? ""} onChange={(ev) => setWilaya(Number(ev.target.value) || null)} className={field}>
            <option value="">{t.form.chooseWilaya}</option>
            {wilayas.map((w) => (
              <option key={w.code} value={w.code}>
                {w.name}
              </option>
            ))}
          </select>
          {err("wilaya") && <span className="text-xs text-red-600">{err("wilaya")}</span>}
        </label>
        <label className="block space-y-1 text-sm font-semibold">
          {t.form.commune}
          <CommuneSelect key={wilaya ?? 0} wilaya={wilaya} arabic={arabic} className={field} invalid={Boolean(err("commune"))} placeholder={t.form.communePlaceholder} choose={t.form.chooseCommune} chooseWilayaFirst={t.summary.chooseWilayaFirst} />
          {err("commune") && <span className="text-xs text-red-600">{err("commune")}</span>}
        </label>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-semibold">{t.form.deliveryType}</legend>
          {(["home", "office"] as const).map((type) => {
            const price = wilaya ? shippingPrice(rates, wilaya, type) : 0;
            return (
              <label key={type} className={`flex items-center gap-2 rounded-[var(--s-radius-btn)] border p-3 text-sm ${deliveryType === type ? "border-brand" : "border-s-field-edge"} ${price === null ? "opacity-50" : ""}`}>
                <input type="radio" name="deliveryType" value={type} checked={deliveryType === type} disabled={price === null} onChange={() => setDeliveryType(type)} className="accent-[var(--brand)]" />
                <span className="flex-1">{type === "home" ? t.form.home : t.form.office}</span>
                {wilaya && price !== null && <span className="font-semibold">{price === 0 ? t.summary.free : formatPrice(price, currency)}</span>}
              </label>
            );
          })}
        </fieldset>
        {deliveryType === "home" && (
          <label className="block space-y-1 text-sm font-semibold">
            {t.form.address}
            <input name="address" placeholder={t.form.addressPlaceholder} className={field} />
          </label>
        )}
        <label className="block space-y-1 text-sm font-semibold">
          {t.form.note}
          <input name="note" className={field} />
        </label>
        <dl className="space-y-1 border-t border-s-edge pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-s-muted">{t.summary.product}</dt>
            <dd className="font-semibold">{formatPrice(subtotal, currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-s-muted">{t.summary.shipping}</dt>
            <dd className="font-semibold">{shipping === null ? "—" : shipping === 0 ? t.summary.free : formatPrice(shipping, currency)}</dd>
          </div>
          <div className="flex justify-between text-lg">
            <dt className="font-bold">{t.summary.total}</dt>
            <dd className="font-extrabold text-brand-ink" data-testid="cart-total">
              {formatPrice(subtotal + (shipping ?? 0), currency)}
            </dd>
          </div>
        </dl>
        {cardPayment && <PaymentChoice t={t} />}
        {state.error && state.error !== "checkFields" && <p className="text-sm font-semibold text-red-600">{(t.errors as Record<string, string>)[state.error] ?? t.errors.invalid}</p>}
        <button type="submit" disabled={pending || !ok.length} className="flex h-14 w-full items-center justify-center gap-2 rounded-[var(--s-radius-btn)] bg-brand text-lg font-extrabold text-brand-fg disabled:opacity-60" data-testid="cart-submit">
          {pending ? <LoaderCircle className="animate-spin" size={20} /> : <ShoppingBag size={20} />} {pending ? t.form.sending : t.cart.order}
        </button>
      </form>
    </div>
  );
}
