import Link from "next/link";
import { FileText, Lock, Search, ShieldAlert, ShoppingCart } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { sectionHref } from "@/lib/permissions";
import { fmt, formatDate, formatPrice } from "@/lib/format";
import { wilayaName, wilayas } from "@/lib/wilayas";
import type { ParcelDefaults } from "@/lib/enums";
import { shipmentStatuses } from "@/server/db/schema";
import { Badge, Card, EmptyState, PageHeader, buttonClass, inputClass } from "@/ui";
import { listOrders, returnCounts, riskCount, stageCounts, statusCounts } from "./queries";
import { statusTone } from "./statuses";
import { listViews, pageSizes, returnStates, viewStatuses, type OrderFilters, type OrderView } from "./views";
import type { OrderViewer } from "./access";
import { BulkAssignBar, SelectAllOrders } from "./BulkAssign";
import { ReturnsPanel, SelectionTools, ShipPanel, TrackPanel } from "./OrderTools";
import { shipmentTone } from "@/features/delivery/status";

// The filter bar's controls keep their natural width (inputClass is full width)
const filterInput = `${inputClass.replace("w-full", "w-auto")} min-w-0`;
const filterSelect = `${filterInput} select-chevron appearance-none pe-9`;

// The order lists of the Orders group: the list itself and the parcel's life (send, track, returns)
export type OrderListSection = "orders" | "shipping" | "tracking" | "returns";
export const sectionView: Record<Exclude<OrderListSection, "orders">, OrderView> = { shipping: "ship", tracking: "transit", returns: "returns" };

export async function OrderList({
  lang,
  t,
  viewer,
  members,
  accounts,
  deliveryHref,
  riskThreshold,
  filters: f,
  section = "orders",
  tracking,
}: {
  lang: string;
  t: Dictionary;
  viewer: OrderViewer;
  // Team members to filter by and assign to (managers only; empty for agents)
  members: { userId: string; name: string; role: string }[];
  // Connected delivery companies (for sending)
  accounts: { id: string; name: string; isDefault: boolean; options: Partial<ParcelDefaults> | null }[];
  deliveryHref: string | null;
  riskThreshold: number;
  filters: OrderFilters;
  section?: OrderListSection;
  // Parcel tracking: the automatic check's last run and how many parcels it follows
  tracking?: { last: string | null; followed: number };
}) {
  const o = t.orders;
  const base = sectionHref(lang, section);
  const orderBase = sectionHref(lang, "orders");
  const [{ rows, total, size }, counts, risky, stages, returns] = await Promise.all([
    listOrders(viewer, f, riskThreshold),
    statusCounts(viewer),
    riskCount(viewer, riskThreshold),
    f.view === "transit" ? stageCounts(viewer) : Promise.resolve(null),
    f.view === "returns" ? returnCounts(viewer) : Promise.resolve(null),
  ]);
  const sum = (view: OrderView) => (viewStatuses[view] ?? []).reduce((a, s) => a + (counts[s] ?? 0), 0);
  const all = Object.values(counts).reduce((a, b) => a + b, 0);
  const viewCounts: Record<(typeof listViews)[number], number> = { all, confirm: sum("confirm"), done: sum("done"), risk: risky };
  const href = (patch: Partial<Record<keyof OrderFilters, string | number | undefined>>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, ...patch })) {
      if (v === undefined || v === "" || (k === "page" && v === 1) || (k === "size" && v === pageSizes[0]) || (k === "view" && (v === "all" || section !== "orders"))) continue;
      params.set(k, String(v));
    }
    const s = params.toString();
    return s ? `${base}?${s}` : base;
  };
  const statuses = viewStatuses[f.view];
  const shipping = f.view === "ship" || f.view === "transit" || f.view === "returns";
  const managers = members.length > 0;
  const filtered = Boolean(f.q || f.wilaya || f.delivery || f.from || f.to || f.assignee || f.status || f.stage);
  const chip = (active: boolean) => `flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${active ? "bg-panel-2 text-fg" : "text-muted hover:text-fg"}`;

  return (
    <>
      <PageHeader
        title={t.sections[section].title}
        description={t.sections[section].description}
      />
      {/* The list's views: everything, to confirm, suspicious, finished */}
      {section === "orders" && (
        <nav className="mb-3 flex gap-1 overflow-x-auto border-b border-line text-sm" data-testid="order-views">
          {listViews.map((key) => (
            <Link
              key={key}
              href={key === "all" ? base : `${base}?view=${key}`}
              aria-current={f.view === key ? "page" : undefined}
              data-view={key}
              className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 pb-2.5 font-semibold ${f.view === key ? "border-accent text-accent" : "border-transparent text-muted hover:text-fg"}`}
            >
              {key === "risk" && <ShieldAlert size={15} className={risky ? "text-warning" : ""} />}
              {o.views[key]}
              <span className={`rounded-full px-1.5 text-xs ${key === "risk" && risky ? "bg-warning/10 text-warning" : "bg-bg"}`}>{viewCounts[key]}</span>
            </Link>
          ))}
        </nav>
      )}
      <p className="mb-4 text-sm text-muted" data-testid="view-hint">
        {o.viewHints[f.view]}
        {/* The automatic check of the couriers (cron), so the merchant knows the stages are fresh */}
        {tracking && (
          <span className="mt-1 block text-xs" data-testid="auto-tracking">
            {fmt(o.track.auto, { n: tracking.followed })} {tracking.last ? fmt(o.track.lastCheck, { at: tracking.last }) : o.track.neverChecked}
          </span>
        )}
      </p>

      {all === 0 ? (
        <EmptyState icon={<ShoppingCart size={40} />} title={o.emptyTitle}>
          <p>{o.emptyBody}</p>
        </EmptyState>
      ) : (
        <Card className="p-0">
          <div className="space-y-3 border-b border-line p-4">
            {/* The statuses of this sub-section, or the courier's stages for parcels on their way */}
            {f.view === "returns" && returns ? (
              <nav className="flex gap-1 overflow-x-auto pb-1 text-sm" aria-label={o.returns.title} data-testid="return-chips">
                <Link href={href({ ret: undefined, page: 1 })} aria-current={!f.ret ? "page" : undefined} className={chip(!f.ret)}>
                  {o.filters.allStages}
                  <span className="rounded-full bg-bg px-1.5 text-xs">{returns.back + returns.pending + returns.received}</span>
                </Link>
                {returnStates.map((r) => (
                  <Link key={r} href={href({ ret: r, page: 1 })} aria-current={f.ret === r ? "page" : undefined} className={chip(f.ret === r)} data-ret={r}>
                    {o.returns.states[r]}
                    <span className="rounded-full bg-bg px-1.5 text-xs">{returns[r]}</span>
                  </Link>
                ))}
              </nav>
            ) : f.view === "transit" && stages ? (
              <nav className="flex gap-1 overflow-x-auto pb-1 text-sm" aria-label={o.filters.stage} data-testid="stage-chips">
                <Link href={href({ stage: undefined, page: 1 })} aria-current={!f.stage ? "page" : undefined} className={chip(!f.stage)}>
                  {o.filters.allStages}
                  <span className="rounded-full bg-bg px-1.5 text-xs">{sum("transit")}</span>
                </Link>
                {shipmentStatuses
                  .filter((s) => stages[s])
                  .map((s) => (
                    <Link key={s} href={href({ stage: s, page: 1 })} aria-current={f.stage === s ? "page" : undefined} className={chip(f.stage === s)} data-stage={s}>
                      {t.delivery.statuses[s]}
                      <span className="rounded-full bg-bg px-1.5 text-xs">{stages[s]}</span>
                    </Link>
                  ))}
              </nav>
            ) : (
              (statuses ?? []).length !== 1 && (
                <nav className="flex gap-1 overflow-x-auto pb-1 text-sm" aria-label={o.columns.status}>
                  <Link href={href({ status: undefined, page: 1 })} aria-current={!f.status ? "page" : undefined} className={chip(!f.status)}>
                    {o.all}
                    <span className="rounded-full bg-bg px-1.5 text-xs">{f.view === "risk" ? risky : statuses ? sum(f.view) : all}</span>
                  </Link>
                  {(statuses ?? Object.keys(statusTone)).map((s) => (
                    <Link key={s} href={href({ status: s, page: 1 })} aria-current={f.status === s ? "page" : undefined} className={chip(f.status === s)}>
                      {o.statuses[s as keyof typeof o.statuses]}
                      {f.view !== "risk" && <span className="rounded-full bg-bg px-1.5 text-xs">{counts[s as keyof typeof counts] ?? 0}</span>}
                    </Link>
                  ))}
                </nav>
              )
            )}

            <form action={base} className="flex flex-wrap gap-2" data-testid="order-filters">
              {section === "orders" && f.view !== "all" && <input type="hidden" name="view" value={f.view} />}
              {f.ret && <input type="hidden" name="ret" value={f.ret} />}
              {f.status && <input type="hidden" name="status" value={f.status} />}
              {f.stage && <input type="hidden" name="stage" value={f.stage} />}
              <div className="relative w-full sm:w-72">
                <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
                <input type="search" name="q" defaultValue={f.q} placeholder={o.search} aria-label={o.search} className={`${inputClass} ps-9`} />
              </div>
              <select name="wilaya" defaultValue={f.wilaya ?? ""} aria-label={o.filters.wilaya} className={filterSelect}>
                <option value="">{o.filters.wilaya}</option>
                {wilayas.map((w) => (
                  <option key={w.code} value={w.code}>
                    {w.code} - {wilayaName(w.code, lang)}
                  </option>
                ))}
              </select>
              <select name="delivery" defaultValue={f.delivery ?? ""} aria-label={o.filters.delivery} className={filterSelect}>
                <option value="">{o.filters.delivery}</option>
                <option value="home">{o.filters.home}</option>
                <option value="office">{o.filters.office}</option>
              </select>
              <input type="date" name="from" defaultValue={f.from} aria-label={o.filters.from} title={o.filters.from} className={filterInput} dir="ltr" />
              <input type="date" name="to" defaultValue={f.to} aria-label={o.filters.to} title={o.filters.to} className={filterInput} dir="ltr" />
              {managers && (
                <select name="assignee" defaultValue={f.assignee ?? ""} aria-label={o.columns.assignee} className={filterSelect}>
                  <option value="">{o.allAgents}</option>
                  <option value="none">{o.unassigned}</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </select>
              )}
              <select name="size" defaultValue={f.size} aria-label={fmt(o.filters.perPage, { n: f.size })} className={filterSelect}>
                {pageSizes.map((n) => (
                  <option key={n} value={n}>
                    {fmt(o.filters.perPage, { n })}
                  </option>
                ))}
              </select>
              <button type="submit" className={buttonClass("secondary")}>
                {o.filters.apply}
              </button>
              {filtered && (
                <Link href={href({ q: undefined, wilaya: undefined, delivery: undefined, from: undefined, to: undefined, assignee: undefined, status: undefined, stage: undefined, ret: undefined, page: 1 })} className={buttonClass("ghost")}>
                  {o.filters.clear}
                </Link>
              )}
            </form>
          </div>

          {rows.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted">{o.noResults}</p>
          ) : (
            <>
              {/* Tools for the selected orders: what makes sense in this sub-section */}
              <div className="space-y-3 border-b border-line bg-panel-2/50 p-3">
                <SelectionTools t={t} showCount={!(managers && !shipping)} />
                {f.view === "ship" && <ShipPanel lang={lang} accounts={accounts} deliveryHref={deliveryHref} t={t} />}
                {f.view === "transit" && <TrackPanel lang={lang} t={t} />}
                {f.view === "returns" && <ReturnsPanel lang={lang} t={t} />}
              </div>
              {managers && !shipping && <BulkAssignBar lang={lang} members={members} t={{ orders: t.orders, errors: t.errors }} />}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted">
                    <tr className="border-b border-line">
                      <th className="w-10 p-3">
                        <SelectAllOrders label={o.bulk.selectAll} />
                      </th>
                      <th className="p-3 text-start font-medium">{o.columns.order}</th>
                      <th className="p-3 text-start font-medium">{o.columns.customer}</th>
                      <th className="hidden p-3 text-start font-medium lg:table-cell">{o.columns.product}</th>
                      <th className="hidden p-3 text-start font-medium md:table-cell">{o.columns.wilaya}</th>
                      {shipping && <th className="p-3 text-start font-medium">{f.view === "ship" ? o.extraColumns.carrier : o.extraColumns.stage}</th>}
                      {managers && !shipping && <th className="hidden p-3 text-start font-medium xl:table-cell">{o.columns.assignee}</th>}
                      <th className="p-3 text-start font-medium">{o.columns.total}</th>
                      {!shipping && <th className="p-3 text-start font-medium">{o.columns.status}</th>}
                      <th className="hidden p-3 text-start font-medium sm:table-cell">{o.columns.date}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="relative border-b border-line last:border-0 hover:bg-panel-2/40" data-order={r.number} data-risk={r.risk}>
                        <td className="p-3">
                          <input type="checkbox" data-bulk-order data-number={r.number} value={r.id} disabled={r.locked} aria-label={`${o.bulk.select} #${r.number}`} className="relative z-10 size-4 accent-[var(--color-accent)]" />
                        </td>
                        <td className="p-3 font-bold whitespace-nowrap">
                          {/* The whole row opens the order */}
                          <Link href={`${orderBase}/${r.id}`} className="after:absolute after:inset-0">
                            #{r.number}
                          </Link>
                        </td>
                        <td className="p-3">
                          {r.locked ? (
                            <span className="flex items-center gap-1.5 text-sm font-semibold text-warning" data-locked>
                              <Lock size={14} /> {o.locked.short}
                            </span>
                          ) : (
                            <>
                              <span className="flex items-center gap-1.5 font-semibold">
                                {r.customerName}
                                {r.risk >= riskThreshold && (
                                  <span className="inline-flex items-center gap-0.5 rounded-full bg-warning/10 px-1.5 py-0.5 text-[11px] font-semibold text-warning" data-testid="risk-badge">
                                    <ShieldAlert size={12} /> {fmt(o.risk.badge, { n: r.risk })}
                                  </span>
                                )}
                              </span>
                              <span className="block text-xs text-muted" dir="ltr">
                                {r.phone}
                              </span>
                            </>
                          )}
                        </td>
                        <td className="hidden max-w-56 truncate p-3 text-muted lg:table-cell">{r.product}</td>
                        <td className="hidden p-3 whitespace-nowrap text-muted md:table-cell">
                          {wilayaName(r.wilayaCode, lang)}
                          <span className="block text-xs">{r.deliveryType === "office" ? o.filters.office : o.filters.home}</span>
                        </td>
                        {shipping && (
                          <td className="p-3">
                            {r.shipmentId ? (
                              <>
                                <span className="flex flex-wrap items-center gap-1">
                                  <Badge tone={shipmentTone[r.stage!]}>{t.delivery.statuses[r.stage!]}</Badge>
                                  {f.view === "returns" && r.status === "returned" && (
                                    <Badge tone={r.returnReceivedAt ? "accent" : "warning"}>{r.returnReceivedAt ? o.returns.states.received : o.returns.states.pending}</Badge>
                                  )}
                                </span>
                                <span className="mt-1 flex items-center gap-2 text-xs text-muted">
                                  {r.carrierName}
                                  <span dir="ltr">{r.trackingNumber}</span>
                                  {r.labelHref && (
                                    <a href={r.labelHref} target="_blank" rel="noreferrer" className="relative z-10 inline-flex items-center gap-0.5 font-semibold text-accent hover:underline" data-testid="row-label">
                                      <FileText size={12} /> {o.track.label}
                                    </a>
                                  )}
                                </span>
                              </>
                            ) : (
                              <span className="text-xs text-muted">—</span>
                            )}
                          </td>
                        )}
                        {managers && !shipping && <td className="hidden p-3 whitespace-nowrap text-muted xl:table-cell">{r.assigneeName ?? "—"}</td>}
                        <td className="p-3 font-semibold whitespace-nowrap">{formatPrice(r.total, t.common.currency)}</td>
                        {!shipping && (
                          <td className="p-3">
                            <Badge tone={statusTone[r.status]}>{o.statuses[r.status]}</Badge>
                          </td>
                        )}
                        <td className="hidden p-3 text-xs whitespace-nowrap text-muted sm:table-cell">{formatDate(r.createdAt, lang)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {total > size && (
            <div className="flex items-center justify-between border-t border-line p-4 text-sm text-muted">
              <span>{fmt(t.common.showing, { from: (f.page - 1) * size + 1, to: Math.min(f.page * size, total), total })}</span>
              <div className="flex gap-2">
                {f.page > 1 && (
                  <Link href={href({ page: f.page - 1 })} className={buttonClass("secondary")}>
                    {t.common.previous}
                  </Link>
                )}
                {f.page * size < total && (
                  <Link href={href({ page: f.page + 1 })} className={buttonClass("secondary")}>
                    {t.common.next}
                  </Link>
                )}
              </div>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
