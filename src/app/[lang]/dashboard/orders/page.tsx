import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { storeUrl } from "@/lib/urls";
import { OrderList } from "@/features/orders/OrderList";
import { isOrderStatus } from "@/features/orders/statuses";

export default async function OrdersPage({ params, searchParams }: PageProps<"/[lang]/dashboard/orders">) {
  const lang = asLocale((await params).lang);
  const { shop } = await requireSection(lang, "orders");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const status = one(sp.status);
  return (
    <OrderList
      lang={lang}
      t={getDictionary(lang)}
      shopId={shop.id}
      storeHref={storeUrl(shop.slug)}
      q={one(sp.q)}
      status={isOrderStatus(status) ? status : undefined}
      page={Math.max(1, Number(one(sp.page)) || 1)}
    />
  );
}
