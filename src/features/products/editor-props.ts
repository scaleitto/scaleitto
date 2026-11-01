import "server-only";
import type { Locale } from "@/i18n";
import { sectionHref } from "@/lib/permissions";
import { storeUrl } from "@/lib/urls";
import { findCarrier } from "@/features/delivery/carriers";
import type { StoreShop } from "@/features/storefront/queries";
import { editorData } from "./queries";

// The editor's surroundings: store name and address (preview, product link), delivery companies, other products
export async function editorProps(lang: Locale, shop: Pick<StoreShop, "id" | "name" | "slug" | "customDomain" | "domainVerifiedAt">, productId: string | null) {
  const { accounts, others } = await editorData(shop.id, productId);
  return {
    store: { name: shop.name, host: storeUrl(shop).replace(/^https?:\/\//, "") },
    accounts: accounts.map((a) => ({ id: a.id, name: findCarrier(a.carrier)?.name ?? a.carrier })),
    deliveryHref: sectionHref(lang, "delivery"),
    others,
  };
}
