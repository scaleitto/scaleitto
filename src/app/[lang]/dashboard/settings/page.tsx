import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { storeUrl } from "@/lib/urls";
import { PageHeader } from "@/ui";
import { domainTarget, planAllowsDomain } from "@/features/settings/domain";
import { DomainCard, GeneralForm, PoliciesForm, SeoForm } from "@/features/settings/SettingsForms";

export default async function SettingsPage({ params }: PageProps<"/[lang]/dashboard/settings">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop, role } = await requireSection(lang, "settings");
  const text = { settings: t.settings, errors: t.errors, common: t.common };
  return (
    <>
      <PageHeader title={t.sections.settings.title} description={t.sections.settings.description} />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <GeneralForm lang={lang} values={{ name: shop.name, phone: shop.phone ?? "", defaultLocale: shop.defaultLocale, slug: shop.slug }} t={text} />
          <DomainCard
            lang={lang}
            state={{ allowed: await planAllowsDomain(shop.id), domain: shop.customDomain, token: shop.domainToken, verified: Boolean(shop.domainVerifiedAt), target: domainTarget() }}
            plansHref={role === "owner" ? sectionHref(lang, "plans") : null}
            t={text}
          />
          <SeoForm lang={lang} values={{ title: shop.seo?.title ?? "", description: shop.seo?.description ?? "" }} shopName={shop.name} url={storeUrl(shop)} t={text} />
        </div>
        <PoliciesForm lang={lang} values={shop.policies ?? {}} t={text} />
      </div>
    </>
  );
}
