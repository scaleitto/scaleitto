import Link from "next/link";
import { getDictionary, asLocale } from "@/i18n";
import { requireAdmin } from "@/lib/auth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default async function AdminLayout({ children, params }: LayoutProps<"/[lang]/admin">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  await requireAdmin(lang);
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <Link href={`/${lang}/admin`} className="font-extrabold text-amber-700">
          {t.brand} · {t.admin.title}
        </Link>
        <div className="flex items-center gap-3">
          <Link href={`/${lang}/admin/system`} className="text-sm font-medium text-slate-600">{t.admin.system}</Link>
          <LanguageSwitcher current={lang} />
          <Link href={`/${lang}/dashboard`} className="text-sm text-slate-600">{t.nav.overview}</Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4 md:p-8">{children}</main>
    </div>
  );
}
