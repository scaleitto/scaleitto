import { orderStatuses, type OrderStatus } from "@/server/db/schema";

export { orderStatuses, type OrderStatus };
export const isOrderStatus = (v: unknown): v is OrderStatus => orderStatuses.includes(v as OrderStatus);

// The owner's status model, in one place. Every list of statuses elsewhere comes from here.
// Statut de la commande: what the confirmation call gave (the status picker and the orders list)
export const callStatuses = ["new", "confirmed", "callback", "no_answer", "voicemail", "remark", "cancelled", "fake", "wrong_number", "duplicate"] as const satisfies readonly OrderStatus[];
// Still to confirm: the call center works on these
export const PENDING_STATUSES = ["new", "callback", "no_answer", "voicemail", "remark"] as const satisfies readonly OrderStatus[];
// Refused at confirmation: the pieces go back to the stock
export const REJECTED_STATUSES = ["cancelled", "fake", "wrong_number", "duplicate"] as const satisfies readonly OrderStatus[];
// Refusals that count against the confirmation rate (a duplicate is the same customer's other order, not a refusal)
export const REFUSED_STATUSES = ["cancelled", "fake", "wrong_number"] as const satisfies readonly OrderStatus[];
// Confirmed, whatever happened to the parcel after
export const CONFIRMED_STATUSES = ["confirmed", "shipped", "delivered", "returned"] as const satisfies readonly OrderStatus[];
// The parcel's life: these come from sending and tracking (Livraison finale = delivered / returned)
export const PARCEL_STATUSES = ["shipped", "delivered", "returned"] as const satisfies readonly OrderStatus[];

const among = (list: readonly OrderStatus[]) => (s: OrderStatus) => list.includes(s);
export const isPending = among(PENDING_STATUSES);
export const isRejected = among(REJECTED_STATUSES);
export const isConfirmed = among(CONFIRMED_STATUSES);

// Badge colors per status in the dashboard
export const statusTone: Record<OrderStatus, "neutral" | "accent" | "warning" | "danger" | "info"> = {
  new: "info",
  confirmed: "accent",
  callback: "warning",
  no_answer: "warning",
  voicemail: "warning",
  remark: "neutral",
  cancelled: "danger",
  fake: "danger",
  wrong_number: "danger",
  duplicate: "neutral",
  shipped: "info",
  delivered: "accent",
  returned: "danger",
};

// Refused and returned orders give their pieces back to the stock.
export const holdsStock = (status: OrderStatus) => !isRejected(status) && status !== "returned";
