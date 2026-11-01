import Link from "next/link";
import { Download, ScanLine, Search, ShoppingCart } from "lucide-react";
import { getDictionary, type Locale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { fmt, formatDate, formatTime } from "@/lib/format";
import { wilayaName, wilayas } from "@/lib/wilayas";
import { Card, EmptyState, PageHeader, buttonClass, inputClass } from "@/ui";
import { viewerOf } from "./access";
import { listOrders, orderProducts, tabCounts } from "./queries";
import { statusTabs } from "./statuses";
import { filtersHref, pageSizes, parseOrderFilters } from "./views";
import { OrdersTable } from "./OrdersTable";
import { NewOrderButton } from "./OrderForm";
import { BulkStatus, FilterDialog, RefreshButton } from "./OrderToolbar";
import { SelectionTools, ShipPanel, TrackPanel } from "./OrderTools";
import { ManifestButton } from "@/features/delivery/PrintButton";
import { assignableMembers } from "@/features/team/queries";
import { releaseLockedOrders } from "@/features/plans/locked";
import { listCarrierAccounts } from "@/features/delivery/queries";
import { findCarrier } from "@/features/delivery/carriers";
import { getShippingRates } from "@/features/storefront/queries";
import { protectionFor } from "@/features/checkout/protection";

type Search = Record<string, string | string[] | undefined>;

// The orders page (Zimam's): a tab per status with its count, the toolbar (filter, export, refresh, search, scan, new
// order), the table edited in place, and the bulk tools of the tab (status for all; sending in Confirmed; tracking in
// In transit).
export async function OrdersPage({ lang, searchParams }: { lang: Locale; searchParams: Search }) {
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
  const base = sectionHref(lang, "orders");
  const href = (patch: Parameters<typeof filtersHref>[2]) => filtersHref(base, f, patch);
  const pages = Math.max(1, Math.ceil(total / size));
  const carrierAccounts = accounts.map((a) => ({ id: a.id, name: findCarrier(a.carrier)?.name ?? a.carrier, isDefault: a.isDefault, options: a.options }));
  const wilayaList = wilayas.map((w) => ({ code: w.code, name: wilayaName(w.code, lang) }));
  const tools = { orders: t.orders, errors: t.errors, delivery: t.delivery, common: t.common };

  return (
    <>
      <PageHeader
        title={t.nav.items.orders}
        description={t.orders.viewHints.all}
        actions={<NewOrderButton lang={lang} products={products} rates={rates} wilayas={wilayaList} accounts={carrierAccounts} members={members} t={{ orderPage: p, orders: t.orders, errors: t.errors, common: t.common }} />}
      />

      <nav className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-line bg-panel p-1" data-testid="status-tabs">
        {statusTabs.map((s) => (
          <Link
            key={s}
            href={href({ status: s, page: 1 })}
            data-tab={s}
            aria-current={f.status === s ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${f.status === s ? "bg-accent-soft text-accent-ink" : "text-muted hover:bg-panel-2 hover:text-fg"}`}
          >
            {t.orders.statuses[s]}
            <span className={`rounded-full px-1.5 text-xs tabular-nums ${f.status === s ? "bg-accent text-accent-fg" : "bg-panel-2"}`} data-count>
              {(counts[s] ?? 0) + (s === "pending" ? (counts.call_back ?? 0) : 0)}
            </span>
          </Link>
        ))}
      </nav>

      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <FilterDialog base={base} filters={f} products={products} members={members} canFilterAgent={canAssign} wilayas={wilayaList} t={t} />
        <a href={`/api/orders/export?lang=${lang}&${href({ page: 1 }).slice(base.length + 1)}`} className={buttonClass("secondary")} data-testid="export">
          <Download size={15} /> {p.export}
        </a>
        <RefreshButton label={p.refresh} />
        <form action={base} method="get" className="relative min-w-[220px] flex-1">
          <input type="hidden" name="status" value={f.status} />
          <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={f.q} placeholder={p.search} className={`${inputClass} ps-9`} data-testid="order-search" />
        </form>
        <Link href={sectionHref(lang, "scan")} className={buttonClass("secondary")} data-testid="scan-link">
          <ScanLine size={15} /> {p.scan}
        </Link>
      </Card>

      {rows.length > 0 && (
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <SelectionTools t={t} />
            <BulkStatus lang={lang} t={t} />
          </div>
          {f.status === "confirmed" && <ShipPanel lang={lang} accounts={carrierAccounts} deliveryHref={canAssign ? sectionHref(lang, "delivery") : null} t={tools} />}
          {f.status === "in_transit" && <TrackPanel lang={lang} t={tools} />}
          {(f.status === "confirmed" || f.status === "in_transit") && <ManifestButton lang={lang} label={t.delivery.manifest.print} />}
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
            editBase={base}
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
    </>
  );
}
