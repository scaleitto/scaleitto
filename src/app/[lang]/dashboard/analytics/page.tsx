import { connection } from "next/server";
import { ChartNoAxesColumn } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { EmptyState, PageHeader } from "@/ui";
import { resolveRange } from "@/features/analytics/range";
import { shopAnalytics } from "@/features/analytics/queries";
import { DailyChart, Funnel, HourlyChart, KpiGrid, PeriodBar, ProductsTable, SourcesTable, StatusList, WilayasTable } from "@/features/analytics/views";

export default async function AnalyticsPage({ params, searchParams }: PageProps<"/[lang]/dashboard/analytics">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop } = await requireSection(lang, "analytics");
  await connection();
  const range = resolveRange(await searchParams);
  const data = await shopAnalytics(shop.id, range);
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
          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <Funnel data={data} t={t} />
            <StatusList data={data} t={t} />
          </div>
          <div className="mb-6 grid gap-6 xl:grid-cols-2">
            <ProductsTable data={data} t={t} />
            <WilayasTable data={data} lang={lang} t={t} />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <SourcesTable data={data} pageTitles={data.pageTitles} t={t} />
            <HourlyChart data={data} t={t} />
          </div>
        </>
      )}
    </>
  );
}
