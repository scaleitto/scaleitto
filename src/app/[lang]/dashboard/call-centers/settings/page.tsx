import { redirect } from "next/navigation";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { AssignSettings } from "@/features/team/AssignSettings";
import { distributionBoard } from "@/features/team/distribution";
import { DistributionBoard } from "@/features/team/DistributionBoard";
import { CallCenterHeader } from "@/features/team/views";
import { MessagesEditor } from "@/features/messages/MessagesEditor";
import { resolveMessages } from "@/features/messages/templates";

export default async function AssignSettingsPage({ params }: PageProps<"/[lang]/dashboard/call-centers/settings">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop, role } = await requireSection(lang, "callCenters");
  if (role === "agent") redirect(sectionHref(lang, "callCenters"));
  const messages = resolveMessages(shop.messages);
  const board = await distributionBoard(shop.id);
  return (
    <>
      <CallCenterHeader lang={lang} t={t} current="settings" />
      <AssignSettings lang={lang} mode={shop.assignMode} t={{ team: t.team, errors: t.errors, common: t.common }} />
      <DistributionBoard lang={lang} mode={shop.assignMode} board={board} t={t} />
      <MessagesEditor lang={lang} language={messages.language} texts={messages.texts} t={{ assistant: t.assistant, errors: t.errors, common: t.common, landingPages: t.landingPages }} />
    </>
  );
}
