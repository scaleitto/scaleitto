import { connection } from "next/server";
import { ChartNoAxesColumn } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { EmptyState, PageHeader } from "@/ui";
import { resolveRange } from "@/features/analytics/range";
import { shopAnalytics } from "@/features/analytics/queries";
import Link from "next/link";
import { DailyChart, HourlyChart, KpiGrid, PeriodBar, ProductsTable, SourcesTable } from "@/features/analytics/views";

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
          {/* Order statuses live in Orders → Order analysis */}
          <p className="mb-6 rounded-xl border border-line bg-panel px-4 py-3 text-sm text-muted" data-testid="insights-link">
            {t.orders.insights.moved}{" "}
            <Link href={sectionHref(lang, "orderInsights")} className="font-semibold text-accent hover:underline">
              {t.orders.insights.open}
            </Link>
          </p>
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
