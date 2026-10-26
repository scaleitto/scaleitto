import Link from "next/link";
import { and, count, desc, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { getDictionary, asLocale } from "@/i18n";
import { requireManager } from "@/lib/auth";
import { storeUrl } from "@/lib/urls";

export default async function LandingPagesList({ params, searchParams }: PageProps<"/[lang]/dashboard/landing-pages">) {
  const lang = asLocale((await params).lang);
  const { error } = await searchParams;
  const t = getDictionary(lang);
  const { shop } = await requireManager(lang);
  const l = t.landingPages;

  const [pages, orderCounts] = await Promise.all([
    db
      .select({ page: schema.landingPages, productName: schema.products.name })
      .from(schema.landingPages)
      .leftJoin(schema.products, eq(schema.products.id, schema.landingPages.productId))
      .where(eq(schema.landingPages.shopId, shop.id))
      .orderBy(desc(schema.landingPages.createdAt)),
    db
      .select({ landingPageId: schema.orders.landingPageId, n: count() })
      .from(schema.orders)
      .where(and(eq(schema.orders.shopId, shop.id), isNotNull(schema.orders.landingPageId)))
      .groupBy(schema.orders.landingPageId),
  ]);
  const ordersByPage = new Map(orderCounts.map((r) => [r.landingPageId, r.n]));
  const base = storeUrl(shop.slug);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{l.title}</h1>
        <Link href={`/${lang}/dashboard/landing-pages/new`} className="btn">+ {l.new}</Link>
      </div>
      {error === "limit" && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{l.limitReached}</p>}
      {pages.length === 0 ? (
        <div className="card text-center text-slate-500">{l.empty}</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead>
              <tr>
                <th>{l.pageTitle}</th>
                <th>{l.product}</th>
                <th>{l.views}</th>
                <th>{l.orders}</th>
                <th>{l.conversion}</th>
                <th>{l.copyLink}</th>
              </tr>
            </thead>
            <tbody>
              {pages.map(({ page, productName }) => {
                const orders = ordersByPage.get(page.id) ?? 0;
                const url = `${base}/lp/${encodeURIComponent(page.slug)}`;
                return (
                  <tr key={page.id} className="hover:bg-slate-50">
                    <td>
                      <Link href={`/${lang}/dashboard/landing-pages/${page.id}`} className="font-semibold text-brand">{page.title}</Link>
                      {page.status === "draft" && <span className="badge ms-2 bg-slate-100 text-slate-600">{t.products.draft}</span>}
                    </td>
                    <td>{productName ?? "—"}</td>
                    <td>{page.views}</td>
                    <td>{orders}</td>
                    <td>{page.views ? `${((orders / page.views) * 100).toFixed(1)}%` : "—"}</td>
                    <td>
                      <a href={url} target="_blank" rel="noreferrer" className="text-xs text-brand underline" dir="ltr">
                        /lp/{decodeURIComponent(page.slug)} ↗
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
