// Refer a seller: the referred store's first payment gets this share off (pure, shared with the Plans page)
export const REFERRED_DISCOUNT = 0.1;
export type DiscountPreview = { firstPayment: boolean; voucherValue: number | null };

// The same arithmetic as referrals.ts referralDiscount, for the amount shown before sending a request
export function previewDiscount(p: DiscountPreview, priceMonthly: number, amount: number) {
  const off = (p.firstPayment ? Math.round(amount * REFERRED_DISCOUNT) : 0) + (p.voucherValue !== null ? Math.floor(Math.min(p.voucherValue, priceMonthly) / 2) : 0);
  return Math.min(off, amount);
}
