import { asLocale } from "@/i18n";
import { OrderListPage } from "@/features/orders/OrderListPage";

export default async function TrackingPage({ params, searchParams }: PageProps<"/[lang]/dashboard/orders/tracking">) {
  return <OrderListPage lang={asLocale((await params).lang)} section="tracking" searchParams={await searchParams} />;
}
