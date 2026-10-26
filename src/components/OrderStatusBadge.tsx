import type { OrderStatus } from "@/db/schema";

const styles: Record<OrderStatus, string> = {
  new: "bg-blue-100 text-blue-700",
  confirmed: "bg-indigo-100 text-indigo-700",
  shipped: "bg-amber-100 text-amber-800",
  delivered: "bg-green-100 text-green-700",
  returned: "bg-orange-100 text-orange-700",
  cancelled: "bg-slate-200 text-slate-600",
};

export function OrderStatusBadge({ status, label }: { status: OrderStatus; label: string }) {
  return <span className={`badge ${styles[status]}`}>{label}</span>;
}
