import { redirect } from "next/navigation";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { listTeam } from "@/features/team/queries";
import { teamPerformance } from "@/features/team/metrics";
import { CallCenterHeader, PerformanceCards, PerformanceTable, PeriodTabs, parsePeriod } from "@/features/team/views";

export default async function PerformancePage({ params, searchParams }: PageProps<"/[lang]/dashboard/call-centers/performance">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop, role } = await requireSection(lang, "callCenters");
  const base = sectionHref(lang, "callCenters");
  if (role === "agent") redirect(base);
  const period = parsePeriod((await searchParams).period);
  // Agents always; owners and managers only if they also worked on orders
  const rows = (await teamPerformance(shop.id, await listTeam(shop.id), period)).filter((p) => p.role === "agent" || p.actions > 0 || p.assigned > 0);
  return (
    <>
      <CallCenterHeader lang={lang} t={t} current="performance" />
      <PeriodTabs href={(p) => `${base}/performance${p === "today" ? "" : `?period=${p}`}`} current={period} t={t} />
      {rows.length > 1 && (
        <div className="mb-6">
          <PerformanceTable rows={rows} t={t} />
        </div>
      )}
      <PerformanceCards lang={lang} rows={rows} t={t} />
    </>
  );
}
