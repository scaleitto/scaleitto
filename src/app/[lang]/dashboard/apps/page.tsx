import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { ComingSoon } from "@/features/shell/ComingSoon";

export default async function Page({ params }: PageProps<"/[lang]/dashboard/apps">) {
  const lang = asLocale((await params).lang);
  await requireSection(lang, "apps");
  return <ComingSoon t={getDictionary(lang)} section="apps" />;
}
