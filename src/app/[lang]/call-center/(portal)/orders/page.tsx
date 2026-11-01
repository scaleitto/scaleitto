import { asLocale } from "@/i18n";
import { requireAgent } from "@/server/auth/context";
import { OrdersPage } from "@/features/orders/OrdersPage";

export default async function PortalOrders({ params, searchParams }: PageProps<"/[lang]/call-center/orders">) {
  const lang = asLocale((await params).lang);
  await requireAgent(lang);
  return <OrdersPage lang={lang} searchParams={await searchParams} portal />;
}
