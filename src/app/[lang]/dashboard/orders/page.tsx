import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { storeUrl } from "@/lib/urls";
import { OrderList } from "@/features/orders/OrderList";
import { isOrderStatus } from "@/features/orders/statuses";
import { viewerOf } from "@/features/orders/access";
import { assignableMembers } from "@/features/team/queries";
import { releaseLockedOrders } from "@/features/plans/locked";

export default async function OrdersPage({ params, searchParams }: PageProps<"/[lang]/dashboard/orders">) {
  const lang = asLocale((await params).lang);
  const ctx = await requireSection(lang, "orders");
  const { shop } = ctx;
  // Unlock what the shop is now entitled to (new month, higher limit) before reading the orders
  await releaseLockedOrders(shop.id);
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const status = one(sp.status);
  return (
    <OrderList
      lang={lang}
      t={getDictionary(lang)}
      viewer={viewerOf(ctx)}
      members={ctx.role === "agent" ? [] : await assignableMembers(shop.id)}
      storeHref={storeUrl(shop.slug)}
      q={one(sp.q)}
      status={isOrderStatus(status) ? status : undefined}
      assignee={ctx.role === "agent" ? undefined : one(sp.assignee) || undefined}
      page={Math.max(1, Number(one(sp.page)) || 1)}
    />
  );
}
