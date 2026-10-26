import Link from "next/link";
import type { ReactNode } from "react";
import { Phone } from "lucide-react";
import { dir, isLocale } from "@/i18n/config";
import { getStoreText } from "@/i18n/store";
import type { StoreShop } from "./queries";

export const shopLocale = (shop: StoreShop) => (isLocale(shop.defaultLocale) ? shop.defaultLocale : "ar");

// Header and footer of every storefront page, in the shop's language and color.
export function StoreShell({ shop, base, children }: { shop: StoreShop; base: string; children: ReactNode }) {
  const locale = shopLocale(shop);
  const t = getStoreText(locale);
  return (
    <div lang={locale} dir={dir(locale)} className="flex min-h-screen flex-col" style={{ ["--brand" as string]: shop.primaryColor }}>
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href={base || "/"} className="flex min-w-0 items-center gap-2 text-lg font-extrabold text-brand">
            {shop.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop.logoUrl} alt="" className="size-9 rounded-lg object-contain" />
            )}
            <span className="truncate">{shop.name}</span>
          </Link>
          {shop.phone && (
            <a href={`tel:${shop.phone}`} dir="ltr" className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
              <Phone size={15} /> {shop.phone}
            </a>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-slate-200 bg-white py-5 text-center text-xs text-slate-400">
        © {shop.name} · {t.poweredBy}
      </footer>
    </div>
  );
}
