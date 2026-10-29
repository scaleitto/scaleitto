import { asLocale } from "@/i18n";
import { OrderListPage } from "@/features/orders/OrderListPage";

export default async function ShippingPage({ params, searchParams }: PageProps<"/[lang]/dashboard/orders/shipping">) {
  return <OrderListPage lang={asLocale((await params).lang)} section="shipping" searchParams={await searchParams} />;
}
