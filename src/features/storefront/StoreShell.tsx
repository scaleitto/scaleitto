import type { ReactNode } from "react";
import { isLocale } from "@/i18n/config";
import { policyKinds } from "@/lib/enums";
import { getStoreText } from "@/i18n/store";
import { MessageCircle, Phone } from "lucide-react";
import { resolveApps } from "@/features/apps/settings";
import { CartLink } from "./CartLink";
import { resolveDesign, storeTheme } from "@/features/design/types";
import { navHref } from "@/features/design/builder";
import { intlPhone } from "@/lib/phone";
import type { StoreShop } from "./queries";
import { AnnouncementBar, StoreFooter, StoreFrame, StoreHeader } from "./blocks";

export const shopLocale = (shop: StoreShop) => (isLocale(shop.defaultLocale) ? shop.defaultLocale : "ar");

// The policy pages the shop wrote, in a fixed order
export const shopPolicies = (shop: StoreShop) => policyKinds.flatMap((k) => (shop.policies?.[k] ? [[k, shop.policies[k]] as const] : []));

// Announcement bar, header and footer of every storefront page, in the shop's language, color and design.
export function StoreShell({ shop, base, children }: { shop: StoreShop; base: string; children: ReactNode }) {
  const locale = shopLocale(shop);
  const t = getStoreText(locale);
  const design = resolveDesign(shop.design);
  const theme = storeTheme(design);
  const apps = resolveApps(shop.apps);
  const contact = apps.contact;
  return (
    <StoreFrame locale={locale} color={shop.primaryColor} theme={theme} className="min-h-screen">
      {design.announcement.enabled && design.announcement.text && <AnnouncementBar text={design.announcement.text} />}
      <StoreHeader
        name={shop.name}
        logoUrl={shop.logoUrl}
        phone={design.header.showPhone ? shop.phone : null}
        whatsapp={design.socials.whatsapp}
        homeHref={base || "/"}
        links={!design.navigation.enabled ? [] : design.navigation.links.length ? design.navigation.links.map((l) => ({ label: l.label, href: navHref(l.target, base) })) : undefined}
        align={theme.layout.header}
        t={t}
        extra={apps.cart ? <CartLink shopId={shop.id} href={`${base}/cart`} label={t.cart.title} /> : null}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      {design.footer.enabled && <StoreFooter name={shop.name} about={design.about} socials={design.socials} policies={shopPolicies(shop).map(([kind]) => ({ kind, href: `${base}/policies/${kind}` }))} phone={shop.phone} t={t} />}
      {(contact.phoneOn && contact.phone) || (contact.whatsappOn && contact.whatsapp) ? (
        // Apps → Quick contact buttons, above the phone's sticky order button
        <div className="fixed end-4 bottom-20 z-20 flex flex-col gap-3 md:bottom-6" data-testid="quick-contact">
          {contact.whatsappOn && contact.whatsapp && (
            <a href={`https://wa.me/${intlPhone(contact.whatsapp)}`} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="flex size-13 items-center justify-center rounded-full bg-[#25d366] text-white shadow-xl transition hover:scale-105" data-testid="floating-whatsapp">
              <MessageCircle size={26} />
            </a>
          )}
          {contact.phoneOn && contact.phone && (
            <a href={`tel:${contact.phone.replace(/\s+/g, "")}`} aria-label={t.form.phone} className="flex size-13 items-center justify-center rounded-full bg-brand text-brand-fg shadow-xl transition hover:scale-105" data-testid="floating-phone">
              <Phone size={24} />
            </a>
          )}
        </div>
      ) : null}
    </StoreFrame>
  );
}
