import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { ComingSoon } from "@/features/shell/ComingSoon";

export default async function Page({ params }: PageProps<"/[lang]/dashboard/analytics">) {
  const lang = asLocale((await params).lang);
  await requireSection(lang, "analytics");
  return <ComingSoon t={getDictionary(lang)} section="analytics" />;
}
