import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { getDictionary, asLocale } from "@/i18n";
import { requireManager } from "@/lib/auth";
import { formatPrice } from "@/lib/format";

export default async function ProductsPage({ params, searchParams }: PageProps<"/[lang]/dashboard/products">) {
  const lang = asLocale((await params).lang);
  const { error } = await searchParams;
  const t = getDictionary(lang);
  const { shop } = await requireManager(lang);

  const products = await db.select().from(schema.products).where(eq(schema.products.shopId, shop.id)).orderBy(desc(schema.products.createdAt));
  const variants = products.length
    ? await db
        .select({ productId: schema.productVariants.productId, stock: schema.productVariants.stock })
        .from(schema.productVariants)
        .where(inArray(schema.productVariants.productId, products.map((p) => p.id)))
    : [];
  const variantStock = new Map<string, { count: number; stock: number }>();
  for (const v of variants) {
    const s = variantStock.get(v.productId) ?? { count: 0, stock: 0 };
    variantStock.set(v.productId, { count: s.count + 1, stock: s.stock + v.stock });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.products.title}</h1>
        <Link href={`/${lang}/dashboard/products/new`} className="btn">
          + {t.products.new}
        </Link>
      </div>
      {error === "limit" && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{t.products.limitReached}</p>}
      {products.length === 0 ? (
        <div className="card text-center text-slate-500">{t.products.empty}</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead>
              <tr>
                <th>{t.products.name}</th>
                <th>{t.products.price}</th>
                <th>{t.products.stock}</th>
                <th>{t.products.status}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const vs = variantStock.get(p.id);
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td>
                      <Link href={`/${lang}/dashboard/products/${p.id}`} className="flex items-center gap-3 font-medium">
                        {p.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.images[0]} alt="" className="h-10 w-10 rounded object-cover" />
                        ) : (
                          <span className="h-10 w-10 rounded bg-slate-100" />
                        )}
                        {p.name}
                      </Link>
                    </td>
                    <td>{formatPrice(p.price, t.common.currency)}</td>
                    <td>
                      {vs ? vs.stock : p.stock}
                      {vs && <span className="text-xs text-slate-400"> · {vs.count} {t.products.variants}</span>}
                    </td>
                    <td>
                      <span className={`badge ${p.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                        {p.status === "active" ? t.products.active : t.products.draft}
                      </span>
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
