import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { PageHeader } from "@/ui";
import { productChoices } from "@/features/landing/queries";
import { createLandingPage } from "@/features/landing/actions";
import { NewLanding } from "@/features/landing/NewLanding";

export default async function NewLandingPage({ params }: PageProps<"/[lang]/dashboard/landing-pages/new">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop } = await requireSection(lang, "landingPages");
  const products = (await productChoices(shop.id)).map((p) => ({ id: p.id, name: p.name }));
  return (
    <>
      <PageHeader title={t.landingPages.createTitle} />
      <NewLanding
        lang={lang}
        products={products}
        editorBase={sectionHref(lang, "landingPages")}
        createAction={createLandingPage.bind(null, lang)}
        t={{ landingPages: t.landingPages, media: t.media, errors: t.errors, common: t.common }}
      />
    </>
  );
}
