import Link from "next/link";
import { ImageOff, Package, Plus, Search } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { sectionHref } from "@/lib/permissions";
import { fmt, formatDate, formatPrice } from "@/lib/format";
import { Alert, Badge, Card, EmptyState, PageHeader, buttonClass, inputClass } from "@/ui";
import { PAGE_SIZE, listProducts } from "./queries";
import { ProductActions } from "./ProductActions";
import type { ProductStatus } from "./types";

export async function ProductList({ lang, t, shopId, q, status, page, created }: { lang: string; t: Dictionary; shopId: string; q: string; status?: ProductStatus; page: number; created: boolean }) {
  const p = t.products;
  const base = sectionHref(lang, "products");
  const { rows, total } = await listProducts(shopId, { q, status, page });
  const href = (patch: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q, status, page, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "page" && v === 1)) params.set(k, String(v));
    const s = params.toString();
    return s ? `${base}?${s}` : base;
  };
  const filtered = Boolean(q || status);
  const rowText = { products: t.products, errors: t.errors, common: t.common };

  return (
    <>
      <PageHeader
        title={t.sections.products.title}
        description={t.sections.products.description}
        actions={
          <Link href={`${base}/new`} className={buttonClass("primary")}>
            <Plus size={16} /> {p.add}
          </Link>
        }
      />
      {created && (
        <div className="mb-4">
          <Alert variant="success">{p.created}</Alert>
        </div>
      )}

      {total === 0 && !filtered ? (
        <EmptyState icon={<Package size={40} />} title={p.emptyTitle}>
          <p>{p.emptyBody}</p>
          <Link href={`${base}/new`} className={buttonClass("primary", "mt-4")}>
            <Plus size={16} /> {p.add}
          </Link>
        </EmptyState>
      ) : (
        <Card className="p-0">
          <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
            <nav className="flex gap-1 rounded-lg bg-bg p-1 text-sm" aria-label={p.columns.status}>
              {([undefined, "active", "draft"] as const).map((s) => (
                <Link
                  key={s ?? "all"}
                  href={href({ status: s, page: 1 })}
                  aria-current={status === s ? "page" : undefined}
                  className={`rounded-md px-3 py-1.5 font-medium ${status === s ? "bg-panel-2 text-fg" : "text-muted hover:text-fg"}`}
                >
                  {s ? p.statuses[s] : p.all}
                </Link>
              ))}
            </nav>
            <form action={base} className="relative ms-auto w-full sm:w-72">
              {status && <input type="hidden" name="status" value={status} />}
              <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
              <input type="search" name="q" defaultValue={q} placeholder={p.search} aria-label={p.search} className={`${inputClass} ps-9`} />
            </form>
          </div>

          {rows.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted">{p.noResults}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted">
                  <tr className="border-b border-line">
                    {(["product", "price", "oldPrice", "published", "stock", "units", "status"] as const).map((k) => (
                      <th key={k} className={`p-3 text-start font-medium ${k === "product" ? "ps-4" : "hidden md:table-cell"}`}>
                        {p.columns[k]}
                      </th>
                    ))}
                    <th className="p-3 text-end font-medium">{p.columns.action}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-0 hover:bg-panel-2/40" data-product={r.name}>
                      <td className="p-3 ps-4">
                        <Link href={`${base}/${r.id}`} className="flex items-center gap-3">
                          <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-bg">
                            {r.images[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={r.images[0]} alt="" className="size-full object-cover" />
                            ) : (
                              <ImageOff size={18} className="text-muted" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-fg">{r.name}</span>
                            <span className="block text-xs text-muted">
                              {[r.sku, r.variantCount ? fmt(p.variantsCount, { n: r.variantCount }) : null].filter(Boolean).join(" · ")}
                            </span>
                            <span className="mt-0.5 block text-xs font-semibold text-fg md:hidden">{formatPrice(r.price, t.common.currency)}</span>
                            {r.status === "draft" && (
                              <span className="mt-1 block md:hidden">
                                <Badge>{p.statuses.draft}</Badge>
                              </span>
                            )}
                          </span>
                        </Link>
                      </td>
                      <td className="hidden p-3 font-semibold whitespace-nowrap tabular-nums md:table-cell" data-col="price">
                        {formatPrice(r.price, t.common.currency)}
                      </td>
                      <td className="hidden p-3 whitespace-nowrap text-muted tabular-nums md:table-cell" data-col="oldPrice">
                        {r.compareAtPrice ? <span className="line-through">{formatPrice(r.compareAtPrice, t.common.currency)}</span> : "—"}
                      </td>
                      <td className="hidden p-3 whitespace-nowrap text-muted md:table-cell">
                        {formatDate(r.createdAt, lang)}
                      </td>
                      <td className="hidden p-3 whitespace-nowrap md:table-cell" data-col="stock">
                        {!r.trackStock ? <span className="text-muted">{p.notTracked}</span> : r.totalStock > 0 ? <span className="tabular-nums">{r.totalStock}</span> : <Badge tone="danger">{p.outOfStock}</Badge>}
                      </td>
                      <td className="hidden p-3 tabular-nums md:table-cell" data-col="units">
                        {r.units}
                      </td>
                      <td className="hidden p-3 md:table-cell">
                        <Badge tone={r.status === "active" ? "accent" : "neutral"}>{p.statuses[r.status]}</Badge>
                      </td>
                      <td className="p-2 sm:p-3">
                        <ProductActions lang={lang} id={r.id} status={r.status} editHref={`${base}/${r.id}`} t={rowText} />
                      </td>
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
