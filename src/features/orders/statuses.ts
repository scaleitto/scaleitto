import { orderStatuses, type OrderStatus } from "@/server/db/schema";

export { orderStatuses, type OrderStatus };
export const isOrderStatus = (v: unknown): v is OrderStatus => orderStatuses.includes(v as OrderStatus);

// Badge colors per status in the dashboard
export const statusTone: Record<OrderStatus, "neutral" | "accent" | "warning" | "danger" | "info"> = {
  new: "info",
  no_answer: "warning",
  postponed: "warning",
  confirmed: "accent",
  shipped: "info",
  delivered: "accent",
  returned: "danger",
  cancelled: "danger",
};

// Cancelled and returned orders give their pieces back to the stock.
export const holdsStock = (status: OrderStatus) => status !== "cancelled" && status !== "returned";
