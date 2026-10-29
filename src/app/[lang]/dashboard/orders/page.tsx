import { asLocale } from "@/i18n";
import { OrderListPage } from "@/features/orders/OrderListPage";

export default async function OrdersPage({ params, searchParams }: PageProps<"/[lang]/dashboard/orders">) {
  return <OrderListPage lang={asLocale((await params).lang)} section="orders" searchParams={await searchParams} />;
}
