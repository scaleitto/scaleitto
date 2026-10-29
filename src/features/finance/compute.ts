// Pure finance math (unit-tested). Sales and profit count delivered orders of the period (by order date, like
// Analytics). Shipping fees go to the courier, so profit counts the products only:
// net profit = delivered products − their cost − the period's expenses.
import type { ExpenseCategory } from "@/server/db/schema";

export type FinanceOrder = { id: string; status: string; subtotal: number; shippingPrice: number; total: number; paidAt: Date | null };
export type FinanceItem = { orderId: string; quantity: number; costPrice: number | null };
export type FinanceExpense = { category: ExpenseCategory; amount: number };

export function computeFinance(orders: FinanceOrder[], items: FinanceItem[], expenses: FinanceExpense[]) {
  const delivered = orders.filter((o) => o.status === "delivered");
  const ids = new Set(delivered.map((o) => o.id));
  let cost = 0;
  let costMissing = false;
  for (const i of items) {
    if (!ids.has(i.orderId)) continue;
    if (i.costPrice == null) costMissing = true;
    else cost += i.costPrice * i.quantity;
  }
  const sales = delivered.reduce((s, o) => s + o.subtotal, 0);
  const cashIn = delivered.reduce((s, o) => s + o.total, 0);
  const shipping = delivered.reduce((s, o) => s + o.shippingPrice, 0);
  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const byCategory = new Map<ExpenseCategory, number>();
  for (const e of expenses) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
  const net = sales - cost - spent;
  return {
    delivered: delivered.length,
    sales,
    cashIn,
    shipping,
    cost,
    costMissing,
    expenses: spent,
    gross: sales - cost,
    net,
    margin: sales > 0 ? Math.round((net / sales) * 1000) / 10 : null,
    perOrder: delivered.length ? Math.round(net / delivered.length) : null,
    // What was spent to get one delivered order (ads, packaging…)
    costPerDelivered: delivered.length ? Math.round(spent / delivered.length) : null,
    categories: [...byCategory.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
  };
}

export type Finance = ReturnType<typeof computeFinance>;
