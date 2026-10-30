import { asLocale } from "@/i18n";
import { OrdersPage } from "@/features/orders/OrdersPage";

export default async function Orders({ params, searchParams }: PageProps<"/[lang]/dashboard/orders">) {
  return <OrdersPage lang={asLocale((await params).lang)} searchParams={await searchParams} />;
}
