import "server-only";
import { collectionChoices } from "@/features/collections/queries";
import { textIn } from "@/features/collections/types";
import { resolveApps } from "@/features/apps/settings";
import { trustBadgeItems } from "@/features/storefront/blocks";
import type { Locale } from "@/i18n";
import { currencyLabel, getStoreText } from "@/i18n/store";
import { sectionHref } from "@/lib/permissions";
import { storeUrl } from "@/lib/urls";
import { findCarrier } from "@/features/delivery/carriers";
import { resolveDesign, storeTheme } from "@/features/design/types";
import { storeForm } from "@/features/order-form/resolve";
import { getShippingRates, type StoreShop } from "@/features/storefront/queries";
import { shopLocale } from "@/features/storefront/StoreShell";
import { resolveDelivery } from "@/features/delivery/settings";
import { liveMethods } from "@/features/payments/flow";
import { editorData } from "./queries";

// The editor's surroundings: store name and address (product link), delivery companies, other products, and what the
// live preview needs to draw the real product page (the store's language, theme, color, order form and delivery prices)
export async function editorProps(lang: Locale, shop: StoreShop, productId: string | null) {
  const [{ accounts, others }, rates, collections, gateway] = await Promise.all([editorData(shop.id, productId), getShippingRates(shop.id), collectionChoices(shop.id), liveMethods(shop.id)]);
  const locale = shopLocale(shop);
  const design = resolveDesign(shop.design);
  return {
    store: { name: shop.name, host: storeUrl(shop).replace(/^https?:\/\//, "") },
    accounts: accounts.map((a) => ({ id: a.id, name: findCarrier(a.carrier)?.name ?? a.carrier })),
    deliveryHref: sectionHref(lang, "delivery"),
    // Checkout & delivery: the store's delivery options, and whether it takes cards (online payment only)
    deliveryOptions: resolveDelivery(shop.delivery).options.filter((o) => o.active).map((o) => ({ id: o.id, name: o.name || o.type, type: o.type })),
    deliverySettingsHref: sectionHref(lang, "deliverySettings"),
    cardPayments: gateway.length > 0,
    paymentsHref: `${sectionHref(lang, "apps")}/payments`,
    collections: collections.filter((c) => !c.parentId).flatMap((top) => [top, ...collections.filter((c) => c.parentId === top.id)]).map((c) => ({ id: c.id, title: textIn(c.titles, lang), child: Boolean(c.parentId) })),
    collectionsHref: `${sectionHref(lang, "apps")}/collections`,
    customFieldsOn: resolveApps(shop.apps).customFields,
    wholesaleOn: resolveApps(shop.apps).wholesale,
    others,
    preview: {
      locale,
      storeText: getStoreText(locale),
      currency: currencyLabel(locale),
      theme: storeTheme(design),
      color: shop.primaryColor,
      logoUrl: shop.logoUrl,
      phone: shop.phone,
      about: design.about,
      socials: design.socials,
      form: storeForm(shop),
      rates,
      badges: trustBadgeItems(resolveApps(shop.apps).badges, getStoreText(locale)),
    },
  };
}
export type ProductPreviewData = Awaited<ReturnType<typeof editorProps>>["preview"];
