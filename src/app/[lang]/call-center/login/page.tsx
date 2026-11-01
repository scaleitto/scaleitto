import { redirect } from "next/navigation";
import { getDictionary, asLocale } from "@/i18n";
import { getCurrentUser } from "@/server/auth/session";
import { AuthShell } from "@/features/auth/components";
import { AgentLoginForm } from "@/features/team/AgentLoginForm";

// The agents' sign-in page; ?store= fills the store ID (the link the owner copies from Call center)
export default async function AgentLoginPage({ params, searchParams }: PageProps<"/[lang]/call-center/login">) {
  const lang = asLocale((await params).lang);
  const store = (await searchParams).store;
  if (await getCurrentUser()) redirect(`/${lang}/call-center`);
  const t = getDictionary(lang);
  return (
    <AuthShell lang={lang} t={t} title={t.portal.login.title} subtitle={t.portal.login.subtitle}>
      <AgentLoginForm lang={lang} t={t} store={typeof store === "string" ? store.slice(0, 120) : undefined} />
    </AuthShell>
  );
}
