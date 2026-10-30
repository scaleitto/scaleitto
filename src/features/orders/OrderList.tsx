import Link from "next/link";
import { FileText, Lock, Search, ShieldAlert, ShoppingCart } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { sectionHref } from "@/lib/permissions";
import { fmt, formatDate, formatPrice } from "@/lib/format";
import { wilayaName, wilayas } from "@/lib/wilayas";
import type { ParcelDefaults } from "@/lib/enums";
import { deliveryFaults, deliveryStates, processingStates } from "@/server/db/schema";
import { Badge, Card, EmptyState, PageHeader, buttonClass, inputClass } from "@/ui";
import { listOrders, modelCounts, returnCounts, riskCount, stageCounts, statusCounts } from "./queries";
import { callStatuses, deliveryOrder, orderModel, statusTone } from "./statuses";
import { injectionStates, pageSizes, returnStates, stageNames, trackingStages, type OrderFilters, type OrderView } from "./views";
import type { OrderViewer } from "./access";
import { SelectAllOrders } from "./BulkAssign";
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
  const [{ rows, total, size }, model, counts, risky, stages, returns] = await Promise.all([
    listOrders(viewer, f, riskThreshold),
    section === "orders" ? modelCounts(viewer) : Promise.resolve(null),
    statusCounts(viewer),
    riskCount(viewer, riskThreshold),
    f.view === "transit" ? stageCounts(viewer) : Promise.resolve(null),
    f.view === "returns" ? returnCounts(viewer) : Promise.resolve(null),
  ]);
  const all = Object.values(counts).reduce((a, b) => a + b, 0);
  const href = (patch: Partial<Record<keyof OrderFilters, string | number | undefined>>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, ...patch })) {
      if (v === undefined || v === "" || (k === "page" && v === 1) || (k === "size" && v === pageSizes[0]) || (k === "view" && (v === "all" || section !== "orders"))) continue;
      params.set(k, String(v));
    }
    const s = params.toString();
    return s ? `${base}?${s}` : base;
  };
  const shipping = section !== "orders";
  const managers = members.length > 0;
  const filtered = Boolean(f.q || f.wilaya || f.delivery || f.from || f.to || f.assignee || f.ds);
  const reset = { status: undefined, stage: undefined, ret: undefined, inj: undefined, ds: undefined, fault: undefined, proc: undefined, fin: undefined, page: 1 } as const;

  // One row of chips per sub-section. The orders list: the five sections of the order page (same names, same order),
  // only the values that have orders; the other lists: injection (send), the courier's stage (tracking), the return's state
  type Chip = { key: string; label: string; sub?: string; n: number; active: boolean; href: string; warn?: boolean };
  type Group = { key: string; title?: string; chips: Chip[] };
  const nonZero = (list: Chip[]) => list.filter((c) => c.n > 0);
  const f2 = o.followup;
  const groups: Group[] =
    section === "orders" && model
      ? [
          {
            key: "all",
            chips: [
              { key: "all", label: o.all, n: all, active: f.view === "all" && !Object.values({ ...f, view: undefined, q: undefined, page: undefined, size: undefined, wilaya: undefined, delivery: undefined, from: undefined, to: undefined, assignee: undefined }).some(Boolean), href: href({ ...reset, view: "all" }) },
              ...(risky > 0 ? [{ key: "risk", label: o.views.risk, n: risky, active: f.view === "risk", href: href({ ...reset, view: "risk" }), warn: true }] : []),
            ],
          },
          { key: "call", title: o.model.titles.call, chips: nonZero(callStatuses.map((s) => ({ key: `call-${s}`, label: o.statuses[s], n: model.call[s] ?? 0, active: f.status === s, href: href({ ...reset, view: "all", status: s }) }))) },
          { key: "injection", title: o.model.titles.injection, chips: nonZero(injectionStates.map((k) => ({ key: `inj-${k}`, label: o.injection[k], n: model.injection[k] ?? 0, active: f.view === "all" && f.inj === k, href: href({ ...reset, view: "all", inj: k }) }))) },
          { key: "delivery", title: o.model.titles.delivery, chips: nonZero(deliveryOrder.map((k) => ({ key: `ds-${k}`, label: f2.states[k], n: model.delivery[k] ?? 0, active: f.ds === k, href: href({ ...reset, view: "all", ds: k }) }))) },
          { key: "fault", title: o.model.titles.fault, chips: nonZero(deliveryFaults.map((k) => ({ key: `fault-${k}`, label: f2.faults[k], n: model.fault[k] ?? 0, active: f.fault === k, href: href({ ...reset, view: "all", fault: k }) }))) },
          { key: "processing", title: o.model.titles.processing, chips: nonZero(processingStates.map((k) => ({ key: `proc-${k}`, label: f2.processingStates[k], n: model.processing[k] ?? 0, active: f.proc === k, href: href({ ...reset, view: "all", proc: k }) }))) },
          { key: "final", title: o.model.titles.final, chips: nonZero((["delivered", "returned"] as const).map((k) => ({ key: `fin-${k}`, label: f2.states[k], n: model.final[k] ?? 0, active: f.fin === k, href: href({ ...reset, view: "all", fin: k }) }))) },
        ].filter((g) => g.chips.length > 0)
      : section === "shipping"
        ? [{ key: "inj", chips: injectionStates.map((k) => ({ key: k, label: o.injection[k], n: (k === "done" ? counts.shipped : counts.confirmed) ?? 0, active: (f.inj ?? "pending") === k, href: href({ ...reset, inj: k === "pending" ? undefined : k }) })) }]
        : section === "tracking" && stages
          ? [
              {
                key: "stages",
                chips: [
                  { key: "all", label: o.filters.allStages, n: stages.all, active: !f.stage, href: href(reset) },
                  ...trackingStages.map((k) => ({ key: k, label: stageNames[k], sub: lang === "fr" ? undefined : o.stageLabels[k], n: stages[k] ?? 0, active: f.stage === k, href: href({ ...reset, stage: k }) })),
                ],
              },
            ]
          : returns
            ? [
                {
                  key: "returns",
                  chips: [
                    { key: "all", label: o.filters.allStages, n: returns.back + returns.pending + returns.received, active: !f.ret, href: href(reset) },
                    ...returnStates.map((r) => ({ key: r, label: o.returns.states[r], n: returns[r], active: f.ret === r, href: href({ ...reset, ret: r }) })),
                  ],
                },
              ]
            : [];
  const chip = (active: boolean) => `flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 font-medium transition ${active ? "border-accent/40 bg-accent/10 text-accent" : "border-line text-muted hover:border-accent/30 hover:text-fg"}`;

  return (
    <>
      <PageHeader title={t.sections[section].title} description={t.sections[section].description} />
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
            <div className="space-y-2 text-sm" data-testid="order-chips" data-section={section}>
              {groups.map((g) => (
                <div key={g.key} className="flex flex-wrap items-center gap-1.5" data-group={g.key}>
                  {g.title && <span className="me-1 w-full text-xs font-semibold text-muted sm:w-40 sm:shrink-0">{g.title}</span>}
                  {g.chips.map((c) => (
                    <Link key={c.key} href={c.href} aria-current={c.active ? "page" : undefined} className={chip(c.active)} data-chip={c.key}>
                      {c.key === "risk" && <ShieldAlert size={14} className="text-warning" />}
                      <span className="flex flex-col leading-tight">
                        <span dir={c.sub ? "ltr" : undefined}>{c.label}</span>
                        {c.sub && <span className="text-[11px] font-normal opacity-80">{c.sub}</span>}
                      </span>
                      <span className={`rounded-full px-1.5 text-xs tabular-nums ${c.warn ? "bg-warning/10 text-warning" : "bg-bg"}`}>{c.n}</span>
                    </Link>
                  ))}
                </div>
              ))}
            </div>

            <form action={base} className="flex flex-wrap gap-2" data-testid="order-filters">
              {section === "orders" && f.view !== "all" && <input type="hidden" name="view" value={f.view} />}
              {f.ret && <input type="hidden" name="ret" value={f.ret} />}
              {f.inj && <input type="hidden" name="inj" value={f.inj} />}
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
              {/* Livraison: the delivery follow-up of sent parcels */}
              {(section === "tracking" || section === "returns") && (
                <select name="ds" defaultValue={f.ds ?? ""} aria-label={o.followup.state} className={filterSelect} data-testid="filter-ds">
                  <option value="">{o.followup.state}</option>
                  {deliveryStates.map((d) => (
                    <option key={d} value={d}>
                      {o.followup.states[d]}
                    </option>
                  ))}
                </select>
              )}
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
                <Link href={href({ q: undefined, wilaya: undefined, delivery: undefined, from: undefined, to: undefined, assignee: undefined, ds: undefined, page: 1 })} className={buttonClass("ghost")}>
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
                <SelectionTools t={t} showCount />
                {f.view === "ship" && <ShipPanel lang={lang} accounts={accounts} deliveryHref={deliveryHref} t={t} />}
                {f.view === "transit" && <TrackPanel lang={lang} t={t} />}
                {f.view === "returns" && <ReturnsPanel lang={lang} t={t} />}
              </div>
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
                                  {/* Livraison / Remarque / Traitement */}
                                  {f.view !== "ship" && r.deliveryState && r.deliveryState !== "shipped" && (
                                    <span data-ds={r.deliveryState}>
                                      <Badge tone={r.deliveryState === "delivered" ? "accent" : r.deliveryState === "returned" ? "danger" : "warning"}>{o.followup.states[r.deliveryState]}</Badge>
                                    </span>
                                  )}
                                  {r.deliveryFault && <Badge>{o.followup.faults[r.deliveryFault]}</Badge>}
                                  {r.processing && <Badge tone="info">{o.followup.processingStates[r.processing]}</Badge>}
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
                            {/* The same names as the order page: the call status, then the delivery once sent */}
                            <span className="flex flex-wrap items-center gap-1" data-status={orderModel(r).call}>
                              <Badge tone={statusTone[orderModel(r).call]}>{o.statuses[orderModel(r).call]}</Badge>
                              {r.deliveryState && <Badge tone={r.deliveryState === "delivered" ? "accent" : r.deliveryState === "returned" ? "danger" : "info"}>{o.followup.states[r.deliveryState]}</Badge>}
                              {r.callAttempts > 0 && !r.deliveryState && (
                                <span className="text-[11px] text-muted tabular-nums" title={fmt(o.model.calls, { n: r.callAttempts })} data-calls={r.callAttempts}>
                                  📞{r.callAttempts}
                                </span>
                              )}
                            </span>
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
