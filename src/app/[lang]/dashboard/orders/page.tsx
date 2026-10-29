import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { storeUrl } from "@/lib/urls";
import { canAccess, sectionHref } from "@/lib/permissions";
import { OrderList } from "@/features/orders/OrderList";
import { isOrderStatus } from "@/features/orders/statuses";
import { isOrderView, pageSizes } from "@/features/orders/views";
import { viewerOf } from "@/features/orders/access";
import { assignableMembers } from "@/features/team/queries";
import { releaseLockedOrders } from "@/features/plans/locked";
import { listCarrierAccounts } from "@/features/delivery/queries";
import { findCarrier } from "@/features/delivery/carriers";
import { protectionFor } from "@/features/checkout/protection";

export default async function OrdersPage({ params, searchParams }: PageProps<"/[lang]/dashboard/orders">) {
  const lang = asLocale((await params).lang);
  const ctx = await requireSection(lang, "orders");
  const { shop } = ctx;
  // Unlock what the shop is now entitled to (new month, higher limit) before reading the orders
  await releaseLockedOrders(shop.id);
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const status = one(sp.status);
  const view = one(sp.view);
  const wilaya = Number(one(sp.wilaya));
  const delivery = one(sp.delivery);
  const size = Number(one(sp.size));
  const agent = ctx.role === "agent";
  const [members, accounts, protection] = await Promise.all([agent ? [] : assignableMembers(shop.id), listCarrierAccounts(shop.id), protectionFor(shop.id)]);
  return (
    <OrderList
      lang={lang}
      t={getDictionary(lang)}
      viewer={viewerOf(ctx)}
      members={members}
      accounts={accounts.map((a) => ({ id: a.id, name: findCarrier(a.carrier)?.name ?? a.carrier, isDefault: a.isDefault, options: a.options }))}
      storeHref={storeUrl(shop)}
      deliveryHref={canAccess(ctx.role, "delivery") ? sectionHref(lang, "delivery") : null}
      canProtect={!agent}
      riskThreshold={protection.riskThreshold}
      filters={{
        view: isOrderView(view) ? view : "all",
        q: one(sp.q),
        status: isOrderStatus(status) ? status : undefined,
        stage: one(sp.stage) || undefined,
        wilaya: Number.isInteger(wilaya) && wilaya > 0 ? wilaya : undefined,
        delivery: delivery === "home" || delivery === "office" ? delivery : undefined,
        from: one(sp.from) || undefined,
        to: one(sp.to) || undefined,
        assignee: agent ? undefined : one(sp.assignee) || undefined,
        page: Math.max(1, Number(one(sp.page)) || 1),
        size: (pageSizes as readonly number[]).includes(size) ? size : pageSizes[0],
      }}
    />
  );
}
