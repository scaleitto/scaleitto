import Link from "next/link";
import { ExternalLink, Search, ShoppingCart } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { sectionHref } from "@/lib/permissions";
import { fmt, formatDate, formatPrice } from "@/lib/format";
import { wilayaName } from "@/lib/wilayas";
import { Badge, Card, EmptyState, PageHeader, buttonClass, inputClass } from "@/ui";
import { PAGE_SIZE, listOrders, statusCounts } from "./queries";
import { orderStatuses, statusTone, type OrderStatus } from "./statuses";

// Orders / Abandoned carts switch shown on both pages.
export function OrdersTabs({ lang, t, current }: { lang: string; t: Dictionary; current: "orders" | "abandoned" }) {
  const base = sectionHref(lang, "orders");
  const tabs = [
    { key: "orders", href: base, label: t.orders.tabs.orders },
    { key: "abandoned", href: `${base}/abandoned`, label: t.orders.tabs.abandoned },
  ] as const;
  return (
    <nav className="mb-5 flex gap-6 border-b border-line text-sm">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={current === tab.key ? "page" : undefined}
          className={`-mb-px border-b-2 pb-2.5 font-semibold ${current === tab.key ? "border-accent text-accent" : "border-transparent text-muted hover:text-fg"}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export async function OrderList({ lang, t, shopId, storeHref, q, status, page }: { lang: string; t: Dictionary; shopId: string; storeHref: string; q: string; status?: OrderStatus; page: number }) {
  const o = t.orders;
  const base = sectionHref(lang, "orders");
  const [{ rows, total }, counts] = await Promise.all([listOrders(shopId, { q, status, page }), statusCounts(shopId)]);
  const all = Object.values(counts).reduce((a, b) => a + b, 0);
  const href = (patch: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, status, page, ...patch })) if (v && !(k === "page" && v === 1)) params.set(k, String(v));
    const s = params.toString();
    return s ? `${base}?${s}` : base;
  };

  return (
    <>
      <PageHeader
        title={t.sections.orders.title}
        description={t.sections.orders.description}
        actions={
          <a href={storeHref} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
            <ExternalLink size={16} /> {o.openStore}
          </a>
        }
      />
      <OrdersTabs lang={lang} t={t} current="orders" />

      {all === 0 ? (
        <EmptyState icon={<ShoppingCart size={40} />} title={o.emptyTitle}>
          <p>{o.emptyBody}</p>
        </EmptyState>
      ) : (
        <Card className="p-0">
          <div className="space-y-3 border-b border-line p-4">
            <nav className="flex gap-1 overflow-x-auto pb-1 text-sm" aria-label={o.columns.status}>
              {([undefined, ...orderStatuses] as const).map((s) => {
                const n = s ? (counts[s] ?? 0) : all;
                return (
                  <Link
                    key={s ?? "all"}
                    href={href({ status: s, page: 1 })}
                    aria-current={status === s ? "page" : undefined}
                    className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${status === s ? "bg-panel-2 text-fg" : "text-muted hover:text-fg"}`}
                  >
                    {s ? o.statuses[s] : o.all}
                    <span className="rounded-full bg-bg px-1.5 text-xs">{n}</span>
                  </Link>
                );
              })}
            </nav>
            <form action={base} className="relative sm:w-80">
              {status && <input type="hidden" name="status" value={status} />}
              <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
              <input type="search" name="q" defaultValue={q} placeholder={o.search} aria-label={o.search} className={`${inputClass} ps-9`} />
            </form>
          </div>

          {rows.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted">{o.noResults}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted">
                  <tr className="border-b border-line">
                    <th className="p-3 text-start font-medium">{o.columns.order}</th>
                    <th className="p-3 text-start font-medium">{o.columns.customer}</th>
                    <th className="hidden p-3 text-start font-medium lg:table-cell">{o.columns.product}</th>
                    <th className="hidden p-3 text-start font-medium md:table-cell">{o.columns.wilaya}</th>
                    <th className="p-3 text-start font-medium">{o.columns.total}</th>
                    <th className="p-3 text-start font-medium">{o.columns.status}</th>
                    <th className="hidden p-3 text-start font-medium sm:table-cell">{o.columns.date}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="relative border-b border-line last:border-0 hover:bg-panel-2/40" data-order={r.number}>
                      <td className="p-3 font-bold whitespace-nowrap">
                        {/* The whole row opens the order */}
                        <Link href={`${base}/${r.id}`} className="after:absolute after:inset-0">
                          #{r.number}
                        </Link>
                      </td>
                      <td className="p-3">
                        <span className="block font-semibold">{r.customerName}</span>
                        <span className="block text-xs text-muted" dir="ltr">
                          {r.phone}
                        </span>
                      </td>
                      <td className="hidden max-w-56 truncate p-3 text-muted lg:table-cell">{r.product}</td>
                      <td className="hidden p-3 whitespace-nowrap text-muted md:table-cell">{wilayaName(r.wilayaCode, lang)}</td>
                      <td className="p-3 font-semibold whitespace-nowrap">{formatPrice(r.total, t.common.currency)}</td>
                      <td className="p-3">
                        <Badge tone={statusTone[r.status]}>{o.statuses[r.status]}</Badge>
                      </td>
                      <td className="hidden p-3 text-xs whitespace-nowrap text-muted sm:table-cell">{formatDate(r.createdAt, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-line p-4 text-sm text-muted">
              <span>{fmt(t.common.showing, { from: (page - 1) * PAGE_SIZE + 1, to: Math.min(page * PAGE_SIZE, total), total })}</span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={href({ page: page - 1 })} className={buttonClass("secondary")}>
                    {t.common.previous}
                  </Link>
                )}
                {page * PAGE_SIZE < total && (
                  <Link href={href({ page: page + 1 })} className={buttonClass("secondary")}>
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
