import { and, count, eq, gte, sum } from "drizzle-orm";
import { db, schema } from "@/db";
import { getDictionary, asLocale } from "@/i18n";
import { requireManager } from "@/lib/auth";
import { getEffectiveLimits, getUsage, startOfMonth } from "@/lib/limits";
import { formatPrice } from "@/lib/format";
import { UsageBar } from "@/components/UsageBar";

export default async function Overview({ params }: PageProps<"/[lang]/dashboard">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop } = await requireManager(lang);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [[today], [revenue], { plan, contract, limits }, usage] = await Promise.all([
    db.select({ n: count() }).from(schema.orders).where(and(eq(schema.orders.shopId, shop.id), gte(schema.orders.createdAt, startOfDay))),
    db
      .select({ total: sum(schema.orders.total) })
      .from(schema.orders)
      .where(and(eq(schema.orders.shopId, shop.id), eq(schema.orders.status, "delivered"), gte(schema.orders.createdAt, startOfMonth()))),
    getEffectiveLimits(shop.id),
    getUsage(shop.id),
  ]);

  const stats = [
    { label: t.overview.ordersToday, value: today.n },
    { label: t.overview.ordersMonth, value: usage.maxOrdersPerMonth },
    { label: t.overview.revenueMonth, value: formatPrice(Number(revenue.total ?? 0), t.common.currency) },
    { label: t.overview.products, value: usage.maxProducts },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t.overview.title}</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <div className="text-sm text-slate-500">{s.label}</div>
            <div className="mt-2 text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>
      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">{t.overview.planUsage}</h2>
          <div className="text-sm text-slate-600">
            {t.overview.plan}: <b>{plan?.name}</b>
            {contract && (
              <span className="badge ms-2 bg-amber-100 text-amber-800">
                {t.overview.contract}
                {contract.endDate ? ` · ${t.overview.until} ${contract.endDate}` : ""}
              </span>
            )}
          </div>
        </div>
        <UsageBar label={t.nav.products} used={usage.maxProducts} limit={limits.maxProducts} unlimitedLabel={t.common.unlimited} />
        <UsageBar label={t.overview.ordersMonth} used={usage.maxOrdersPerMonth} limit={limits.maxOrdersPerMonth} unlimitedLabel={t.common.unlimited} />
        <UsageBar label={t.nav.landingPages} used={usage.maxLandingPages} limit={limits.maxLandingPages} unlimitedLabel={t.common.unlimited} />
        <UsageBar label={t.nav.team} used={usage.maxStaff} limit={limits.maxStaff} unlimitedLabel={t.common.unlimited} />
      </div>
    </div>
  );
}
