import type { DeliveryType, QuantityOffer } from "@/server/db/schema";

// Most pieces of one product in one order
export const MAX_QUANTITY = 20;

export type RateMap = Record<number, { home: number | null; office: number | null }>;

// Price of one order line: a quantity offer replaces "unit price × quantity".
export function linePrice(unitPrice: number, quantity: number, offers: QuantityOffer[]) {
  const offer = offers.find((o) => o.quantity === quantity) ?? null;
  return { unitPrice, quantity, total: offer ? offer.price : unitPrice * quantity, offer };
}

// Delivery price for a wilaya. A shop without any rate delivers free everywhere;
// otherwise a missing rate means that wilaya/type is not delivered (null).
export function shippingPrice(rates: RateMap, wilayaCode: number, type: DeliveryType): number | null {
  if (Object.keys(rates).length === 0) return 0;
  const rate = rates[wilayaCode];
  return (type === "home" ? rate?.home : rate?.office) ?? null;
}
