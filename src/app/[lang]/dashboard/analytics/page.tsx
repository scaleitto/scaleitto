import { connection } from "next/server";
import { ChartNoAxesColumn } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { EmptyState, PageHeader } from "@/ui";
import { resolveRange } from "@/features/analytics/range";
import { shopAnalytics } from "@/features/analytics/queries";
import { orderInsights } from "@/features/analytics/insights";
import { DailyChart, Funnel, HourlyChart, KpiGrid, PeriodBar, ProductsTable, SourcesTable, StatusList, WilayasTable } from "@/features/analytics/views";
import { CarriersTable, FollowUpCard, InsightKpis, Timing } from "@/features/analytics/InsightsViews";

// All the numbers in one place: sales, then what happens to the orders (rates, steps, couriers, follow-up), then
// products, sources and hours.
export default async function AnalyticsPage({ params, searchParams }: PageProps<"/[lang]/dashboard/analytics">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop } = await requireSection(lang, "analytics");
  await connection();
  const range = resolveRange(await searchParams);
  const [data, insights] = await Promise.all([shopAnalytics(shop.id, range), orderInsights(shop.id, range)]);
  return (
    <>
      <PageHeader title={t.sections.analytics.title} description={t.sections.analytics.description} />
      <PeriodBar base={sectionHref(lang, "analytics")} range={range} t={t} />
      {data.totals.orders === 0 ? (
        <EmptyState icon={<ChartNoAxesColumn size={40} />} title={t.analytics.empty}>
          <p>{t.analytics.emptyHint}</p>
        </EmptyState>
      ) : (
        <>
          <KpiGrid data={data} t={t} />
          <DailyChart data={data} t={t} />
          <h2 className="mt-8 mb-3 text-lg font-bold" id="orders">
            {t.analytics.ordersPart}
          </h2>
          <InsightKpis data={insights} t={t} />
          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <Funnel data={data} t={t} />
            <StatusList data={data} t={t} />
          </div>
          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <Timing data={insights} t={t} />
            <FollowUpCard data={insights} t={t} />
          </div>
          <div className="mb-6 grid gap-6 xl:grid-cols-2">
            <WilayasTable data={data} lang={lang} t={t} />
            <CarriersTable data={insights} t={t} />
          </div>
          <h2 className="mt-8 mb-3 text-lg font-bold">{t.analytics.salesPart}</h2>
          <div className="mb-6 grid gap-6 xl:grid-cols-2">
            <ProductsTable data={data} t={t} />
            <SourcesTable data={data} pageTitles={data.pageTitles} t={t} />
          </div>
          <HourlyChart data={data} t={t} />
        </>
      )}
    </>
  );
}
