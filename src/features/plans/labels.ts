// How a plan's price, period and order limit read (shared by the Plans page, the admin and the homepage).
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt, formatPrice } from "@/lib/format";
import type { LimitKey } from "@/lib/enums";

type PlanText = Pick<Dictionary, "plans" | "common">;
export type PricedPlan = { priceMonthly: number; orderPack: number | null };

// "Free", "3 500 DA / month" or "1 800 DA for 100 orders"
export function priceLabel(plan: PricedPlan, t: PlanText) {
  if (!plan.priceMonthly) return t.plans.free;
  const price = formatPrice(plan.priceMonthly, t.common.currency);
  return plan.orderPack ? fmt(t.plans.perPack, { price, n: plan.orderPack }) : fmt(t.plans.perMonth, { price });
}

// The same price in two parts for the plan cards: the amount, and "per month" / "for 100 orders — no expiry"
export function priceParts(plan: PricedPlan, t: PlanText) {
  if (!plan.priceMonthly) return { amount: t.plans.free, note: "" };
  return { amount: formatPrice(plan.priceMonthly, t.common.currency), note: plan.orderPack ? fmt(t.plans.packNote, { n: plan.orderPack }) : t.plans.monthly };
}

// What a request buys: "3 months" or "2 × 100 orders"
export function periodLabel(n: number, orderPack: number | null, t: PlanText) {
  return orderPack ? fmt(t.plans.request.packsOption, { n, size: orderPack }) : fmt(t.plans.request.monthsOption, { n });
}

// One line of a plan card: "1 800 orders / month", "Unlimited products", or "Pay as you go" for a pay-as-you-go plan's orders
export function limitLine(plan: PricedPlan & { limits: Partial<Record<LimitKey, number | null>> }, key: LimitKey, t: PlanText) {
  if (key === "maxOrdersPerMonth" && plan.orderPack) return { value: "", label: t.plans.payg };
  const n = plan.limits[key] ?? 0;
  return { value: n === -1 ? t.common.unlimited : n.toLocaleString("fr-FR"), label: t.plans.planLimits[key] };
}
