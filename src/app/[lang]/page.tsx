import { getDictionary, asLocale } from "@/i18n";
import { MarketingHome } from "@/features/marketing/Home";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const lang = asLocale((await params).lang);
  return <MarketingHome lang={lang} t={getDictionary(lang)} />;
}
