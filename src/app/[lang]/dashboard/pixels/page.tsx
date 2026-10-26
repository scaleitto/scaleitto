import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { ComingSoon } from "@/features/shell/ComingSoon";

export default async function Page({ params }: PageProps<"/[lang]/dashboard/pixels">) {
  const lang = asLocale((await params).lang);
  await requireSection(lang, "pixels");
  return <ComingSoon t={getDictionary(lang)} section="pixels" />;
}
