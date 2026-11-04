import Link from "next/link";
import { LifeBuoy, ShieldCheck } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { storeLinkParts, storeUrl } from "@/lib/urls";
import { Card, PageHeader } from "@/ui";
import { resolveDesign } from "@/features/design/types";
import { storeForm } from "@/features/order-form/resolve";
import { domainTarget, planAllowsDomain } from "@/features/settings/domain";
import { CheckoutFieldsForm, DomainCard, GeneralForm, LanguagePicker, NotificationsCard, PoliciesForm, ProductPageForm, SeoForm, SlugForm } from "@/features/settings/SettingsForms";

const tabs = ["general", "domain", "language", "checkout", "productPage", "policies"] as const;
type Tab = (typeof tabs)[number];

// Store settings like Zimam: underline tabs General, Domain, Language, Checkout, Product page (+ our policy pages)
export default async function SettingsPage({ params, searchParams }: PageProps<"/[lang]/dashboard/settings">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop, role } = await requireSection(lang, "settings");
  const q = (await searchParams).tab;
  const tab: Tab = tabs.includes(q as Tab) ? (q as Tab) : "general";
  const text = { settings: t.settings, errors: t.errors, common: t.common };
  const design = resolveDesign(shop.design);
  const form = storeForm(shop);
  const base = sectionHref(lang, "settings");
  const link = storeLinkParts();
  const whatsapp = (process.env.PAYMENT_WHATSAPP ?? "").replace(/\D/g, "");
  return (
    <>
      <PageHeader title={t.settings.pageTitle} />
      <nav className="mb-6 overflow-x-auto border-b border-line" data-testid="settings-tabs">
        <ul className="flex min-w-max gap-1">
          {tabs.map((k) => (
            <li key={k}>
              <Link
                href={k === "general" ? base : `${base}?tab=${k}`}
                aria-current={tab === k ? "page" : undefined}
                data-settings-tab={k}
                className={`-mb-px block border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap ${tab === k ? "border-accent font-semibold text-accent" : "border-transparent text-fg-2 hover:text-fg"}`}
              >
                {t.settings.tabs[k]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="max-w-5xl space-y-6">
        {tab === "general" && (
          <>
            <GeneralForm
              lang={lang}
              values={{ name: shop.name, phone: shop.phone ?? "", description: design.about, location: design.location, instagram: design.socials.instagram, tiktok: design.socials.tiktok, facebook: design.socials.facebook, telegram: design.socials.telegram }}
              t={text}
            />
            <NotificationsCard t={text} />
            <SeoForm lang={lang} values={{ title: shop.seo?.title ?? "", description: shop.seo?.description ?? "" }} shopName={shop.name} url={storeUrl(shop)} t={text} />
          </>
        )}
        {tab === "domain" && (
          <>
            <SlugForm lang={lang} slug={shop.slug} host={`${link.prefix}`} t={text} />
            <DomainCard
              lang={lang}
              state={{ allowed: await planAllowsDomain(shop.id), domain: shop.customDomain, token: shop.domainToken, verified: Boolean(shop.domainVerifiedAt), target: domainTarget() }}
              plansHref={role === "owner" ? sectionHref(lang, "plans") : null}
              t={text}
            />
            <Card className="flex items-start gap-3">
              <ShieldCheck size={20} className="mt-0.5 shrink-0 text-accent" />
              <div>
                <h2 className="font-semibold">{t.settings.dom.sslTitle}</h2>
                <p className="mt-1 text-sm text-muted">{t.settings.dom.sslHint}</p>
              </div>
            </Card>
            {whatsapp && (
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <LifeBuoy size={20} className="mt-0.5 shrink-0 text-accent" />
                  <div>
                    <h2 className="font-semibold">{t.settings.dom.helpTitle}</h2>
                    <p className="mt-1 text-sm text-muted">{t.settings.dom.helpHint}</p>
                  </div>
                </div>
                <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-panel-2">
                  {t.settings.dom.support}
                </a>
              </Card>
            )}
          </>
        )}
        {tab === "language" && <LanguagePicker lang={lang} current={shop.defaultLocale} t={text} />}
        {tab === "checkout" && <CheckoutFieldsForm lang={lang} values={{ name: form.name, commune: form.commune, address: form.address, delivery: form.delivery === "both" ? "optional" : "hidden" }} t={text} />}
        {tab === "productPage" && <ProductPageForm lang={lang} optionButtons={form.optionButtons} t={text} />}
        {tab === "policies" && <PoliciesForm lang={lang} values={shop.policies ?? {}} t={text} />}
      </div>
    </>
  );
}
