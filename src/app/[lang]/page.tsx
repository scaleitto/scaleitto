import Link from "next/link";
import { getDictionary, asLocale } from "@/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default async function Landing({ params }: PageProps<"/[lang]">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <span className="text-2xl font-extrabold text-brand">{t.brand}</span>
        <div className="flex items-center gap-3">
          <LanguageSwitcher current={lang} />
          <Link href={`/${lang}/login`} className="btn-outline">
            {t.landing.login}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4">
        <section className="py-16 text-center sm:py-24">
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">{t.landing.title}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">{t.landing.subtitle}</p>
          <Link href={`/${lang}/register`} className="btn mt-8 px-8 py-3 text-base">
            {t.landing.cta}
          </Link>
        </section>
        <section className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-4">
          {t.landing.features.map(([title, body]) => (
            <div key={title} className="card">
              <h3 className="font-bold">{title}</h3>
              <p className="mt-2 text-sm text-slate-600">{body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
