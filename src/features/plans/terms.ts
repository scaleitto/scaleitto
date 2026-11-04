// Plans → prepaid term (Zimam): 1, 3, 6 or 12 months, longer terms cheaper. Pure: the Plans page and the server use it.
export const PERIODS = [1, 3, 6, 12] as const;
const DISCOUNTS: Record<number, number> = { 1: 0, 3: 5, 6: 10, 12: 25 };
export const termDiscount = (months: number) => DISCOUNTS[months] ?? 0;

// What a request costs before any referral discount: the monthly price × months, minus the term's discount (packs: no discount)
export function planAmount(plan: { priceMonthly: number; orderPack: number | null }, months: number) {
  const gross = plan.priceMonthly * months;
  return plan.orderPack ? gross : Math.round((gross * (100 - termDiscount(months))) / 100);
}
