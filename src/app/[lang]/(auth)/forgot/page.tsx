import { getDictionary, asLocale } from "@/i18n";
import { forgotPassword } from "@/features/auth/actions";
import { AuthShell, ForgotForm } from "@/features/auth/components";

export default async function ForgotPage({ params }: PageProps<"/[lang]/forgot">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  return (
    <AuthShell lang={lang} t={t} title={t.auth.forgotTitle} subtitle={t.auth.forgotSubtitle}>
      <ForgotForm lang={lang} t={t} action={forgotPassword.bind(null, lang)} />
    </AuthShell>
  );
}
