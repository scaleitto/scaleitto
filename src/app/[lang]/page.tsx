import Link from "next/link";
import { getDictionary, asLocale } from "@/i18n";
import { buttonClass } from "@/ui";
import { LanguageSwitcher } from "@/ui/LanguageSwitcher";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <span className="text-2xl font-extrabold text-accent">{t.brand}</span>
        <div className="flex items-center gap-3">
          <LanguageSwitcher current={lang} />
          <Link href={`/${lang}/login`} className={buttonClass("secondary")}>
            {t.landing.login}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">{t.landing.title}</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">{t.landing.subtitle}</p>
        <Link href={`/${lang}/register`} className={buttonClass("primary", "mt-8 px-8 py-3 text-base")}>
          {t.landing.cta}
        </Link>
      </main>
    </div>
  );
}
