import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { ComingSoon } from "@/features/shell/ComingSoon";

export default async function Page({ params }: PageProps<"/[lang]/dashboard/plans">) {
  const lang = asLocale((await params).lang);
  await requireSection(lang, "plans");
  return <ComingSoon t={getDictionary(lang)} section="plans" />;
}
