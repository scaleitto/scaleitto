import { redirect } from "next/navigation";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { listTeam } from "@/features/team/queries";
import { teamActivityLog } from "@/features/team/metrics";
import { ActivityLog, CallCenterHeader } from "@/features/team/views";

export default async function ActivityPage({ params, searchParams }: PageProps<"/[lang]/dashboard/call-centers/activity">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop, role } = await requireSection(lang, "callCenters");
  if (role === "agent") redirect(sectionHref(lang, "callCenters"));
  const team = await listTeam(shop.id);
  const member = (await searchParams).member;
  const selected = typeof member === "string" && team.some((m) => m.userId === member) ? member : undefined;
  return (
    <>
      <CallCenterHeader lang={lang} t={t} current="activity" />
      <ActivityLog lang={lang} rows={await teamActivityLog(shop.id, selected)} members={team} selected={selected} t={t} />
    </>
  );
}
