import { getDictionary, asLocale } from "@/i18n";
import { register } from "@/features/auth/actions";
import { AuthShell, RegisterForm } from "@/features/auth/components";

export default async function RegisterPage({ params }: PageProps<"/[lang]/register">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  return (
    <AuthShell lang={lang} t={t} title={t.auth.registerTitle} subtitle={t.auth.registerSubtitle}>
      <RegisterForm lang={lang} t={t} action={register.bind(null, lang)} rootDomain={process.env.ROOT_DOMAIN ?? "scaleitto.com"} />
    </AuthShell>
  );
}
