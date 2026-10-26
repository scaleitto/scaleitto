import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { orderStatuses } from "@/db/schema";
import { getDictionary, asLocale } from "@/i18n";
import { requireShop } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";
import { wilayaName } from "@/lib/wilayas";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { setOrderStatus } from "../actions";

export default async function OrderPage({ params }: PageProps<"/[lang]/dashboard/orders/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = asLocale(rawLang);
  const t = getDictionary(lang);
  const { shop } = await requireShop(lang);

  const [order] = await db.select().from(schema.orders).where(and(eq(schema.orders.id, id), eq(schema.orders.shopId, shop.id)));
  if (!order) notFound();
  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, id));
  const money = (n: number) => formatPrice(n, t.common.currency);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/${lang}/dashboard/orders`} className="text-sm text-slate-500">
            ← {t.common.back}
          </Link>
          <h1 className="text-2xl font-bold">#{order.number}</h1>
          <OrderStatusBadge status={order.status} label={t.orders.statuses[order.status]} />
        </div>
        <form action={setOrderStatus.bind(null, lang, id)} className="flex gap-2">
          <select name="status" defaultValue={order.status} className="input w-40">
            {orderStatuses.map((s) => (
              <option key={s} value={s}>
                {t.orders.statuses[s]}
              </option>
            ))}
          </select>
          <button className="btn">{t.orders.changeStatus}</button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="mb-3 font-bold">{t.orders.items}</h2>
          <table className="table">
            <thead>
              <tr>
                <th>{t.products.name}</th>
                <th>{t.orders.qty}</th>
                <th>{t.products.price}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>
                    <div className="font-medium">{it.name}</div>
                    {it.variantTitle && <div className="text-xs text-slate-500">{it.variantTitle}</div>}
                    {it.sku && <div className="text-xs text-slate-400" dir="ltr">{it.sku}</div>}
                  </td>
                  <td>{it.quantity}</td>
                  <td className="whitespace-nowrap">{money(it.unitPrice * it.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between"><dt>{t.orders.subtotal}</dt><dd>{money(order.subtotal)}</dd></div>
            <div className="flex justify-between"><dt>{t.orders.shipping}</dt><dd>{money(order.shippingCost)}</dd></div>
            <div className="flex justify-between text-base font-bold"><dt>{t.orders.total}</dt><dd>{money(order.total)}</dd></div>
          </dl>
        </div>
        <div className="card space-y-2 text-sm">
          <h2 className="mb-1 font-bold">{t.orders.customer}</h2>
          <p className="font-medium">{order.customerName}</p>
          <p dir="ltr" className="text-start">
            <a href={`tel:${order.phone}`} className="text-brand">{order.phone}</a>
          </p>
          <p>{wilayaName(order.wilayaCode, lang)} — {order.commune}</p>
          {order.address && <p>{order.address}</p>}
          <p>{t.orders.deliveryType}: {order.deliveryType === "home" ? t.orders.home : t.orders.desk}</p>
          {order.note && <p className="rounded bg-slate-50 p-2">{t.orders.note}: {order.note}</p>}
          <p className="text-slate-500">{formatDate(order.createdAt, lang)}</p>
        </div>
      </div>
    </div>
  );
}
