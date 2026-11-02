import type { DeliveryType, QuantityOffer } from "@/server/db/schema";

// Most pieces of one product in one order
export const MAX_QUANTITY = 20;

export type RateMap = Record<number, { home: number | null; office: number | null }>;

// Price of one order line: a quantity offer replaces "unit price × quantity".
export function linePrice(unitPrice: number, quantity: number, offers: QuantityOffer[]) {
  const offer = offers.find((o) => o.quantity === quantity) ?? null;
  return { unitPrice, quantity, total: offer ? offer.price : unitPrice * quantity, offer };
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
