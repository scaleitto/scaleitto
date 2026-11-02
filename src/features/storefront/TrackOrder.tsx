import { Check, MessageCircle, Package, Phone, Truck, X } from "lucide-react";
import type { StoreText } from "@/i18n/store";
import { fmt, formatDate, formatPrice } from "@/lib/format";
import { wilayaName } from "@/lib/wilayas";
import { intlPhone } from "@/lib/phone";
import type { TrackedOrder } from "./tracking";

// Where an order is on its way: received → confirmed → on its way → delivered (or stopped: cancelled / returned)
const stepOf: Record<string, number> = { pending: 0, call_back: 0, confirmed: 1, in_transit: 2, delivered: 3 };

export function TrackedOrderCard({ order, locale, currency, t }: { order: TrackedOrder; locale: string; currency: string; t: StoreText }) {
  const tr = t.track;
  const stopped = order.status === "cancelled" || order.status === "returned" ? order.status : null;
  const reached = stepOf[order.status] ?? (order.status === "returned" ? 2 : 0);
  const steps = [tr.steps.placed, tr.steps.confirmed, tr.steps.shipped, tr.steps.delivered];
  return (
    <article className="space-y-5 rounded-[var(--s-radius)] border border-s-card-border bg-s-surface p-5 shadow-[var(--s-shadow)]" data-tracked-order={order.number} data-status={order.status}>
      <header>
        <p className="font-extrabold">{fmt(tr.placedOn, { n: order.number, date: formatDate(order.createdAt, locale) })}</p>
        {order.customerName && <p className="text-sm text-s-muted">{fmt(tr.hello, { name: order.customerName })}</p>}
      </header>
      <ol className="space-y-0">
        {steps.map((label, i) => {
          const done = !stopped && i <= reached;
          const current = !stopped && i === reached;
          return (
            <li key={label} className="relative flex gap-3 pb-5 last:pb-0" data-step={i} data-done={done ? "1" : "0"}>
              {i < steps.length - 1 && <span aria-hidden className={`absolute start-[0.9rem] top-8 h-[calc(100%-2rem)] w-0.5 ${!stopped && i < reached ? "bg-brand" : "bg-s-edge"}`} />}
              <span className={`relative grid size-7.5 shrink-0 place-items-center rounded-full border-2 ${done ? "border-brand bg-brand text-brand-fg" : "border-s-edge bg-s-surface text-s-muted"}`}>
                {done ? <Check size={15} strokeWidth={3} /> : i === 2 ? <Truck size={14} /> : <Package size={14} />}
              </span>
              <span className={`pt-1 text-sm ${current ? "font-extrabold" : done ? "font-semibold" : "text-s-muted"}`}>{label}</span>
            </li>
          );
        })}
      </ol>
      {stopped && (
        <p className="flex items-center gap-2 rounded-[var(--s-radius)] bg-red-500/10 p-3 text-sm font-semibold text-red-600" data-testid="track-stopped">
          <X size={16} /> {tr.stopped[stopped]}
        </p>
      )}
      {!stopped && reached === 0 && <p className="text-sm text-s-muted">{tr.waiting}</p>}
      {order.shipment && (
        <dl className="grid grid-cols-2 gap-2 rounded-[var(--s-radius)] bg-s-bg p-3 text-sm">
          <dt className="text-s-muted">{tr.courier}</dt>
          <dd className="font-semibold">{order.shipment.carrierName}</dd>
          <dt className="text-s-muted">{tr.trackingNumber}</dt>
          <dd className="font-semibold" dir="ltr">
            {order.shipment.trackingNumber}
          </dd>
        </dl>
      )}
      <div className="space-y-2 border-t border-s-edge pt-4 text-sm">
        {order.items.map((item, i) => (
          <p key={i} className="flex justify-between gap-3">
            <span>
              {item.name}
              {item.variantTitle && <span className="text-s-muted"> · {item.variantTitle}</span>} ×{item.quantity}
            </span>
            <span className="font-semibold whitespace-nowrap">{formatPrice(item.total, currency)}</span>
          </p>
        ))}
        <p className="flex justify-between text-s-muted">
          <span>
            {order.deliveryType === "office" ? tr.delivery.office : tr.delivery.home} — {wilayaName(order.wilayaCode, locale)}
            {order.commune ? `، ${order.commune}` : ""}
          </span>
          <span>{order.shippingPrice === 0 ? t.summary.free : formatPrice(order.shippingPrice, currency)}</span>
        </p>
        <p className="flex justify-between border-t border-s-edge pt-2 text-base">
          <span className="font-bold">{t.summary.total}</span>
          <span className="font-extrabold text-brand-ink">{formatPrice(order.total, currency)}</span>
        </p>
      </div>
    </article>
  );
}

export function TrackContact({ contact, t }: { contact: { kind: "whatsapp" | "phone"; number: string } | null; t: StoreText }) {
  if (!contact) return null;
  const href = contact.kind === "whatsapp" ? `https://wa.me/${intlPhone(contact.number)}` : `tel:${contact.number.replace(/\s+/g, "")}`;
  return (
    <a href={href} target={contact.kind === "whatsapp" ? "_blank" : undefined} rel="noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-[var(--s-radius-btn)] border-2 border-brand font-bold text-brand-ink" data-testid="track-contact">
      {contact.kind === "whatsapp" ? <MessageCircle size={18} /> : <Phone size={18} />} {t.track.contact[contact.kind]}
    </a>
  );
}
