import Link from "next/link";
import { Boxes, History, Search } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { fmt, formatDate, formatPrice, formatTime } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader, buttonClass, inputClass } from "@/ui";
import { inventory, movements } from "@/features/inventory/queries";
import { stockTotals } from "@/features/inventory/stock";
import { AdjustStock, LowStockForm } from "@/features/inventory/components";
import { adjustStock, setLowStock } from "@/features/inventory/actions";

const stateTone = { out: "danger", low: "warning", ok: "accent" } as const;

// Inventory: what is in stock (per product / variant), what open orders hold, its value, alerts, and every movement
export default async function InventoryPage({ params, searchParams }: PageProps<"/[lang]/dashboard/inventory">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const s = t.inventory;
  const { shop } = await requireSection(lang, "inventory");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const tab = one(sp.tab) === "history" ? "history" : "stock";
  const base = sectionHref(lang, "inventory");
  const text = { inventory: t.inventory, errors: t.errors, common: t.common };
  const tabClass = (active: boolean) => `-mb-px flex items-center gap-1.5 border-b-2 px-2.5 pb-2.5 font-semibold ${active ? "border-accent text-accent" : "border-transparent text-muted hover:text-fg"}`;

  const header = (
    <>
      <PageHeader title={t.sections.inventory.title} description={t.sections.inventory.description} />
      <nav className="mb-5 flex gap-1 border-b border-line text-sm" data-testid="inventory-tabs">
        <Link href={base} aria-current={tab === "stock" ? "page" : undefined} className={tabClass(tab === "stock")}>
          <Boxes size={15} /> {s.tabs.stock}
        </Link>
        <Link href={`${base}?tab=history`} aria-current={tab === "history" ? "page" : undefined} className={tabClass(tab === "history")} data-testid="inventory-history-tab">
          <History size={15} /> {s.tabs.history}
        </Link>
      </nav>
    </>
  );

  if (tab === "history") {
    const productId = one(sp.product) || undefined;
    const rows = await movements(shop.id, productId);
    const c = s.historyColumns;
    return (
      <>
        {header}
        {productId && (
          <Link href={`${base}?tab=history`} className="mb-3 inline-block text-sm font-semibold text-accent hover:underline">
            {s.allHistory}
          </Link>
        )}
        {rows.length === 0 ? (
          <EmptyState icon={<History size={40} />} title={s.historyEmpty} />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm" data-testid="movements">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="p-3 text-start font-medium">{c.date}</th>
                  <th className="p-3 text-start font-medium">{c.product}</th>
                  <th className="p-3 text-start font-medium">{c.change}</th>
                  <th className="p-3 text-start font-medium">{c.reason}</th>
                  <th className="hidden p-3 text-start font-medium md:table-cell">{c.by}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="border-b border-line last:border-0" data-movement={m.reason}>
                    <td className="p-3 text-xs whitespace-nowrap text-muted">
                      {formatDate(m.createdAt, lang)} {formatTime(m.createdAt, lang)}
                    </td>
                    <td className="p-3">
                      <span className="font-medium">{m.productName ?? "—"}</span>
                      {m.variantTitle && <span className="block text-xs text-muted">{m.variantTitle}</span>}
                    </td>
                    <td className={`p-3 font-bold tabular-nums ${m.delta > 0 ? "text-accent" : "text-danger"}`} dir="ltr" data-delta={m.delta}>
                      {m.delta > 0 ? `+${m.delta}` : m.delta}
                    </td>
                    <td className="p-3">
                      {s.reasons[m.reason]}
                      {m.orderNumber && (
                        <Link href={`${sectionHref(lang, "orders")}/${m.orderId}`} className="ms-1 font-semibold text-accent hover:underline">
                          #{m.orderNumber}
                        </Link>
                      )}
                      {m.note && <span className="block text-xs text-muted">{m.note}</span>}
                    </td>
                    <td className="hidden p-3 text-muted md:table-cell">{m.userName ?? s.auto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </>
    );
  }

  const { rows: all, lowStock, untracked } = await inventory(shop.id);
  const totals = stockTotals(all);
  const state = one(sp.state);
  const q = one(sp.q).trim().toLowerCase();
  const rows = all.filter((r) => (state === "low" || state === "out" ? r.state === state : true) && (!q || r.name.toLowerCase().includes(q) || (r.sku ?? "").toLowerCase().includes(q) || (r.variant ?? "").toLowerCase().includes(q)));
  const c = s.columns;
  const cards = [
    ["units", s.cards.units, totals.units],
    ["held", s.cards.held, totals.held],
    ["value", s.cards.value, formatPrice(totals.value, t.common.currency)],
    ["low", s.cards.low, totals.low],
    ["out", s.cards.out, totals.out],
  ] as const;
  const filterHref = (v?: string) => (v ? `${base}?state=${v}` : base);

  return (
    <>
      {header}
      {all.length === 0 ? (
        <EmptyState icon={<Boxes size={40} />} title={s.empty}>
          <p>{s.emptyHint}</p>
        </EmptyState>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5" data-testid="inventory-cards">
            {cards.map(([key, label, value]) => (
              <Card key={key} className="space-y-1 p-4" data-card={key}>
                <p className="text-xs text-muted">{label}</p>
                <p className={`text-2xl font-bold tabular-nums ${key === "out" && totals.out ? "text-danger" : key === "low" && totals.low ? "text-warning" : ""}`} data-value>
                  {value}
                </p>
              </Card>
            ))}
          </div>
          {totals.valueMissing && <p className="-mt-2 mb-4 text-xs text-muted">{s.valueMissing}</p>}
          <Card className="p-0">
            <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
              <nav className="flex gap-1 text-sm">
                {([undefined, "low", "out"] as const).map((v) => (
                  <Link key={v ?? "all"} href={filterHref(v)} aria-current={(state || undefined) === v ? "page" : undefined} className={`rounded-md px-3 py-1.5 font-medium ${(state || undefined) === v ? "bg-panel-2 text-fg" : "text-muted hover:text-fg"}`} data-filter={v ?? "all"}>
                    {s.filters[v ?? "all"]}
                  </Link>
                ))}
              </nav>
              <form action={base} className="relative ms-auto w-full sm:w-64">
                {state && <input type="hidden" name="state" value={state} />}
                <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
                <input type="search" name="q" defaultValue={q} placeholder={s.search} aria-label={s.search} className={`${inputClass} ps-9`} />
              </form>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="stock-table">
                <thead className="text-xs text-muted">
                  <tr className="border-b border-line">
                    <th className="p-3 text-start font-medium">{c.product}</th>
                    <th className="hidden p-3 text-start font-medium md:table-cell">{c.sku}</th>
                    <th className="p-3 text-start font-medium">{c.stock}</th>
                    <th className="hidden p-3 text-start font-medium sm:table-cell" title={s.heldHint}>
                      {c.held}
                    </th>
                    <th className="hidden p-3 text-start font-medium lg:table-cell">{c.value}</th>
                    <th className="p-3 text-start font-medium">{c.state}</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className="border-b border-line last:border-0" data-stock={r.variant ? `${r.name} / ${r.variant}` : r.name}>
                      <td className="p-3">
                        <span className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {r.image ? <img src={r.image} alt="" className="size-10 shrink-0 rounded-lg object-cover" /> : <span className="size-10 shrink-0 rounded-lg bg-panel-2" />}
                          <span className="min-w-0">
                            <Link href={`${base}?tab=history&product=${r.productId}`} className="font-semibold hover:text-accent" title={s.productHistory}>
                              {r.name}
                            </Link>
                            {r.variant && <span className="block text-xs text-muted">{r.variant}</span>}
                          </span>
                        </span>
                      </td>
                      <td className="hidden p-3 text-xs text-muted md:table-cell" dir="ltr">
                        {r.sku ?? "—"}
                      </td>
                      <td className="p-3 text-base font-bold tabular-nums" data-qty={r.stock}>
                        {r.stock}
                      </td>
                      <td className="hidden p-3 text-muted tabular-nums sm:table-cell">{r.held || "—"}</td>
                      <td className="hidden p-3 text-muted tabular-nums lg:table-cell">{r.value == null ? "—" : formatPrice(r.value, t.common.currency)}</td>
                      <td className="p-3">
                        <Badge tone={stateTone[r.state]}>{s.states[r.state]}</Badge>
                      </td>
                      <td className="p-2 text-end">
                        <AdjustStock line={{ productId: r.productId, variantId: r.variantId, name: r.variant ? `${r.name} / ${r.variant}` : r.name, stock: r.stock }} action={adjustStock.bind(null, lang)} t={text} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <LowStockForm value={lowStock} action={setLowStock.bind(null, lang)} t={text} />
            {untracked > 0 && (
              <p className="text-sm text-muted">
                {fmt(s.untracked, { n: untracked })}{" "}
                <Link href={sectionHref(lang, "products")} className={buttonClass("ghost", "px-1 py-0")}>
                  {t.subnav.products}
                </Link>
              </p>
            )}
          </div>
        </>
      )}
    </>
  );
}
