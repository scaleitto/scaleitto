import { getDictionary, asLocale, isLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { PageHeader } from "@/ui";
import { currencyLabel, getStoreText } from "@/i18n/store";
import { resolveDesign } from "@/features/design/types";
import { listStoreProducts } from "@/features/storefront/queries";
import { ThemeGallery } from "@/features/themes/ThemeGallery";

export default async function ThemesPage({ params }: PageProps<"/[lang]/dashboard/store-design/themes">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop } = await requireSection(lang, "themes");
  const storeLocale = isLocale(shop.defaultLocale) ? shop.defaultLocale : "ar";
  const products = (await listStoreProducts(shop.id)).slice(0, 8);
  return (
    <>
      <PageHeader title={t.sections.themes.title} description={t.sections.themes.description} />
      <ThemeGallery
        lang={lang}
        shop={{ name: shop.name, phone: shop.phone, logoUrl: shop.logoUrl, color: shop.primaryColor, design: resolveDesign(shop.design) }}
        preview={{ locale: storeLocale, storeText: getStoreText(storeLocale), currency: currencyLabel(storeLocale), products }}
        t={{ themes: t.themes, errors: t.errors, common: t.common }}
      />
    </>
  );
}
