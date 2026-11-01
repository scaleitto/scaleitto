import Link from "next/link";
import { ImageOff, Package, Plus } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { sectionHref } from "@/lib/permissions";
import { fmt, formatDate, formatPrice } from "@/lib/format";
import { Alert, Badge, Card, EmptyState, PageHeader, buttonClass } from "@/ui";
import { storeUrl } from "@/lib/urls";
import { PAGE_SIZE, listProducts } from "./queries";
import { ProductActions } from "./ProductActions";

export async function ProductList({ lang, t, shop, page, created }: { lang: string; t: Dictionary; shop: { id: string; slug: string; customDomain?: string | null; domainVerifiedAt?: Date | null }; page: number; created: boolean }) {
  const p = t.products;
  const base = sectionHref(lang, "products");
  const store = storeUrl(shop);
  const { rows, total } = await listProducts(shop.id, page);
  const href = (n: number) => (n > 1 ? `${base}?page=${n}` : base);
  const rowText = { products: t.products, errors: t.errors, common: t.common };

  // Zimam's list: the title and "Add product", then one table (no tabs or search)
  return (
    <>
      <PageHeader
        title={t.sections.products.title}
        actions={
          <Link href={`${base}/new`} className={buttonClass("primary", "h-12 px-6 text-base")}>
            <Plus size={18} /> {p.add}
          </Link>
        }
      />
      {created && (
        <div className="mb-4">
          <Alert variant="success">{p.created}</Alert>
        </div>
      )}

      {total === 0 ? (
        <EmptyState icon={<Package size={40} />} title={p.emptyTitle}>
          <p>{p.emptyBody}</p>
          <Link href={`${base}/new`} className={buttonClass("primary", "mt-4")}>
            <Plus size={16} /> {p.add}
          </Link>
        </EmptyState>
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted uppercase">
                <tr className="border-b border-line">
                  {(["product", "price", "oldPrice", "published", "stock", "units", "status"] as const).map((k) => (
                    <th key={k} className={`p-3 text-start font-semibold ${k === "product" ? "ps-4" : "hidden md:table-cell"}`}>
                      {p.columns[k]}
                    </th>
                  ))}
                  <th className="p-3 pe-4 text-end font-semibold">{p.columns.action}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0 hover:bg-panel-2/40" data-product={r.name}>
                    <td className="p-3 ps-4">
                      <Link href={`${base}/${r.id}`} className="flex items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-bg">
                          {r.images[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.images[0]} alt="" className="size-full object-cover" />
                          ) : (
                            <ImageOff size={18} className="text-muted" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-fg">{r.name}</span>
                          <span className="mt-0.5 block text-xs font-semibold text-fg md:hidden">{formatPrice(r.price, t.common.currency)}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="hidden p-3 font-semibold whitespace-nowrap tabular-nums md:table-cell" data-col="price">
                      {formatPrice(r.price, t.common.currency)}
                    </td>
                    <td className="hidden p-3 whitespace-nowrap text-muted tabular-nums md:table-cell" data-col="oldPrice">
                      {r.compareAtPrice ? <span className="line-through">{formatPrice(r.compareAtPrice, t.common.currency)}</span> : null}
                    </td>
                    <td className="hidden p-3 whitespace-nowrap md:table-cell">{formatDate(r.createdAt, lang)}</td>
                    <td className="hidden p-3 whitespace-nowrap md:table-cell" data-col="stock">
                      {!r.trackStock ? <span className="text-muted">{p.notTracked}</span> : r.totalStock > 0 ? <span className="tabular-nums">{r.totalStock}</span> : <Badge tone="danger">{p.outOfStock}</Badge>}
                    </td>
                    <td className="hidden p-3 tabular-nums md:table-cell" data-col="units">
                      {r.units || null}
                    </td>
                    <td className="hidden p-3 md:table-cell">
                      <Badge tone={r.status === "active" ? "accent" : "neutral"}>{p.statuses[r.status]}</Badge>
                    </td>
                    <td className="p-2 pe-4 sm:p-3 sm:pe-4">
                      <ProductActions lang={lang} id={r.id} storeHref={`${store}/p/${r.slug}`} editHref={`${base}/${r.id}`} t={rowText} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-line p-4 text-sm text-muted">
              <span>{fmt(t.common.showing, { from: (page - 1) * PAGE_SIZE + 1, to: Math.min(page * PAGE_SIZE, total), total })}</span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={href(page - 1)} className={buttonClass("secondary")}>
                    {t.common.previous}
                  </Link>
                )}
                {page * PAGE_SIZE < total && (
                  <Link href={href(page + 1)} className={buttonClass("secondary")}>
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
