import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { productChoices } from "@/features/landing/queries";
import { AiBuilder } from "@/features/landing/AiBuilder";
import { storeLanguage } from "@/features/landing/types";
import { getEffectiveLimits, getUsage } from "@/server/limits";

// "Generate with AI" (Zimam's dedicated AI builder page)
export default async function NewLandingPage({ params }: PageProps<"/[lang]/dashboard/landing-pages/new">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop } = await requireSection(lang, "landingPages");
  const [choices, limits, used] = await Promise.all([productChoices(shop.id), getEffectiveLimits(shop.id), getUsage(shop.id, "maxAiPerMonth")]);
  const base = sectionHref(lang, "landingPages");
  return (
    <AiBuilder
      lang={lang}
      products={choices.map((p) => ({ id: p.id, name: p.name, price: p.price, image: p.images[0] ?? null }))}
      defaultLanguage={storeLanguage(shop.defaultLocale)}
      aiLeft={limits.maxAiPerMonth === -1 ? null : Math.max(0, limits.maxAiPerMonth - used)}
      backHref={base}
      editorBase={base}
      t={{ landingPages: t.landingPages, errors: t.errors, common: t.common }}
    />
  );
}
