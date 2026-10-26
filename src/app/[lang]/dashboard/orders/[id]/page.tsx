import { notFound } from "next/navigation";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { getOrder } from "@/features/orders/queries";
import { OrderDetail } from "@/features/orders/OrderDetail";
import { getShipment, listCarrierAccounts } from "@/features/delivery/queries";

export default async function OrderPage({ params }: PageProps<"/[lang]/dashboard/orders/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = asLocale(rawLang);
  const { shop, role } = await requireSection(lang, "orders");
  const [order, shipment, accounts] = await Promise.all([getOrder(shop.id, id), getShipment(shop.id, id), listCarrierAccounts(shop.id)]);
  if (!order) notFound();
  return <OrderDetail lang={lang} t={getDictionary(lang)} order={order} shipment={shipment} accounts={accounts} canManageDelivery={role !== "agent"} />;
}
