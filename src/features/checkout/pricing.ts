import type { DeliveryType, QuantityOffer } from "@/server/db/schema";

// Most pieces of one product in one order
export const MAX_QUANTITY = 20;

export type RateMap = Record<number, { home: number | null; office: number | null }>;

// Apps → Wholesale: a minimum order quantity and price tiers (from N pieces, each piece costs P). The tier the quantity
// reaches sets the price of every piece. Larger quantities are allowed while it is on.
export type Wholesale = { minQty: number; tiers: { from: number; price: number }[] };
export const WHOLESALE_MAX_QUANTITY = 1000;
export const maxQuantityFor = (wholesale: Wholesale | null) => (wholesale ? WHOLESALE_MAX_QUANTITY : MAX_QUANTITY);

export function resolveWholesale(raw: unknown): Wholesale | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as { minQty?: unknown; tiers?: unknown };
  const n = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null);
  const tiers = (Array.isArray(r.tiers) ? r.tiers : [])
    .map((t) => ({ from: n((t as { from?: unknown })?.from, 2, WHOLESALE_MAX_QUANTITY), price: n((t as { price?: unknown })?.price, 1, 100_000_000) }))
    .filter((t): t is { from: number; price: number } => t.from !== null && t.price !== null)
    .sort((a, b) => a.from - b.from)
    .filter((t, i, all) => i === 0 || t.from !== all[i - 1].from)
    .slice(0, 10);
  const minQty = n(r.minQty, 1, WHOLESALE_MAX_QUANTITY) ?? 1;
  return tiers.length || minQty > 1 ? { minQty, tiers } : null;
}

// Price of one order line: a quantity offer replaces "unit price × quantity"; otherwise the wholesale tier reached
// sets the unit price.
export function linePrice(unitPrice: number, quantity: number, offers: QuantityOffer[], wholesale: Wholesale | null = null) {
  const offer = offers.find((o) => o.quantity === quantity) ?? null;
  if (offer) return { unitPrice, quantity, total: offer.price, offer };
  const tier = wholesale?.tiers.filter((t) => t.from <= quantity).at(-1);
  const unit = tier ? tier.price : unitPrice;
  return { unitPrice: unit, quantity, total: unit * quantity, offer: null };
}

// Delivery of the line: free when its offer says so (only where the store delivers at all)
export const lineShipping = (shipping: number | null, offer: QuantityOffer | null) => (shipping === null ? null : offer?.freeShipping ? 0 : shipping);

// The quantity chosen when the form opens: the merchant's preselected offer, else 1
export const defaultQuantity = (offers: QuantityOffer[]) => offers.find((o) => o.preselected)?.quantity ?? 1;

// Ready-made offers from the unit price (the product form's quick buttons): percent off, or "buy N, get M free"
export function offerTemplate(unitPrice: number, kind: "pct" | "free", quantity: number, value: number): QuantityOffer {
  const price = kind === "pct" ? Math.round((unitPrice * quantity * (100 - value)) / 100 / 10) * 10 : unitPrice * (quantity - value);
  return { quantity, price: Math.max(1, price) };
}

// Delivery price for a wilaya. A shop without any rate delivers free everywhere;
// otherwise a missing rate means that wilaya/type is not delivered (null).
export function shippingPrice(rates: RateMap, wilayaCode: number, type: DeliveryType): number | null {
  if (Object.keys(rates).length === 0) return 0;
  const rate = rates[wilayaCode];
  return (type === "home" ? rate?.home : rate?.office) ?? null;
}
