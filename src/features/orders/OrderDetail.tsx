import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { sectionHref } from "@/lib/permissions";
import { fmt, formatDate, formatPrice } from "@/lib/format";
import { wilayaName, wilayas } from "@/lib/wilayas";
import { Alert, Badge, Card, PageHeader, buttonClass } from "@/ui";
import { addOrderNote, updateOrderCustomer } from "./actions";
import { AssignCard, CustomerCard, NoteForm, PhoneBlockButton, StatusPicker, type OrderText } from "./OrderPanels";
import type { OrderDetail as Order } from "./queries";
import { isOrderStatus, statusTone } from "./statuses";
import { ShipmentCard } from "@/features/delivery/ShipmentCard";
import { findCarrier } from "@/features/delivery/carriers";
import type { CarrierAccountRow } from "@/features/delivery/queries";
import type { schema } from "@/server/db";
import { MessageCard } from "@/features/messages/MessageCard";
import { resolveMessages, suggestedKind, type MessageVars } from "@/features/messages/templates";
import { CallGuideCard } from "@/features/ai/CallGuideCard";

export function OrderDetail({
  lang,
  t,
  order,
  shipment,
  accounts,
  canManageDelivery,
  members,
  shop,
}: {
  lang: string;
  t: Dictionary;
  order: Order;
  shipment: typeof schema.shipments.$inferSelect | null;
  accounts: CarrierAccountRow[];
  canManageDelivery: boolean;
  // Team members the order can be given to (managers only; empty for agents)
  members: { userId: string; name: string }[];
  shop: { name: string; phone: string | null; messages: unknown };
}) {
  const o = t.orders;
  const text: OrderText = { orders: t.orders, errors: t.errors, common: t.common };
  const cur = t.common.currency;
  const statusLabel = (s: string | null) => (s && isOrderStatus(s) ? o.statuses[s] : (s ?? ""));
  // Customer messages in the shop's chosen language, filled with this order
  const messages = resolveMessages(shop.messages);
  const arabic = messages.language === "ar" || messages.language === "dz";
  const messageVars: MessageVars = {
    name: order.customerName,
    order: String(order.number),
    product: order.items.map((i) => `${i.name}${i.variantTitle ? ` (${i.variantTitle})` : ""}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`).join("، "),
    total: formatPrice(order.total, arabic ? "د.ج" : "DA"),
    wilaya: wilayaName(order.wilayaCode, arabic ? "ar" : "fr").replace(/^\d+ - /, ""),
    store: shop.name,
    storePhone: shop.phone ?? "",
    tracking: shipment?.trackingNumber ?? "",
  };

  return (
    <>
      <PageHeader
        title={fmt(o.title, { number: order.number })}
        description={formatDate(order.createdAt, lang)}
        actions={
          <>
            <Badge tone={statusTone[order.status]}>{o.statuses[order.status]}</Badge>
            <Link href={sectionHref(lang, "orders")} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-sm text-muted hover:bg-panel-2 hover:text-fg">
              <ArrowRight size={16} className="ltr:rotate-180" /> {t.common.back}
            </Link>
          </>
        }
      />
      {order.locked && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4" data-testid="order-locked">
          <Lock size={20} className="shrink-0 text-warning" />
          <div className="me-auto">
            <p className="font-semibold">{o.locked.title}</p>
            <p className="text-sm text-muted">{o.locked.body}</p>
          </div>
          <Link href={sectionHref(lang, "plans")} className={buttonClass("primary")}>
            {o.locked.upgrade}
          </Link>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* A locked order (over the plan's limit) can only be looked at: no actions, no customer details */}
          {!order.locked && <StatusPicker lang={lang} orderId={order.id} status={order.status} t={text} />}
          {!order.locked && <ShipmentCard
            lang={lang}
            orderId={order.id}
            orderStatus={order.status}
            shipment={
              shipment && {
                carrierName: shipment.carrierName,
                trackingNumber: shipment.trackingNumber,
                labelUrl: shipment.labelUrl,
                status: shipment.status,
                rawStatus: shipment.rawStatus,
                checkedAt: shipment.checkedAt ? formatDate(shipment.checkedAt, lang) : null,
                fromCarrier: Boolean(shipment.carrierAccountId),
              }
            }
            accounts={accounts.map((a) => ({ id: a.id, name: findCarrier(a.carrier)?.name ?? a.carrier, isDefault: a.isDefault }))}
            deliveryHref={canManageDelivery ? sectionHref(lang, "delivery") : null}
            t={{ delivery: t.delivery, errors: t.errors, common: t.common }}
          />}
          {!order.locked && <CustomerCard
            customer={{
              customerName: order.customerName,
              phone: order.phone,
              wilayaCode: order.wilayaCode,
              commune: order.commune,
              address: order.address,
              deliveryType: order.deliveryType,
              shippingPrice: order.shippingPrice,
            }}
            wilayaLabel={wilayaName(order.wilayaCode, lang)}
            wilayas={wilayas.map((w) => ({ code: w.code, name: wilayaName(w.code, lang) }))}
            t={text}
            action={updateOrderCustomer.bind(null, lang, order.id)}
          />}
          <Card className="space-y-3">
            <h2 className="font-semibold">{o.items}</h2>
            <ul className="divide-y divide-line">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3 py-2.5 text-sm">
                  <span>
                    <span className="font-semibold">{item.name}</span>
                    {item.variantTitle && <span className="text-muted"> · {item.variantTitle}</span>}
                    <span className="text-muted"> {fmt(o.quantityShort, { n: item.quantity })}</span>
                    {item.offerLabel && <Badge tone="warning">{item.offerLabel}</Badge>}
                    {item.sku && (
                      <span className="block text-xs text-muted" dir="ltr">
                        {item.sku}
                      </span>
                    )}
                  </span>
                  <span className="font-semibold whitespace-nowrap">{formatPrice(item.total, cur)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-line pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">{o.subtotal}</dt>
                <dd>{formatPrice(order.subtotal, cur)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{o.shipping}</dt>
                <dd>{formatPrice(order.shippingPrice, cur)}</dd>
              </div>
              <div className="flex justify-between text-base font-bold">
                <dt>{o.total}</dt>
                <dd data-testid="order-total">{formatPrice(order.total, cur)}</dd>
              </div>
            </dl>
            {order.customerNote && (
              <Alert variant="info">
                <span className="font-semibold">{o.customerNote}: </span>
                {order.customerNote}
              </Alert>
            )}
          </Card>
          {(order.extra.length > 0 || order.landingTitle) && (
            <Card className="space-y-3" data-testid="order-extra">
              <h2 className="font-semibold">{o.extraFields}</h2>
              <dl className="space-y-1.5 text-sm">
                {order.landingTitle && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">{o.fromLanding}</dt>
                    <dd className="font-semibold">{order.landingTitle}</dd>
                  </div>
                )}
                {order.extra.map((x, i) => (
                  <div key={i} className="flex justify-between gap-3">
                    <dt className="text-muted">{x.label}</dt>
                    <dd className="font-semibold">{x.value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
          {!order.locked && order.guides.map((g) => <CallGuideCard key={g.product.id} lang={lang} product={g.product} guide={g.guide} t={{ assistant: t.assistant, errors: t.errors, landingPages: t.landingPages }} />)}
        </div>

        <div className="space-y-6">
          {!order.locked && <MessageCard lang={lang} orderId={order.id} phone={order.phone} texts={messages.texts} vars={messageVars} initialKind={suggestedKind(order.status)} t={t.assistant} />}
          {!order.locked && <AssignCard lang={lang} orderId={order.id} assignedTo={order.assignedTo} assigneeName={order.assigneeName} members={members} t={text} />}
          {!order.locked && <Card className="space-y-3" data-testid="phone-history">
            <h2 className="font-semibold">{o.phoneHistory}</h2>
            {order.phoneStats.orders <= 1 ? (
              <p className="text-sm text-muted">{o.firstOrder}</p>
            ) : (
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge>{fmt(o.phoneOrders, { n: order.phoneStats.orders })}</Badge>
                <Badge tone="accent">{fmt(o.phoneDelivered, { n: order.phoneStats.delivered })}</Badge>
                {order.phoneStats.failed > 0 && <Badge tone="danger">{fmt(o.phoneFailed, { n: order.phoneStats.failed })}</Badge>}
              </div>
            )}
            {order.phoneBlocked && <Alert>{o.blocked}</Alert>}
            <PhoneBlockButton lang={lang} phone={order.phone} blocked={order.phoneBlocked} t={text} />
          </Card>}

          <Card className="space-y-4">
            <h2 className="font-semibold">{o.history}</h2>
            <ol className="space-y-3 border-s border-line ps-4 text-sm" data-testid="history">
              {order.events.map(({ event, userName }) => (
                <li key={event.id} className="relative">
                  <span className="absolute -start-[1.3rem] top-1.5 size-2 rounded-full bg-accent" />
                  <p className="font-medium">
                    {event.type === "status"
                      ? fmt(o.events.status, { from: statusLabel(event.fromStatus), to: statusLabel(event.toStatus) })
                      : event.type === "assign"
                        ? event.note
                          ? fmt(o.events.assign, { name: event.note })
                          : o.events.unassign
                        : o.events[event.type]}
                  </p>
                  {event.note && event.type !== "assign" && <p className="mt-0.5 whitespace-pre-line text-fg/90">{event.note}</p>}
                  <p className="text-xs text-muted">
                    <bdi>{userName ?? (event.type === "assign" ? o.bySystem : o.byCustomer)}</bdi> · <bdi>{formatDate(event.createdAt, lang)}</bdi>
                  </p>
                </li>
              ))}
            </ol>
            {!order.locked && <NoteForm t={text} action={addOrderNote.bind(null, lang, order.id)} />}
          </Card>
        </div>
      </div>
    </>
  );
}
