import { notFound } from "next/navigation";
import { and, eq, isNotNull } from "drizzle-orm";
import { getDictionary, asLocale } from "@/i18n";
import { getStoreText } from "@/i18n/store";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { storeUrl } from "@/lib/urls";
import { db, schema } from "@/server/db";
import { resolveDesign, storeTheme } from "@/features/design/types";
import { getShippingRates } from "@/features/storefront/queries";
import { getLandingPage, landingProduct } from "@/features/landing/queries";
import { LandingEditor } from "@/features/landing/LandingEditor";
import { interfaceLocale, pageLanguage, resolveForm, sanitizeSections, sanitizeVariants } from "@/features/landing/types";
import { productForm } from "@/features/order-form/resolve";

// The landing page builder (Zimam's, full screen over the dashboard)
export default async function EditLandingPage({ params }: PageProps<"/[lang]/dashboard/landing-pages/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = asLocale(rawLang);
  const t = getDictionary(lang);
  const { shop } = await requireSection(lang, "landingPages");
  const page = await getLandingPage(shop.id, id);
  if (!page) notFound();
  const product = await landingProduct(shop.id, page.productId);
  if (!product) notFound();
  const [templates, pixels, productImages] = await Promise.all([
    db.select({ id: schema.formTemplates.id, name: schema.formTemplates.name, form: schema.formTemplates.form }).from(schema.formTemplates).where(eq(schema.formTemplates.shopId, shop.id)),
    db.select({ id: schema.pixels.id, platform: schema.pixels.platform, name: schema.pixels.name }).from(schema.pixels).where(eq(schema.pixels.shopId, shop.id)),
    db.select({ images: schema.products.images }).from(schema.products).where(and(eq(schema.products.shopId, shop.id), isNotNull(schema.products.images))),
  ]);
  const sections = sanitizeSections(page.sections);
  const variants = sanitizeVariants(page.variants);
  // "Pick from library": the images of this page, of this product, then of the store's other products
  const used = [sections, ...variants.map((v) => v.sections)].flat().flatMap((s) => (s.type === "image" ? [s.url, ...(s.poster?.previous ?? [])] : []));
  const library = [...new Set([...used, ...product.images, ...productImages.flatMap((p) => p.images)])].filter(Boolean).slice(0, 120);
  const locale = interfaceLocale(pageLanguage(page.language));
  return (
    <LandingEditor
      key={page.id}
      lang={lang}
      pageId={page.id}
      initial={{ title: page.title, slug: page.slug, metaDescription: page.metaDescription ?? "", formTemplateId: page.formTemplateId ?? "", pixels: page.pixels ?? null, content: { sections, variants } }}
      live={page.status === "published"}
      hasPublished={Boolean(page.published)}
      product={{ price: product.price, trackStock: product.trackStock, stock: product.stock, options: product.options, offers: product.offers }}
      variants={product.variants.map((v) => ({ id: v.id, values: v.optionValues, price: v.price, stock: v.stock }))}
      rates={await getShippingRates(shop.id)}
      storeText={getStoreText(locale)}
      pageLocale={locale}
      theme={storeTheme(resolveDesign(shop.design))}
      color={page.color ?? shop.primaryColor}
      pageUrl={`${storeUrl(shop)}/lp/${encodeURIComponent(page.slug)}`}
      backHref={sectionHref(lang, "landingPages")}
      forms={{ product: await productForm(shop, product.formTemplateId), templates: templates.map((x) => ({ id: x.id, name: x.name, form: resolveForm(x.form) })), editHref: sectionHref(lang, "orderForm") }}
      pixels={pixels}
      library={library}
      t={{ landingPages: t.landingPages, media: t.media, errors: t.errors, common: t.common }}
    />
  );
}
