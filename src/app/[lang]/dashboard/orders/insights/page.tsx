import { connection } from "next/server";
import { ChartNoAxesColumn } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { EmptyState, PageHeader } from "@/ui";
import { resolveRange } from "@/features/analytics/range";
import { shopAnalytics } from "@/features/analytics/queries";
import { Funnel, PeriodBar, StatusList, WilayasTable } from "@/features/analytics/views";
import { orderInsights } from "@/features/orders/insights";
import { CarriersTable, InsightKpis, Timing } from "@/features/orders/InsightsViews";

// Orders → Order analysis: only the orders and what happens to them (sales and profit are in Analytics / Finance)
export default async function OrderInsightsPage({ params, searchParams }: PageProps<"/[lang]/dashboard/orders/insights">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop } = await requireSection(lang, "orderInsights");
  await connection();
  const range = resolveRange(await searchParams);
  const [data, insights] = await Promise.all([shopAnalytics(shop.id, range), orderInsights(shop.id, range)]);
  return (
    <>
      <PageHeader title={t.sections.orderInsights.title} description={t.sections.orderInsights.description} />
      <PeriodBar base={sectionHref(lang, "orderInsights")} range={range} t={t} />
      {insights.orders === 0 ? (
        <EmptyState icon={<ChartNoAxesColumn size={40} />} title={t.analytics.empty}>
          <p>{t.analytics.emptyHint}</p>
        </EmptyState>
      ) : (
        <>
          <InsightKpis data={insights} t={t} />
          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <Funnel data={data} t={t} />
            <StatusList data={data} t={t} />
          </div>
          <div className="mb-6">
            <Timing data={insights} t={t} />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <WilayasTable data={data} lang={lang} t={t} />
            <CarriersTable data={insights} t={t} />
          </div>
        </>
      )}
    </>
  );
}
