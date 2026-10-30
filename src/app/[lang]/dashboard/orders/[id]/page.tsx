import { whatsappConfig } from "@/features/messages/whatsapp";
import { notFound } from "next/navigation";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { getOrder } from "@/features/orders/queries";
import { OrderDetail } from "@/features/orders/OrderDetail";
import { getShipment, listCarrierAccounts } from "@/features/delivery/queries";
import { viewerOf } from "@/features/orders/access";
import { assignableMembers } from "@/features/team/queries";
import { releaseLockedOrders } from "@/features/plans/locked";
import { protectionFor } from "@/features/checkout/protection";

export default async function OrderPage({ params }: PageProps<"/[lang]/dashboard/orders/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = asLocale(rawLang);
  const ctx = await requireSection(lang, "orders");
  const { shop, role } = ctx;
  await releaseLockedOrders(shop.id);
  const [order, shipment, accounts, members, whatsapp, protection] = await Promise.all([
    getOrder(viewerOf(ctx), id),
    getShipment(shop.id, id),
    listCarrierAccounts(shop.id),
    role === "agent" ? Promise.resolve([]) : assignableMembers(shop.id),
    whatsappConfig(shop.id),
    protectionFor(shop.id),
  ]);
  if (!order) notFound();
  return <OrderDetail lang={lang} t={getDictionary(lang)} order={order} shipment={shipment} accounts={accounts} canManageDelivery={role !== "agent"} members={members} shop={{ name: shop.name, phone: shop.phone, messages: shop.messages }} whatsappApi={Boolean(whatsapp?.active)} protection={protection} now={new Date()} />;
}
