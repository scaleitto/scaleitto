import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { Badge, PageHeader } from "@/ui";
import { changePassword, updateProfile } from "@/features/profile/actions";
import { PasswordForm, ProfileForm } from "@/features/profile/components";

export default async function ProfilePage({ params }: PageProps<"/[lang]/dashboard/profile">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { user, role } = await requireSection(lang, "profile");
  return (
    <>
      <PageHeader title={t.sections.profile.title} description={t.sections.profile.description} actions={<Badge tone="accent">{t.profile.roles[role]}</Badge>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileForm t={t} action={updateProfile.bind(null, lang)} user={user} />
        <PasswordForm t={t} action={changePassword.bind(null, lang)} />
      </div>
    </>
  );
}
