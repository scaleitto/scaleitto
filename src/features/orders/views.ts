import type { OrderStatus } from "./statuses";

// The order lists of the Orders section. The list page shows all / confirm / risk / done as chips; "ship", "transit" and
// "returns" are their own sub-sections (Send to couriers, Parcel tracking, Returns).
// "risk" = orders still to confirm whose fake-order risk is at or above the store's threshold.
// "returns" = returned orders and parcels on their way back.
export const orderViews = ["all", "confirm", "ship", "transit", "done", "risk", "returns"] as const;
export const listViews = ["all", "confirm", "risk", "done"] as const;
// Returns sub-section filter: on the way back, back at the courier (to collect), received
export const returnStates = ["back", "pending", "received"] as const;
export type ReturnState = (typeof returnStates)[number];
export type OrderView = (typeof orderViews)[number];
export const isOrderView = (v: unknown): v is OrderView => orderViews.includes(v as OrderView);

export const viewStatuses: Record<OrderView, OrderStatus[] | null> = {
  all: null,
  confirm: ["new", "no_answer", "postponed"],
  ship: ["confirmed"],
  transit: ["shipped"],
  done: ["delivered", "returned", "cancelled"],
  risk: ["new", "no_answer", "postponed"],
  returns: null,
};

// Rows per page the merchant can choose (bigger pages for bulk sending)
export const pageSizes = [25, 50, 100, 200] as const;

// Filters of the orders list, read from the address bar
export type OrderFilters = {
  view: OrderView;
  q: string;
  status?: OrderStatus;
  stage?: string;
  ret?: ReturnState;
  wilaya?: number;
  delivery?: "home" | "office";
  from?: string;
  to?: string;
  assignee?: string;
  page: number;
  size: number;
};
