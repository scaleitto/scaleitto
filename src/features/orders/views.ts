import type { OrderStatus } from "./statuses";

// The Orders section's sub-sections, in the order of an order's life: confirm it, ship it, follow the parcel, done.
// "risk" = orders still to confirm whose fake-order risk is at or above the store's threshold.
export const orderViews = ["all", "confirm", "ship", "transit", "done", "risk"] as const;
export type OrderView = (typeof orderViews)[number];
export const isOrderView = (v: unknown): v is OrderView => orderViews.includes(v as OrderView);

export const viewStatuses: Record<OrderView, OrderStatus[] | null> = {
  all: null,
  confirm: ["new", "no_answer", "postponed"],
  ship: ["confirmed"],
  transit: ["shipped"],
  done: ["delivered", "returned", "cancelled"],
  risk: ["new", "no_answer", "postponed"],
};

// Rows per page the merchant can choose (bigger pages for bulk sending)
export const pageSizes = [25, 50, 100, 200] as const;

// Filters of the orders list, read from the address bar
export type OrderFilters = {
  view: OrderView;
  q: string;
  status?: OrderStatus;
  stage?: string;
  wilaya?: number;
  delivery?: "home" | "office";
  from?: string;
  to?: string;
  assignee?: string;
  page: number;
  size: number;
};
