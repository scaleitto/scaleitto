import Link from "next/link";
import { getDictionary, asLocale } from "@/i18n";
import { login } from "../actions";
import { AuthShell } from "../AuthShell";

export default async function LoginPage({ params, searchParams }: PageProps<"/[lang]/login">) {
  const lang = asLocale((await params).lang);
  const { error } = await searchParams;
  const t = getDictionary(lang);
  const errorText = error === "invalid" ? t.auth.errors.invalid : undefined;

  return (
    <AuthShell lang={lang} brand={t.brand} title={t.auth.loginTitle} error={errorText}>
      <form action={login.bind(null, lang)} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">{t.auth.email}</label>
          <input className="input" id="email" name="email" type="email" required dir="ltr" autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">{t.auth.password}</label>
          <input className="input" id="password" name="password" type="password" required dir="ltr" autoComplete="current-password" />
        </div>
        <button className="btn w-full">{t.auth.submitLogin}</button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        {t.auth.noAccount}{" "}
        <Link href={`/${lang}/register`} className="font-semibold text-brand">
          {t.auth.registerTitle}
        </Link>
      </p>
    </AuthShell>
  );
}
