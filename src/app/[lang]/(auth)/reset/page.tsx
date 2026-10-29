import { getDictionary, asLocale } from "@/i18n";
import { resetPassword } from "@/features/auth/actions";
import { AuthShell, ResetForm } from "@/features/auth/components";

// The link of the "new password" email (?token=…); the token is checked when the form is sent
export default async function ResetPage({ params, searchParams }: PageProps<"/[lang]/reset">) {
  const lang = asLocale((await params).lang);
  const token = String((await searchParams).token ?? "");
  const t = getDictionary(lang);
  return (
    <AuthShell lang={lang} t={t} title={t.auth.resetTitle} subtitle={t.auth.resetSubtitle}>
      <ResetForm t={t} action={resetPassword.bind(null, lang, token)} />
    </AuthShell>
  );
}
