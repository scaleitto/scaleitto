import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getDictionary, type Locale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { fmt, formatDate, formatTime } from "@/lib/format";
import { storeUrl } from "@/lib/urls";
import { wilayaName, wilayas } from "@/lib/wilayas";
import { Alert, Badge, Card, PageHeader } from "@/ui";
import { getOrder, orderProducts } from "@/features/orders/queries";
import { OrderForm, LockedNotice } from "@/features/orders/OrderForm";
import { RiskCard } from "@/features/orders/RiskCard";
import { isOrderStatus, statusTone } from "@/features/orders/statuses";
import { viewerOf } from "@/features/orders/access";
import { getShipment, listCarrierAccounts } from "@/features/delivery/queries";
import { ShipmentCard } from "@/features/delivery/ShipmentCard";
import { findCarrier } from "@/features/delivery/carriers";
import { assignableMembers } from "@/features/team/queries";
import { releaseLockedOrders } from "@/features/plans/locked";
import { protectionFor } from "@/features/checkout/protection";
import { getShippingRates } from "@/features/storefront/queries";
import { whatsappConfig } from "@/features/messages/whatsapp";
import { MessageCard } from "@/features/messages/MessageCard";
import { buildMessageVars, resolveMessages, suggestedKind } from "@/features/messages/templates";
import { CallGuideCard } from "@/features/ai/CallGuideCard";

// One order (Zimam's edit dialog as a page): the form, then what the call center and the shipping need — the parcel,
// the customer messages, the call guide, the fake-order check and the history.
export async function OrderDetailPage({ lang, id, list }: { lang: Locale; id: string; list: string }) {
  const t = getDictionary(lang);
  const p = t.orderPage;
  const ctx = await requireSection(lang, "orders");
  const { shop, role } = ctx;
  await releaseLockedOrders(shop.id);
  const [order, shipment, accounts, members, whatsapp, protection, products, rates] = await Promise.all([
    getOrder(viewerOf(ctx), id),
    getShipment(shop.id, id),
    listCarrierAccounts(shop.id),
    role === "agent" ? Promise.resolve([]) : assignableMembers(shop.id),
    whatsappConfig(shop.id),
    protectionFor(shop.id),
    orderProducts(shop.id),
    getShippingRates(shop.id),
  ]);
  if (!order) notFound();
  const carrierAccounts = accounts.map((a) => ({ id: a.id, name: findCarrier(a.carrier)?.name ?? a.carrier, isDefault: a.isDefault, options: a.options }));
  const messages = resolveMessages(shop.messages);
  const statusLabel = (s: string | null) => (s && isOrderStatus(s) ? t.orders.statuses[s] : (s ?? ""));
  const o = t.orders;

  return (
    <>
      <PageHeader
        title={fmt(p.editTitle, { number: order.number })}
        description={`${formatDate(order.createdAt, lang)} · ${formatTime(order.createdAt, lang)}`}
        actions={
          <>
            <span data-testid="order-status" data-value={order.status}>
              <Badge tone={statusTone[order.status]}>{o.statuses[order.status]}</Badge>
            </span>
            <Link href={`${list}?status=${order.status === "call_back" ? "pending" : order.status}`} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-sm text-muted hover:bg-panel-2 hover:text-fg" data-testid="back-to-orders">
              <ArrowRight size={16} className="ltr:rotate-180" /> {t.common.back}
            </Link>
          </>
        }
      />
      {order.locked ? (
        <LockedNotice text={p.locked} upgrade={p.upgrade} href={sectionHref(lang, "plans")} />
      ) : (
        <div className="space-y-6">
          <Card>
            <OrderForm
              lang={lang}
              order={{
                id: order.id,
                number: order.number,
                status: order.status,
                items: order.items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity, unitPrice: i.unitPrice, name: i.name })),
                customerName: order.customerName,
                phone: order.phone,
                wilayaCode: order.wilayaCode,
                commune: order.commune,
                address: order.address,
                deliveryType: order.deliveryType,
                carrierAccountId: order.carrierAccountId,
                shippingWaived: order.shippingWaived,
                shippingPrice: order.shippingPrice,
                total: order.total,
                note: order.note,
                assignedTo: order.assignedTo,
                ip: order.ip,
                phoneBlocked: order.phoneBlocked,
                assignment: order.assignEvent ? { name: order.assignEvent.note, at: `${formatDate(order.assignEvent.at, lang)} ${formatTime(order.assignEvent.at, lang)}` } : null,
              }}
              products={products}
              rates={rates}
              wilayas={wilayas.map((w) => ({ code: w.code, name: wilayaName(w.code, lang) }))}
              accounts={carrierAccounts}
              members={members}
              trackingUrl={`${storeUrl(shop)}/thanks?o=${order.id}`}
              t={{ orderPage: p, orders: o, errors: t.errors, common: t.common }}
            />
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <ShipmentCard
                lang={lang}
                orderId={order.id}
                orderStatus={order.status}
                shipment={
                  shipment && {
                    carrierName: shipment.carrierName,
                    trackingNumber: shipment.trackingNumber,
                    // The courier's own link, or our download of the PDF (Ecotrack companies)
                    labelHref: shipment.labelUrl ?? (accounts.some((a) => a.id === shipment.carrierAccountId && a.platform === "ecotrack") ? `/api/shipments/${shipment.id}/label` : null),
                    status: shipment.status,
                    rawStatus: shipment.rawStatus,
                    checkedAt: shipment.checkedAt ? formatDate(shipment.checkedAt, lang) : null,
                    fromCarrier: Boolean(shipment.carrierAccountId),
                  }
                }
                accounts={carrierAccounts}
                deliveryHref={role !== "agent" ? sectionHref(lang, "delivery") : null}
                t={{ delivery: t.delivery, errors: t.errors, common: t.common }}
              />
              {(order.extra.length > 0 || order.landingTitle || order.customerNote) && (
                <Card className="space-y-3" data-testid="order-extra">
                  <h2 className="font-semibold">{o.extraFields}</h2>
                  {order.customerNote && (
                    <Alert variant="info">
                      <span className="font-semibold">{o.customerNote}: </span>
                      {order.customerNote}
                    </Alert>
                  )}
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
              {order.guides.map((g) => (
                <CallGuideCard key={g.product.id} lang={lang} product={g.product} guide={g.guide} t={{ assistant: t.assistant, errors: t.errors }} />
              ))}
            </div>
            <div className="space-y-6">
              {(order.risk > 0 || (order.riskReasons ?? []).length > 0) && (
                <RiskCard lang={lang} orderId={order.id} risk={order.risk} reasons={order.riskReasons ?? []} threshold={protection.riskThreshold} held={protection.holdSuspicious && !order.assignedTo} t={t} />
              )}
              <MessageCard
                lang={lang}
                orderId={order.id}
                phone={order.phone}
                texts={messages.texts}
                vars={buildMessageVars(order, shop, shipment?.trackingNumber ?? null, messages.language)}
                initialKind={suggestedKind(order.status)}
                api={Boolean(whatsapp?.active)}
                errors={t.errors as Record<string, string>}
                t={t.assistant}
              />
              <Card className="space-y-3" data-testid="phone-history">
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
              </Card>
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
                      {event.note && event.type !== "assign" && event.note !== "↺" && <p className="mt-0.5 whitespace-pre-line text-fg/90">{event.note}</p>}
                      <p className="text-xs text-muted">
                        <bdi>{userName ?? (event.type === "assign" ? o.bySystem : o.byCustomer)}</bdi> · <bdi>{formatDate(event.createdAt, lang)}</bdi>
                      </p>
                    </li>
                  ))}
                </ol>
              </Card>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
