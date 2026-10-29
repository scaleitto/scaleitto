import Link from "next/link";
import { redirect } from "next/navigation";
import { getDictionary, asLocale } from "@/i18n";
import { getCurrentUser } from "@/server/auth/session";
import { confirmEmail, logout, resendVerification } from "@/features/auth/actions";
import { AuthShell, ResendVerification } from "@/features/auth/components";
import { fmt } from "@/lib/format";
import { Alert, Button, buttonClass } from "@/ui";

// The email confirmation: ?token=… comes from the email's link; without it, the page waits for the click
export default async function VerifyPage({ params, searchParams }: PageProps<"/[lang]/verify">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const a = t.auth;
  const token = String((await searchParams).token ?? "");
  if (token) {
    const ok = await confirmEmail(token);
    return (
      <AuthShell lang={lang} t={t} title={ok ? a.verifiedTitle : a.invalidLinkTitle} subtitle={ok ? a.verifiedBody : a.invalidLinkBody}>
        <div data-testid={ok ? "email-verified" : "link-invalid"}>
          <Link href={`/${lang}/dashboard`} className={buttonClass("primary", "w-full")}>
            {a.goDashboard}
          </Link>
        </div>
      </AuthShell>
    );
  }
  const user = await getCurrentUser();
  if (!user) redirect(`/${lang}/login`);
  if (user.emailVerifiedAt) redirect(`/${lang}/dashboard`);
  return (
    <AuthShell lang={lang} t={t} title={a.verifyTitle} subtitle={fmt(a.verifySubtitle, { email: user.email })}>
      <div className="space-y-4" data-testid="verify-waiting">
        <Alert variant="info">{a.verifyHint}</Alert>
        <ResendVerification t={t} action={resendVerification.bind(null, lang)} />
        <form action={logout.bind(null, lang)}>
          <Button type="submit" variant="ghost" className="w-full">
            {t.nav.logout}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
