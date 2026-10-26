import Link from "next/link";
import { ShoppingBasket } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { fmt, formatDate } from "@/lib/format";
import { wilayaName } from "@/lib/wilayas";
import { Badge, Card, EmptyState, PageHeader, buttonClass } from "@/ui";
import { listLeads, PAGE_SIZE } from "@/features/orders/queries";
import { OrdersTabs } from "@/features/orders/OrderList";
import { LeadActions } from "@/features/orders/LeadActions";

export default async function AbandonedPage({ params, searchParams }: PageProps<"/[lang]/dashboard/orders/abandoned">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const o = t.orders;
  const { shop } = await requireSection(lang, "orders");
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const { rows, total } = await listLeads(shop.id, page);
  const base = `${sectionHref(lang, "orders")}/abandoned`;
  const text = { orders: t.orders, errors: t.errors, common: t.common };

  return (
    <>
      <PageHeader title={t.sections.orders.title} description={t.sections.orders.description} />
      <OrdersTabs lang={lang} t={t} current="abandoned" />
      <p className="mb-4 text-sm text-muted">{o.leadsHint}</p>
      {total === 0 ? (
        <EmptyState icon={<ShoppingBasket size={40} />} title={o.leadsEmpty} />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="p-3 text-start font-medium">{o.columns.customer}</th>
                  <th className="hidden p-3 text-start font-medium sm:table-cell">{o.columns.product}</th>
                  <th className="hidden p-3 text-start font-medium md:table-cell">{o.columns.wilaya}</th>
                  <th className="p-3 text-start font-medium">{o.columns.status}</th>
                  <th className="hidden p-3 text-start font-medium md:table-cell">{o.columns.date}</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0" data-lead={r.phone}>
                    <td className="p-3">
                      <span className="block font-semibold">{r.name || "—"}</span>
                      <span className="block text-xs text-muted" dir="ltr">
                        {r.phone}
                      </span>
                    </td>
                    <td className="hidden p-3 text-muted sm:table-cell">
                      {r.productName ?? "—"}
                      {r.variantTitle && ` · ${r.variantTitle}`} {fmt(o.quantityShort, { n: r.quantity })}
                    </td>
                    <td className="hidden p-3 text-muted md:table-cell">{r.wilayaCode ? wilayaName(r.wilayaCode, lang) : "—"}</td>
                    <td className="p-3">
                      <Badge tone={r.status === "contacted" ? "info" : "warning"}>{o.leadStatuses[r.status]}</Badge>
                    </td>
                    <td className="hidden p-3 text-xs whitespace-nowrap text-muted md:table-cell">{formatDate(r.updatedAt, lang)}</td>
                    <td className="p-2">
                      <LeadActions lang={lang} id={r.id} phone={r.phone} status={r.status as "abandoned" | "contacted"} t={text} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > PAGE_SIZE && (
            <div className="flex justify-end gap-2 border-t border-line p-4">
              {page > 1 && (
                <Link href={`${base}?page=${page - 1}`} className={buttonClass("secondary")}>
                  {t.common.previous}
                </Link>
              )}
              {page * PAGE_SIZE < total && (
                <Link href={`${base}?page=${page + 1}`} className={buttonClass("secondary")}>
                  {t.common.next}
                </Link>
              )}
            </div>
          )}
        </Card>
      )}
    </>
  );
}
