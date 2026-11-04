import { getDictionary, asLocale, isLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { storeUrl } from "@/lib/urls";
import { policyKinds } from "@/lib/enums";
import { currencyLabel, getStoreText } from "@/i18n/store";
import { StoreBuilder } from "@/features/design/StoreBuilder";
import { resolveDesign } from "@/features/design/types";
import { listStoreProducts } from "@/features/storefront/queries";
import { storeCollections } from "@/features/collections/queries";
import { resolveApps } from "@/features/apps/settings";
import { trustBadgeItems } from "@/features/storefront/blocks";

// Store Design = Zimam's full-screen store builder
export default async function StoreDesignPage({ params }: PageProps<"/[lang]/dashboard/store-design">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop } = await requireSection(lang, "storeDesign");
  // The preview speaks the store's language (what customers see), not the dashboard's
  const storeLocale = isLocale(shop.defaultLocale) ? shop.defaultLocale : "ar";
  const storeText = getStoreText(storeLocale);
  const design = resolveDesign(shop.design);
  const [products, collections] = await Promise.all([listStoreProducts(shop.id), storeCollections(shop.id)]);
  return (
    <StoreBuilder
      lang={lang}
      initial={{
        global: {
          primaryColor: shop.primaryColor,
          logoUrl: shop.logoUrl ?? "",
          announcementEnabled: design.announcement.enabled,
          announcementText: design.announcement.text,
          navigationEnabled: design.navigation.enabled,
          links: design.navigation.links,
          showPhone: design.header.showPhone,
          footerEnabled: design.footer.enabled,
          style: design.style,
          about: design.about,
          ...design.socials,
        },
        draft: design.draft,
      }}
      published={design.pages}
      themeKey={design.theme}
      preview={{
        shopName: shop.name,
        phone: shop.phone,
        locale: storeLocale,
        storeText,
        currency: currencyLabel(storeLocale),
        products: products.slice(0, 48),
        collections,
        badges: trustBadgeItems(resolveApps(shop.apps).badges, storeText),
        policies: policyKinds.filter((k) => shop.policies?.[k]).map((k) => ({ kind: k, title: storeText.policies[k] })),
      }}
      storeHref={storeUrl(shop)}
      backHref={sectionHref(lang, "overview")}
      themesHref={sectionHref(lang, "themes")}
      title={t.sections.storeDesign.title}
      t={{ design: t.design, media: t.media, errors: t.errors, common: t.common }}
    />
  );
}
