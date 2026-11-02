import { orderStatuses, type OrderStatus } from "@/server/db/schema";

export { orderStatuses, type OrderStatus };
export const isOrderStatus = (v: unknown): v is OrderStatus => orderStatuses.includes(v as OrderStatus);

// The status model (Zimam's), in one place: every list of statuses elsewhere comes from here.
// The orders page tabs, in their order (call back is reached from the pending tab's status menu)
export const statusTabs = ["pending", "confirmed", "in_transit", "delivered", "returned", "abandoned", "cancelled", "flagged"] as const satisfies readonly OrderStatus[];
// Still to confirm: the call center works on these
export const PENDING_STATUSES = ["pending", "call_back"] as const satisfies readonly OrderStatus[];
// Refused at confirmation: the pieces go back to the stock (abandoned orders never took any)
export const REJECTED_STATUSES = ["cancelled", "flagged", "abandoned"] as const satisfies readonly OrderStatus[];
// Refusals that count against the confirmation rate
export const REFUSED_STATUSES = ["cancelled", "flagged"] as const satisfies readonly OrderStatus[];
// Confirmed, whatever happened to the parcel after
export const CONFIRMED_STATUSES = ["confirmed", "in_transit", "delivered", "returned"] as const satisfies readonly OrderStatus[];
// The parcel's life (set by sending, scanning and tracking)
export const PARCEL_STATUSES = ["in_transit", "delivered", "returned"] as const satisfies readonly OrderStatus[];

const among = (list: readonly OrderStatus[]) => (s: OrderStatus) => list.includes(s);
export const isPending = among(PENDING_STATUSES);
export const isRejected = among(REJECTED_STATUSES);
export const isConfirmed = among(CONFIRMED_STATUSES);

// Badge and tab colors per status (tokens of globals.css)
export const statusTone: Record<OrderStatus, "violet" | "accent" | "warning" | "info" | "danger" | "neutral" | "orange"> = {
  pending: "violet",
  confirmed: "accent",
  call_back: "info",
  in_transit: "info",
  delivered: "accent",
  returned: "danger",
  abandoned: "orange",
  cancelled: "neutral",
  flagged: "danger",
};

// Refused, abandoned and returned orders give their pieces back to the stock.
export const holdsStock = (status: OrderStatus) => !isRejected(status) && status !== "returned";

// The status pill of the orders table (literal classes for Tailwind)
export const statusPill: Record<OrderStatus, string> = {
  pending: "bg-violet-soft text-violet",
  confirmed: "bg-accent-soft text-accent-ink",
  call_back: "bg-info-soft text-info",
  in_transit: "bg-info-soft text-info",
  delivered: "bg-accent text-accent-fg",
  returned: "bg-danger-soft text-danger",
  abandoned: "bg-warning-soft text-warning",
  cancelled: "bg-panel-2 text-muted",
  flagged: "bg-danger text-white",
};
