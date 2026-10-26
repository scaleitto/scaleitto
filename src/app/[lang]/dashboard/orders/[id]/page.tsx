import { notFound } from "next/navigation";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { getOrder } from "@/features/orders/queries";
import { OrderDetail } from "@/features/orders/OrderDetail";

export default async function OrderPage({ params }: PageProps<"/[lang]/dashboard/orders/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = asLocale(rawLang);
  const { shop } = await requireSection(lang, "orders");
  const order = await getOrder(shop.id, id);
  if (!order) notFound();
  return <OrderDetail lang={lang} t={getDictionary(lang)} order={order} />;
}
