import "server-only";
import { storeCollections } from "@/features/collections/queries";
import { resolveApps } from "@/features/apps/settings";
import { resolveDesign, storeTheme } from "@/features/design/types";
import { currencyLabel, getStoreText } from "@/i18n/store";
import { listStoreProducts, storeBase, type StoreShop } from "./queries";
import { shopLocale } from "./StoreShell";
import { trustBadgeItems } from "./blocks";
import type { SectionData } from "./sections";

// Everything a store page drawn from sections needs (home, custom pages)
export async function sectionData(shop: StoreShop): Promise<SectionData> {
  const locale = shopLocale(shop);
  const t = getStoreText(locale);
  const [products, base, collections] = await Promise.all([listStoreProducts(shop.id), storeBase(shop.slug), storeCollections(shop.id)]);
  return { products, collections, badges: trustBadgeItems(resolveApps(shop.apps).badges, t), base, currency: currencyLabel(locale), locale, t, layout: storeTheme(resolveDesign(shop.design)).layout };
}
