import { onlineMethods, type OnlineMethod } from "@/features/payments/methods";
import { isOrderStatus, statusTabs, type OrderStatus } from "./statuses";

// The orders page's filters, read from the address bar: the status tab, the search box and the filter dialog
// (product, agent, payment, wilaya, dates).
export type OrderFilters = {
  status: OrderStatus;
  q: string;
  product?: string;
  // a member's id, "none" (nobody) or "me"
  agent?: string;
  wilaya?: number;
  from?: string;
  to?: string;
  // Apps → WhatsApp confirmation: the buyer's answer
  wa?: "waiting" | "confirmed" | "cancelled";
  // cash on delivery / card
  payment?: "cod" | OnlineMethod;
  page: number;
  size: number;
};

export const pageSizes = [25, 50, 100] as const;
const day = /^\d{4}-\d{2}-\d{2}$/;

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseOrderFilters(sp: Search): OrderFilters {
  const status = one(sp.status);
  const wilaya = Number(one(sp.wilaya));
  const size = Number(one(sp.size));
  return {
    status: isOrderStatus(status) ? status : statusTabs[0],
    q: one(sp.q).trim().slice(0, 100),
    product: one(sp.product) || undefined,
    agent: one(sp.agent) || undefined,
    wilaya: Number.isInteger(wilaya) && wilaya > 0 ? wilaya : undefined,
    from: day.test(one(sp.from)) ? one(sp.from) : undefined,
    to: day.test(one(sp.to)) ? one(sp.to) : undefined,
    wa: (["waiting", "confirmed", "cancelled"] as const).find((x) => x === one(sp.wa)),
    payment: (["cod", ...onlineMethods] as const).find((x) => x === one(sp.payment)),
    page: Math.max(1, Number(one(sp.page)) || 1),
    size: (pageSizes as readonly number[]).includes(size) ? size : pageSizes[0],
  };
}

// The address of the same list with some filters changed (defaults left out)
export function filtersHref(base: string, f: OrderFilters, patch: Partial<Record<keyof OrderFilters, string | number | undefined>>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...patch })) {
    if (v === undefined || v === "" || (k === "page" && v === 1) || (k === "size" && v === pageSizes[0]) || (k === "status" && v === statusTabs[0])) continue;
    params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `${base}?${s}` : base;
}
