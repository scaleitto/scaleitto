import { asLocale } from "@/i18n";
import { OrderListPage } from "@/features/orders/OrderListPage";

export default async function ReturnsPage({ params, searchParams }: PageProps<"/[lang]/dashboard/orders/returns">) {
  return <OrderListPage lang={asLocale((await params).lang)} section="returns" searchParams={await searchParams} />;
}
