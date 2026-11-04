import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { fmt } from "@/lib/format";
import { storeUrl } from "@/lib/urls";
import { PageHeader, buttonClass } from "@/ui";
import { changePassword, updateProfile } from "@/features/profile/actions";
import { DeleteAccount, PasswordForm, ProfileForm } from "@/features/profile/components";

// Zimam's Profile settings: back to the dashboard, personal information + dashboard language, password, account deletion
export default async function ProfilePage({ params }: PageProps<"/[lang]/dashboard/profile">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const p = t.profile;
  const { user, shop } = await requireSection(lang, "profile");
  const support = process.env.PAYMENT_WHATSAPP?.replace(/[^\d]/g, "");
  const deletion = support ? `https://wa.me/${support}?text=${encodeURIComponent(fmt(p.deleteMessage, { email: user.email, store: storeUrl(shop) }))}` : null;
  const Back = lang === "ar" ? ChevronRight : ChevronLeft;
  return (
    <div className="space-y-6">
      <Link href={`/${lang}/dashboard`} className={buttonClass("secondary")} data-testid="back-dashboard">
        <Back size={16} /> {p.back}
      </Link>
      <PageHeader title={p.title} description={p.subtitle} />
      <ProfileForm t={t} lang={lang} action={updateProfile.bind(null, lang)} user={user} />
      <PasswordForm t={t} action={changePassword.bind(null, lang)} />
      <DeleteAccount t={t} href={deletion} />
    </div>
  );
}
