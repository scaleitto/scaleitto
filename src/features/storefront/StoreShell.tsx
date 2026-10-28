import type { ReactNode } from "react";
import { isLocale } from "@/i18n/config";
import { policyKinds } from "@/lib/enums";
import { getStoreText } from "@/i18n/store";
import { resolveDesign } from "@/features/design/types";
import type { StoreShop } from "./queries";
import { findTheme } from "@/features/themes/themes";
import { AnnouncementBar, StoreFooter, StoreFrame, StoreHeader } from "./blocks";

export const shopLocale = (shop: StoreShop) => (isLocale(shop.defaultLocale) ? shop.defaultLocale : "ar");

// The policy pages the shop wrote, in a fixed order
export const shopPolicies = (shop: StoreShop) => policyKinds.flatMap((k) => (shop.policies?.[k] ? [[k, shop.policies[k]] as const] : []));

// Announcement bar, header and footer of every storefront page, in the shop's language, color and design.
export function StoreShell({ shop, base, children }: { shop: StoreShop; base: string; children: ReactNode }) {
  const locale = shopLocale(shop);
  const t = getStoreText(locale);
  const design = resolveDesign(shop.design);
  const theme = findTheme(design.theme);
  return (
    <StoreFrame locale={locale} color={shop.primaryColor} theme={theme} className="min-h-screen">
      {design.announcement.enabled && design.announcement.text && <AnnouncementBar text={design.announcement.text} />}
      <StoreHeader name={shop.name} logoUrl={shop.logoUrl} phone={shop.phone} whatsapp={design.socials.whatsapp} homeHref={base || "/"} align={theme.layout.header} t={t} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <StoreFooter name={shop.name} about={design.about} socials={design.socials} policies={shopPolicies(shop).map(([kind]) => ({ kind, href: `${base}/policies/${kind}` }))} phone={shop.phone} t={t} />
    </StoreFrame>
  );
}
