import Link from "next/link";
import { getDictionary, asLocale } from "@/i18n";
import { requireShop } from "@/lib/auth";
import { storeUrl } from "@/lib/urls";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { logout } from "../(auth)/actions";

export default async function DashboardLayout({ children, params }: LayoutProps<"/[lang]/dashboard">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop, user, role } = await requireShop(lang);
  const base = `/${lang}/dashboard`;

  const isManager = role !== "confirmer";
  const nav = [
    ...(isManager ? [{ href: base, label: t.nav.overview }] : []),
    { href: `${base}/orders`, label: t.nav.orders },
    { href: `${base}/abandoned`, label: t.nav.abandoned },
    ...(isManager
      ? [
          { href: `${base}/products`, label: t.nav.products },
          { href: `${base}/landing-pages`, label: t.nav.landingPages },
          { href: `${base}/shipping`, label: t.nav.shipping },
          { href: `${base}/tracking`, label: t.nav.marketing },
          { href: `${base}/settings`, label: t.nav.settings },
        ]
      : []),
    ...(role === "owner" ? [{ href: `${base}/team`, label: t.nav.team }] : []),
  ];

  return (
    <div className="min-h-screen md:flex" style={{ ["--brand" as string]: shop.primaryColor }}>
      <aside className="border-b border-slate-200 bg-white md:min-h-screen md:w-60 md:border-b-0 md:border-e">
        <div className="flex items-center justify-between p-4 md:block">
          <div>
            <div className="text-xl font-extrabold text-brand">{t.brand}</div>
            <div className="mt-1 truncate text-sm text-slate-500">{shop.name}</div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-4">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              {item.label}
            </Link>
          ))}
          {user.isPlatformAdmin && (
            <Link href={`/${lang}/admin`} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50">
              {t.nav.admin}
            </Link>
          )}
          <a href={storeUrl(shop.slug)} target="_blank" rel="noreferrer" className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-brand hover:bg-slate-100">
            {t.nav.viewStore} ↗
          </a>
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <span className="truncate text-sm text-slate-600">{user.name}</span>
          <div className="flex items-center gap-3">
            <LanguageSwitcher current={lang} />
            <form action={logout.bind(null, lang)}>
              <button className="text-sm font-medium text-slate-600 hover:text-red-600">{t.auth.logout}</button>
            </form>
          </div>
        </header>
        <main className="mx-auto max-w-6xl p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
