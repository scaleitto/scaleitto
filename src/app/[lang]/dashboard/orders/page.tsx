import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { orderStatuses, type OrderStatus } from "@/db/schema";
import { getDictionary, asLocale } from "@/i18n";
import { requireShop } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";
import { wilayaName } from "@/lib/wilayas";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";

export default async function OrdersPage({ params, searchParams }: PageProps<"/[lang]/dashboard/orders">) {
  const lang = asLocale((await params).lang);
  const { status } = await searchParams;
  const t = getDictionary(lang);
  const { shop } = await requireShop(lang);
  const filter = orderStatuses.includes(status as OrderStatus) ? (status as OrderStatus) : null;

  const orders = await db
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.shopId, shop.id), filter ? eq(schema.orders.status, filter) : undefined))
    .orderBy(desc(schema.orders.createdAt))
    .limit(200);

  const base = `/${lang}/dashboard/orders`;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t.orders.title}</h1>
      <div className="flex flex-wrap gap-2">
        <Link href={base} className={!filter ? "btn" : "btn-outline"}>
          {t.orders.all}
        </Link>
        {orderStatuses.map((s) => (
          <Link key={s} href={`${base}?status=${s}`} className={filter === s ? "btn" : "btn-outline"}>
            {t.orders.statuses[s]}
          </Link>
        ))}
      </div>
      {orders.length === 0 ? (
        <div className="card text-center text-slate-500">{t.orders.empty}</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead>
              <tr>
                <th>{t.orders.number}</th>
                <th>{t.orders.customer}</th>
                <th>{t.orders.phone}</th>
                <th>{t.orders.wilaya}</th>
                <th>{t.orders.total}</th>
                <th>{t.orders.status}</th>
                <th>{t.orders.date}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td>
                    <Link href={`${base}/${o.id}`} className="font-semibold text-brand">
                      #{o.number}
                    </Link>
                  </td>
                  <td>{o.customerName}</td>
                  <td dir="ltr" className="text-start">{o.phone}</td>
                  <td>{wilayaName(o.wilayaCode, lang)}</td>
                  <td className="whitespace-nowrap">{formatPrice(o.total, t.common.currency)}</td>
                  <td>
                    <OrderStatusBadge status={o.status} label={t.orders.statuses[o.status]} />
                  </td>
                  <td className="whitespace-nowrap text-slate-500">{formatDate(o.createdAt, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
