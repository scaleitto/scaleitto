import Link from "next/link";
import { resolveApps } from "@/features/apps/settings";
import { Ban, Check, CircleAlert, ClipboardCheck, ClipboardList, Download, Flag, ScanLine, Search, ShoppingCart, Truck, type LucideIcon } from "lucide-react";
import { getDictionary, type Locale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { fmt, formatDate, formatTime } from "@/lib/format";
import { wilayaName, wilayas } from "@/lib/wilayas";
import { Card, EmptyState, buttonClass, inputClass, type Tone } from "@/ui";
import { viewerOf } from "./access";
import { getOrder, listOrders, orderProducts, tabCounts } from "./queries";
import { statusTabs, statusTone, type OrderStatus } from "./statuses";
import { filtersHref, pageSizes, parseOrderFilters } from "./views";
import { OrdersTable } from "./OrdersTable";
import { EditOrderDialog, LockedNotice, NewOrderButton } from "./OrderForm";
import { storeUrl } from "@/lib/urls";
import { BulkStatus, FilterDialog, RefreshButton } from "./OrderToolbar";
import { ShipPanel, TrackPanel } from "./OrderTools";
import { ManifestButton } from "@/features/delivery/PrintButton";
import { assignableMembers } from "@/features/team/queries";
import { releaseLockedOrders } from "@/features/plans/locked";
import { listCarrierAccounts } from "@/features/delivery/queries";
import { findCarrier } from "@/features/delivery/carriers";
import { getShippingRates } from "@/features/storefront/queries";
import { protectionFor } from "@/features/checkout/protection";

type Search = Record<string, string | string[] | undefined>;

const tabIcons: Record<(typeof statusTabs)[number], LucideIcon> = { pending: ClipboardList, confirmed: ClipboardCheck, in_transit: Truck, delivered: Check, returned: CircleAlert, abandoned: ShoppingCart, cancelled: Ban, flagged: Flag } satisfies Partial<Record<OrderStatus, LucideIcon>>;
// Each status card's colors: filled when current, tinted icon, edge and count otherwise
const tabTones: Record<Tone, { on: string; soft: string; edge: string; count: string }> = {
  violet: { on: "border-violet bg-violet text-white", soft: "bg-violet-soft text-violet", edge: "border-violet/30", count: "bg-violet-soft text-violet ring-violet/30" },
  accent: { on: "border-accent bg-accent text-white", soft: "bg-accent/10 text-accent", edge: "border-accent/30", count: "bg-accent/10 text-accent ring-accent/30" },
  info: { on: "border-info bg-info text-white", soft: "bg-info/10 text-info", edge: "border-info/30", count: "bg-info/10 text-info ring-info/30" },
  danger: { on: "border-danger bg-danger text-white", soft: "bg-danger/10 text-danger", edge: "border-danger/30", count: "bg-danger/10 text-danger ring-danger/30" },
  warning: { on: "border-warning bg-warning text-white", soft: "bg-warning/10 text-warning", edge: "border-warning/30", count: "bg-warning/10 text-warning ring-warning/30" },
  orange: { on: "border-warning bg-warning text-white", soft: "bg-warning/10 text-warning", edge: "border-warning/30", count: "bg-warning/10 text-warning ring-warning/30" },
  neutral: { on: "border-fg bg-fg text-bg", soft: "bg-panel-2 text-muted", edge: "border-line", count: "bg-panel-2 text-muted ring-line" },
};

// The orders page (Zimam's): a tab per status with its count, the toolbar (filter, export, refresh, search, scan, new
// order), the table edited in place, and the bulk tools of the tab (status for all; sending in Confirmed; tracking in
// In transit).
// portal = the agents' portal (Zimam's call center: no scan link, no courier tools, no agent column)
export async function OrdersPage({ lang, searchParams, portal = false }: { lang: Locale; searchParams: Search; portal?: boolean }) {
  const t = getDictionary(lang);
  const p = t.orderPage;
  const ctx = await requireSection(lang, "orders");
  const { shop, role } = ctx;
  // Unlock what the shop is now entitled to (new month, higher limit) before reading the orders
  await releaseLockedOrders(shop.id);
  const f = parseOrderFilters(searchParams);
  const viewer = viewerOf(ctx);
  const canAssign = role !== "agent";
  const [{ rows, total, size }, counts, members, accounts, products, rates, protection] = await Promise.all([
    listOrders(viewer, f),
    tabCounts(viewer),
    canAssign ? assignableMembers(shop.id) : Promise.resolve([]),
    listCarrierAccounts(shop.id),
    orderProducts(shop.id),
    getShippingRates(shop.id),
    protectionFor(shop.id),
  ]);
  const editId = typeof searchParams.edit === "string" ? searchParams.edit : null;
  const editing = editId ? await getOrder(viewer, editId) : null;
  const base = portal ? `/${lang}/call-center/orders` : sectionHref(lang, "orders");
  const href = (patch: Parameters<typeof filtersHref>[2]) => filtersHref(base, f, patch);
  const pages = Math.max(1, Math.ceil(total / size));
  const carrierAccounts = accounts.map((a) => ({ id: a.id, name: findCarrier(a.carrier)?.name ?? a.carrier, isDefault: a.isDefault, options: a.options }));
  const wilayaList = wilayas.map((w) => ({ code: w.code, name: wilayaName(w.code, lang) }));
  const tools = { orders: t.orders, errors: t.errors, delivery: t.delivery, common: t.common };

  return (
    <>
      <h1 className="sr-only">{portal ? t.portal.ordersTitle : t.nav.items.orders}</h1>
      {/* Zimam's status cards: an icon and a count each, the current one filled with its color */}
      <Card className="mb-3 p-3">
        <nav className="flex gap-2 overflow-x-auto" data-testid="status-tabs">
          {statusTabs.map((s) => {
            const Icon = tabIcons[s];
            const tone = tabTones[statusTone[s]];
            const current = f.status === s;
            return (
              <Link
                key={s}
                href={href({ status: s, page: 1 })}
                data-tab={s}
                aria-current={current ? "page" : undefined}
                className={`flex shrink-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${current ? tone.on : `bg-panel text-fg hover:bg-panel-2 ${tone.edge}`}`}
              >
                <span className={`grid size-8 place-items-center rounded-lg ${current ? "bg-white/20" : tone.soft}`}>
                  <Icon size={16} />
                </span>
                {t.orders.statuses[s]}
                <span className={`rounded-full px-1.5 text-xs tabular-nums ring-1 ${current ? "bg-white/20 ring-white/30" : tone.count}`} data-count>
                  {(counts[s] ?? 0) + (s === "pending" ? (counts.call_back ?? 0) : 0)}
                </span>
              </Link>
            );
          })}
        </nav>
      </Card>

      <Card className="mb-4 flex flex-wrap items-center gap-2 p-2">
        <FilterDialog base={base} filters={f} products={products} members={members} canFilterAgent={canAssign} wilayas={wilayaList} t={t} />
        <a href={`/api/orders/export?lang=${lang}&${href({ page: 1 }).slice(base.length + 1)}`} className={buttonClass("ghost")} data-testid="export">
          <Download size={15} /> {p.export}
        </a>
        <span className="flex-1" />
        <RefreshButton label={p.refresh} />
        <form action={base} method="get" className="relative w-full sm:w-64">
          <input type="hidden" name="status" value={f.status} />
          <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={f.q} placeholder={p.search} className={`${inputClass} ps-9`} data-testid="order-search" />
        </form>
        {!portal && resolveApps(shop.apps).scanner && (
          <Link href={sectionHref(lang, "scan")} className={buttonClass("secondary")} data-testid="scan-link">
            <ScanLine size={15} /> {p.scan}
          </Link>
        )}
        <NewOrderButton lang={lang} products={products} rates={rates} wilayas={wilayaList} accounts={carrierAccounts} members={members} t={{ orderPage: p, orders: t.orders, errors: t.errors, common: t.common }} />
      </Card>

      {/* The tab's tools stay while the list empties: the send / update report must survive its last order leaving */}
      {(rows.length > 0 || (!portal && (f.status === "confirmed" || f.status === "in_transit"))) && (
        <div className="mb-4 space-y-3">
          <BulkStatus lang={lang} t={t} />
          {!portal && f.status === "confirmed" && <ShipPanel lang={lang} accounts={carrierAccounts} deliveryHref={canAssign ? sectionHref(lang, "delivery") : null} t={tools} />}
          {!portal && f.status === "in_transit" && <TrackPanel lang={lang} t={tools} />}
          {!portal && rows.length > 0 && (f.status === "confirmed" || f.status === "in_transit") && <ManifestButton lang={lang} label={t.delivery.manifest.print} />}
        </div>
      )}

      <Card className="p-0">
        {rows.length === 0 ? (
          <div className="p-8">
            <EmptyState icon={<ShoppingCart size={22} />} title={p.empty}>
              {p.emptyHint}
            </EmptyState>
          </div>
        ) : (
          <OrdersTable
            lang={lang}
            editBase={href({})}
            canAssign={canAssign}
            members={members}
            accounts={carrierAccounts}
            t={{ orderPage: p, orders: t.orders, errors: t.errors }}
            rows={rows.map((r) => ({
              id: r.id,
              number: r.number,
              status: r.status,
              date: formatDate(r.createdAt, lang),
              time: formatTime(r.createdAt, lang),
              product: r.product,
              image: r.image,
              lines: r.lines,
              pieces: r.pieces,
              total: r.total,
              deliveryType: r.deliveryType,
              customerName: r.customerName,
              phone: r.phone,
              wilaya: wilayaName(r.wilayaCode, lang),
              commune: r.commune,
              assignedTo: r.assignedTo,
              carrierAccountId: r.carrierAccountId,
              carrierName: r.carrierName,
              trackingNumber: r.trackingNumber,
              note: r.note,
              locked: r.locked,
              risk: r.risk,
              risky: !r.locked && r.risk >= protection.riskThreshold,
              paid: r.paymentStatus === "paid",
            }))}
          />
        )}
      </Card>

      {total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted" data-testid="pagination">
          <span className="tabular-nums">
            {(f.page - 1) * size + 1}–{Math.min(total, f.page * size)} / {total}
          </span>
          <div className="flex items-center gap-1">
            {pageSizes.map((n) => (
              <Link key={n} href={href({ size: n, page: 1 })} className={`rounded-md px-2 py-1 ${n === size ? "bg-panel-2 font-semibold text-fg" : "hover:bg-panel-2"}`}>
                {fmt(t.orders.filters.perPage, { n })}
              </Link>
            ))}
          </div>
          <div className="flex gap-2">
            {f.page > 1 && (
              <Link href={href({ page: f.page - 1 })} className={buttonClass("secondary")}>
                ‹
              </Link>
            )}
            <span className="self-center tabular-nums">
              {f.page} / {pages}
            </span>
            {f.page < pages && (
              <Link href={href({ page: f.page + 1 })} className={buttonClass("secondary")} data-testid="next-page">
                ›
              </Link>
            )}
          </div>
        </div>
      )}
      {editing && (
        <EditOrderDialog
          key={editing.id}
          closeHref={href({})}
          title={fmt(p.editTitle, { number: editing.number })}
          locked={editing.locked ? <LockedNotice text={p.locked} upgrade={p.upgrade} href={sectionHref(lang, "plans")} /> : null}
          lang={lang}
          order={{
            id: editing.id,
            number: editing.number,
            status: editing.status,
            items: editing.items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity, unitPrice: i.unitPrice, name: i.name })),
            customerName: editing.customerName,
            phone: editing.phone,
            wilayaCode: editing.wilayaCode,
            commune: editing.commune,
            address: editing.address,
            deliveryType: editing.deliveryType,
            carrierAccountId: editing.carrierAccountId,
            shippingWaived: editing.shippingWaived,
            shippingPrice: editing.shippingPrice,
            total: editing.total,
            note: editing.note,
            assignedTo: editing.assignedTo,
            ip: editing.ip,
            phoneBlocked: editing.phoneBlocked,
            assignment: editing.assignEvent ? { name: editing.assignEvent.note, at: `${formatDate(editing.assignEvent.at, lang)} ${formatTime(editing.assignEvent.at, lang)}` } : null,
          }}
          products={products}
          rates={rates}
          wilayas={wilayaList}
          accounts={carrierAccounts}
          members={members}
          trackingUrl={`${storeUrl(shop)}/thanks?o=${editing.id}`}
          t={{ orderPage: p, orders: t.orders, errors: t.errors, common: t.common }}
        />
      )}
    </>
  );
}
