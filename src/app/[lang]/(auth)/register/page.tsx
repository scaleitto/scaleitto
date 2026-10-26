import Link from "next/link";
import { getDictionary, asLocale } from "@/i18n";
import { register } from "../actions";
import { AuthShell } from "../AuthShell";

export default async function RegisterPage({ params, searchParams }: PageProps<"/[lang]/register">) {
  const lang = asLocale((await params).lang);
  const { error } = await searchParams;
  const t = getDictionary(lang);
  const errors = t.auth.errors as Record<string, string>;
  const errorText = typeof error === "string" ? errors[error] : undefined;
  const rootDomain = process.env.ROOT_DOMAIN ?? "scaleitto.com";

  return (
    <AuthShell lang={lang} brand={t.brand} title={t.auth.registerTitle} error={errorText}>
      <form action={register.bind(null, lang)} className="space-y-4">
        <div>
          <label className="label" htmlFor="name">{t.auth.name}</label>
          <input className="input" id="name" name="name" required minLength={2} autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="email">{t.auth.email}</label>
          <input className="input" id="email" name="email" type="email" required dir="ltr" autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">{t.auth.password}</label>
          <input className="input" id="password" name="password" type="password" required minLength={8} dir="ltr" autoComplete="new-password" />
        </div>
        <div>
          <label className="label" htmlFor="shopName">{t.auth.shopName}</label>
          <input className="input" id="shopName" name="shopName" required minLength={2} />
        </div>
        <div>
          <label className="label" htmlFor="shopSlug">{t.auth.shopSlug}</label>
          <div className="flex items-center gap-2" dir="ltr">
            <input className="input" id="shopSlug" name="shopSlug" required pattern="[a-z0-9][a-z0-9\-]{1,38}[a-z0-9]" placeholder="mystore" />
            <span className="whitespace-nowrap text-sm text-slate-500">.{rootDomain}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{t.auth.shopSlugHint}</p>
        </div>
        <button className="btn w-full">{t.auth.submitRegister}</button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        {t.auth.haveAccount}{" "}
        <Link href={`/${lang}/login`} className="font-semibold text-brand">
          {t.auth.loginTitle}
        </Link>
      </p>
    </AuthShell>
  );
}
