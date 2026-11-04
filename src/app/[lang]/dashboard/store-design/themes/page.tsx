import { getDictionary, asLocale, isLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/ui";
import { sectionHref } from "@/lib/permissions";
import { storeUrl } from "@/lib/urls";
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
      <PageHeader
        title={t.themes.pageTitle}
        description={t.themes.pageHint}
        actions={
          <Link href={storeUrl(shop)} target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-panel px-3 text-sm font-semibold hover:bg-panel-2" data-testid="view-store">
            <ExternalLink size={15} /> {t.themes.viewStore}
          </Link>
        }
      />
      <ThemeGallery
        lang={lang}
        shop={{ name: shop.name, phone: shop.phone, logoUrl: shop.logoUrl, color: shop.primaryColor, design: resolveDesign(shop.design) }}
        preview={{ locale: storeLocale, storeText: getStoreText(storeLocale), currency: currencyLabel(storeLocale), products }}
        customizeHref={sectionHref(lang, "storeDesign")}
        t={{ themes: t.themes, errors: t.errors, common: t.common }}
      />
    </>
  );
}
