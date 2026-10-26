import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getShopBySlug, storeBase } from "@/lib/store";
import { dir, isLocale } from "@/i18n/config";

export async function generateMetadata({ params }: LayoutProps<"/store/[slug]">): Promise<Metadata> {
  const shop = await getShopBySlug((await params).slug);
  return { title: shop?.name ?? "Store" };
}

export default async function StoreLayout({ children, params }: LayoutProps<"/store/[slug]">) {
  const { slug } = await params;
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();
  const locale = isLocale(shop.defaultLocale) ? shop.defaultLocale : "ar";
  const base = await storeBase(shop.slug);

  return (
    <div lang={locale} dir={dir(locale)} className="min-h-screen" style={{ ["--brand" as string]: shop.primaryColor }}>
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href={base || "/"} className="flex items-center gap-2 text-xl font-extrabold text-brand">
            {shop.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop.logoUrl} alt="" className="h-9 w-9 rounded object-contain" />
            )}
            {shop.name}
          </Link>
          {shop.phone && (
            <a href={`tel:${shop.phone}`} dir="ltr" className="text-sm font-semibold text-slate-600">
              {shop.phone}
            </a>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <footer className="mt-10 border-t border-slate-100 py-6 text-center text-xs text-slate-400">
        {shop.name} · Powered by Scaleitto
      </footer>
    </div>
  );
}
