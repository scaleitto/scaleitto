import { redirect } from "next/navigation";
import { getDictionary, type Locale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { storeUrl } from "@/lib/urls";
import { canAccess, sectionHref } from "@/lib/permissions";
import { formatDate, formatTime } from "@/lib/format";
import { isOrderStatus } from "./statuses";
import { isOrderView, pageSizes, returnStates, type ReturnState } from "./views";
import { viewerOf } from "./access";
import { trackingOverview } from "./queries";
import { OrderList, sectionView, type OrderListSection } from "./OrderList";
import { assignableMembers } from "@/features/team/queries";
import { releaseLockedOrders } from "@/features/plans/locked";
import { listCarrierAccounts } from "@/features/delivery/queries";
import { findCarrier } from "@/features/delivery/carriers";
import { protectionFor } from "@/features/checkout/protection";

type Search = Record<string, string | string[] | undefined>;

// The four order lists of the Orders group (the list, send to couriers, parcel tracking, returns): one guard, the same
// filters read from the address bar, each with its own view.
export async function OrderListPage({ lang, section, searchParams: sp }: { lang: Locale; section: OrderListSection; searchParams: Search }) {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const view = one(sp.view);
  // Links from before the sub-sections existed
  if (section === "orders" && (view === "ship" || view === "transit" || view === "returns")) {
    const target = view === "ship" ? "shipping" : view === "transit" ? "tracking" : "returns";
    const rest = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (k === "view" || v === undefined ? [] : [[k, one(v)]])));
    redirect(`${sectionHref(lang, target)}${rest.size ? `?${rest}` : ""}`);
  }
  const ctx = await requireSection(lang, section);
  const { shop } = ctx;
  // Unlock what the shop is now entitled to (new month, higher limit) before reading the orders
  await releaseLockedOrders(shop.id);
  const status = one(sp.status);
  const wilaya = Number(one(sp.wilaya));
  const delivery = one(sp.delivery);
  const size = Number(one(sp.size));
  const ret = one(sp.ret);
  const agent = ctx.role === "agent";
  const [members, accounts, protection, tracking] = await Promise.all([
    agent ? [] : assignableMembers(shop.id),
    listCarrierAccounts(shop.id),
    protectionFor(shop.id),
    section === "tracking" ? trackingOverview(shop.id) : Promise.resolve(null),
  ]);
  const listView = section === "orders" ? (isOrderView(view) && ["all", "confirm", "risk", "done"].includes(view) ? view : "all") : sectionView[section];
  return (
    <OrderList
      lang={lang}
      t={getDictionary(lang)}
      viewer={viewerOf(ctx)}
      members={members}
      accounts={accounts.map((a) => ({ id: a.id, name: findCarrier(a.carrier)?.name ?? a.carrier, isDefault: a.isDefault, options: a.options }))}
      storeHref={storeUrl(shop)}
      deliveryHref={canAccess(ctx.role, "delivery") ? sectionHref(lang, "delivery") : null}
      riskThreshold={protection.riskThreshold}
      section={section}
      tracking={tracking ? { followed: tracking.followed, last: tracking.last ? `${formatDate(tracking.last, lang)} ${formatTime(tracking.last, lang)}` : null } : undefined}
      filters={{
        view: listView,
        q: one(sp.q),
        status: isOrderStatus(status) ? status : undefined,
        stage: one(sp.stage) || undefined,
        ret: (returnStates as readonly string[]).includes(ret) ? (ret as ReturnState) : undefined,
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
