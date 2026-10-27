import { redirect } from "next/navigation";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { AssignSettings } from "@/features/team/AssignSettings";
import { CallCenterHeader } from "@/features/team/views";

export default async function AssignSettingsPage({ params }: PageProps<"/[lang]/dashboard/call-centers/settings">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop, role } = await requireSection(lang, "callCenters");
  if (role === "agent") redirect(sectionHref(lang, "callCenters"));
  return (
    <>
      <CallCenterHeader lang={lang} t={t} current="settings" />
      <AssignSettings lang={lang} mode={shop.assignMode} t={{ team: t.team, errors: t.errors, common: t.common }} />
    </>
  );
}
