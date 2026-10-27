import type { ReactNode } from "react";
import { isLocale } from "@/i18n/config";
import { getStoreText } from "@/i18n/store";
import { resolveDesign } from "@/features/design/types";
import type { StoreShop } from "./queries";
import { findTheme } from "@/features/themes/themes";
import { AnnouncementBar, StoreFooter, StoreFrame, StoreHeader } from "./blocks";

export const shopLocale = (shop: StoreShop) => (isLocale(shop.defaultLocale) ? shop.defaultLocale : "ar");

// Announcement bar, header and footer of every storefront page, in the shop's language, color and design.
export function StoreShell({ shop, base, children }: { shop: StoreShop; base: string; children: ReactNode }) {
  const locale = shopLocale(shop);
  const t = getStoreText(locale);
  const design = resolveDesign(shop.design);
  const theme = findTheme(design.theme);
  return (
    <StoreFrame locale={locale} color={shop.primaryColor} theme={theme} className="min-h-screen">
      {design.announcement.enabled && design.announcement.text && <AnnouncementBar text={design.announcement.text} />}
      <StoreHeader name={shop.name} logoUrl={shop.logoUrl} phone={shop.phone} homeHref={base || "/"} align={theme.layout.header} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <StoreFooter name={shop.name} about={design.about} socials={design.socials} t={t} />
    </StoreFrame>
  );
}
