// Promotions (Apps → Promotions): pure price math, shared by the server and the dashboard preview.
import type { QuantityOffer } from "@/server/db/schema";

// Prices are whole dinars
export const discounted = (price: number, percent: number) => Math.max(1, Math.round((price * (100 - percent)) / 100));

// A product while a promotion runs: every price lowered (unit, variants, quantity offers) and the old price shown
// struck through (the merchant's own "old price" when it is higher).
export function promoted<P extends { price: number; compareAtPrice: number | null; offers?: QuantityOffer[]; variants?: { price: number | null }[]; wholesale?: unknown }>(product: P, percent: number | undefined): P {
  if (!percent) return product;
  const w = product.wholesale as { tiers?: { price: number }[] } | null | undefined;
  return {
    ...product,
    ...(w && Array.isArray(w.tiers) ? { wholesale: { ...w, tiers: w.tiers.map((t) => ({ ...t, price: typeof t.price === "number" ? discounted(t.price, percent) : t.price })) } } : {}),
    price: discounted(product.price, percent),
    compareAtPrice: Math.max(product.compareAtPrice ?? 0, product.price),
    offers: product.offers?.map((o) => ({ ...o, price: discounted(o.price, percent) })),
    variants: product.variants?.map((v) => ({ ...v, price: v.price === null ? null : discounted(v.price, percent) })),
  };
}

// The biggest running percentage per product
export function bestPercents(promotions: { percent: number; productIds: string[] }[]) {
  const out = new Map<string, number>();
  for (const p of promotions) for (const id of p.productIds) out.set(id, Math.max(out.get(id) ?? 0, p.percent));
  return out;
}

// Algeria has no daylight saving: local time = UTC+1
export const fromAlgeriaLocal = (value: string) => (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? new Date(`${value}:00+01:00`) : null);
export const toAlgeriaLocal = (d: Date) => new Date(d.getTime() + 3600_000).toISOString().slice(0, 16);
