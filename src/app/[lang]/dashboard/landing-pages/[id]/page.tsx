import { notFound } from "next/navigation";
import { getDictionary, asLocale } from "@/i18n";
import { getStoreText } from "@/i18n/store";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { storeUrl } from "@/lib/urls";
import { resolveDesign, storeTheme } from "@/features/design/types";
import { getShippingRates } from "@/features/storefront/queries";
import { getLandingPage, landingProduct } from "@/features/landing/queries";
import { LandingEditor } from "@/features/landing/LandingEditor";
import { StrategyCard } from "@/features/landing/StrategyCard";
import { pageLanguage } from "@/features/landing/PublicLanding";
import { resolveForm, sanitizeSections } from "@/features/landing/types";
import { productForm } from "@/features/order-form/resolve";
import { db, schema } from "@/server/db";
import { eq } from "drizzle-orm";

export default async function EditLandingPage({
  params,
}: PageProps<"/[lang]/dashboard/landing-pages/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = asLocale(rawLang);
  const t = getDictionary(lang);
  const { shop } = await requireSection(lang, "landingPages");
  const page = await getLandingPage(shop.id, id);
  if (!page) notFound();
  const product = await landingProduct(shop.id, page.productId);
  if (!product) notFound();
  const templates = await db.select({ id: schema.formTemplates.id, name: schema.formTemplates.name, form: schema.formTemplates.form }).from(schema.formTemplates).where(eq(schema.formTemplates.shopId, shop.id));
  return (
    <>
      <StrategyCard strategy={page.strategy} t={t.landingPages.strategy} names={t.landingPages.angles.names} />
      <LandingEditor
        key={page.id}
        lang={lang}
        pageId={page.id}
        initial={{
          title: page.title,
          slug: page.slug,
          language: pageLanguage(page.language),
          color: page.color,
          status: page.status,
          sections: sanitizeSections(page.sections),
          formTemplateId: page.formTemplateId,
        }}
        product={{
          name: product.name,
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          images: product.images,
          trackStock: product.trackStock,
          stock: product.stock,
          options: product.options,
          offers: product.offers,
        }}
        variants={product.variants.map((v) => ({
          id: v.id,
          values: v.optionValues,
          price: v.price,
          stock: v.stock,
        }))}
        rates={await getShippingRates(shop.id)}
        storeTexts={{
          ar: getStoreText("ar"),
          fr: getStoreText("fr"),
          en: getStoreText("en"),
        }}
        theme={storeTheme(resolveDesign(shop.design))}
        shopColor={shop.primaryColor}
        pageUrl={`${storeUrl(shop)}/lp/${encodeURIComponent(page.slug)}`}
        backHref={sectionHref(lang, "landingPages")}
        forms={{
          product: await productForm(shop, product.formTemplateId),
          templates: templates.map((x) => ({ id: x.id, name: x.name, form: resolveForm(x.form) })),
          editHref: sectionHref(lang, "orderForm"),
        }}
        t={{
          landingPages: t.landingPages,
          media: t.media,
          errors: t.errors,
          common: t.common,
        }}
      />
    </>
  );
}
