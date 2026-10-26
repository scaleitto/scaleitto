import { redirect } from "next/navigation";
import { getDictionary, asLocale } from "@/i18n";
import { getCurrentUser } from "@/server/auth/session";
import { login } from "@/features/auth/actions";
import { AuthShell, LoginForm } from "@/features/auth/components";

export default async function LoginPage({ params }: PageProps<"/[lang]/login">) {
  const lang = asLocale((await params).lang);
  if (await getCurrentUser()) redirect(`/${lang}/dashboard`);
  const t = getDictionary(lang);
  return (
    <AuthShell lang={lang} t={t} title={t.auth.loginTitle} subtitle={t.auth.loginSubtitle}>
      <LoginForm lang={lang} t={t} action={login.bind(null, lang)} />
    </AuthShell>
  );
}
