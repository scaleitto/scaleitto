import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getDictionary, asLocale } from "@/i18n";
import { getActiveContract, getEffectiveLimits, getUsage, percentUsed } from "@/lib/limits";

export default async function AdminPage({ params }: PageProps<"/[lang]/admin">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);

  const shops = await db
    .select({ shop: schema.shops, owner: schema.users.email, plan: schema.plans.name })
    .from(schema.shops)
    .innerJoin(schema.users, eq(schema.users.id, schema.shops.ownerId))
    .innerJoin(schema.plans, eq(schema.plans.id, schema.shops.planId))
    .orderBy(desc(schema.shops.createdAt));

  // Fine for hundreds of shops; move to a cached usage table when the platform grows.
  const rows = await Promise.all(
    shops.map(async (s) => {
      const [{ limits }, usage, contract] = await Promise.all([getEffectiveLimits(s.shop.id), getUsage(s.shop.id), getActiveContract(s.shop.id)]);
      const threshold = contract?.alertThreshold ?? 80;
      const orderPct = percentUsed(usage.maxOrdersPerMonth, limits.maxOrdersPerMonth);
      const productPct = percentUsed(usage.maxProducts, limits.maxProducts);
      return { ...s, limits, usage, contract, orderPct, productPct, alert: Math.max(orderPct, productPct) >= threshold };
    }),
  );
  const alerts = rows.filter((r) => r.alert);
  const fmtLimit = (n: number) => (n === -1 ? "∞" : n);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t.admin.title}</h1>

      <div className="card">
        <h2 className="mb-3 font-bold">{t.admin.alerts}</h2>
        {alerts.length === 0 ? (
          <p className="text-sm text-slate-500">{t.admin.noAlerts}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {alerts.map((r) => (
              <li key={r.shop.id}>
                <Link href={`/${lang}/admin/shops/${r.shop.id}`} className="font-semibold text-red-600">{r.shop.name}</Link>
                {" — "}
                {t.nav.orders}: {r.orderPct}% · {t.nav.products}: {r.productPct}%
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>{t.admin.shops}</th>
              <th>{t.admin.owner}</th>
              <th>{t.admin.plan}</th>
              <th>{t.nav.products}</th>
              <th>{t.overview.ordersMonth}</th>
              <th>{t.admin.status}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.shop.id} className="hover:bg-slate-50">
                <td>
                  <Link href={`/${lang}/admin/shops/${r.shop.id}`} className="font-semibold text-brand">{r.shop.name}</Link>
                  <div className="text-xs text-slate-400" dir="ltr">{r.shop.slug}</div>
                </td>
                <td dir="ltr" className="text-start">{r.owner}</td>
                <td>
                  {r.plan}
                  {r.contract && <span className="badge ms-1 bg-amber-100 text-amber-800">{t.admin.contract}</span>}
                </td>
                <td dir="ltr" className="text-start">{r.usage.maxProducts} / {fmtLimit(r.limits.maxProducts)}</td>
                <td dir="ltr" className="text-start">{r.usage.maxOrdersPerMonth} / {fmtLimit(r.limits.maxOrdersPerMonth)}</td>
                <td>
                  <span className={`badge ${r.shop.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {r.shop.status === "active" ? t.admin.active : t.admin.suspended}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
