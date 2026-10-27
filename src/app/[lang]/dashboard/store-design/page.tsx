import { getDictionary, asLocale, isLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { storeUrl } from "@/lib/urls";
import { PageHeader } from "@/ui";
import { currencyLabel, getStoreText } from "@/i18n/store";
import { DesignEditor } from "@/features/design/DesignEditor";
import { saveDesign } from "@/features/design/actions";
import { resolveDesign } from "@/features/design/types";
import { listStoreProducts } from "@/features/storefront/queries";

export default async function StoreDesignPage({ params }: PageProps<"/[lang]/dashboard/store-design">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop } = await requireSection(lang, "storeDesign");
  // The preview speaks the store's language (what customers see), not the dashboard's
  const storeLocale = isLocale(shop.defaultLocale) ? shop.defaultLocale : "ar";
  const products = (await listStoreProducts(shop.id)).slice(0, 8);
  return (
    <>
      <PageHeader title={t.sections.storeDesign.title} description={t.sections.storeDesign.description} />
      <DesignEditor
        t={{ design: t.design, media: t.media, errors: t.errors, common: t.common }}
        initial={{ primaryColor: shop.primaryColor, logoUrl: shop.logoUrl, design: resolveDesign(shop.design) }}
        preview={{ shopName: shop.name, phone: shop.phone, locale: storeLocale, storeText: getStoreText(storeLocale), currency: currencyLabel(storeLocale), products }}
        storeHref={storeUrl(shop.slug)}
        action={saveDesign.bind(null, lang)}
      />
    </>
  );
}
