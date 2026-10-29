import { and, asc, count, eq } from "drizzle-orm";
import { getDictionary, asLocale, isLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { db, schema } from "@/server/db";
import { PageHeader } from "@/ui";
import { currencyLabel, getStoreText } from "@/i18n/store";
import { resolveForm } from "@/features/landing/types";
import { resolveDesign, storeTheme } from "@/features/design/types";
import { getShippingRates } from "@/features/storefront/queries";
import { OrderFormEditor } from "@/features/order-form/OrderFormEditor";
import { saveOrderForm } from "@/features/order-form/actions";
import { wilayas } from "@/lib/wilayas";
import { sectionHref } from "@/lib/permissions";

export default async function OrderFormPage({ params, searchParams }: PageProps<"/[lang]/dashboard/store-design/order-form">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop } = await requireSection(lang, "orderForm");
  const wanted = (await searchParams).template;
  // The templates (with how many products use each) and the products to assign
  const [templates, products] = await Promise.all([
    db
      .select({ id: schema.formTemplates.id, name: schema.formTemplates.name, form: schema.formTemplates.form, products: count(schema.products.id) })
      .from(schema.formTemplates)
      .leftJoin(schema.products, eq(schema.products.formTemplateId, schema.formTemplates.id))
      .where(eq(schema.formTemplates.shopId, shop.id))
      .groupBy(schema.formTemplates.id)
      .orderBy(asc(schema.formTemplates.createdAt)),
    db.select({ id: schema.products.id, name: schema.products.name, templateId: schema.products.formTemplateId }).from(schema.products).where(eq(schema.products.shopId, shop.id)).orderBy(asc(schema.products.name)),
  ]);
  const current = templates.find((x) => x.id === wanted) ?? null;
  // The preview speaks the store's language (what customers see)
  const storeLocale = isLocale(shop.defaultLocale) ? shop.defaultLocale : "ar";
  // A real product of the store for the preview (its options and offers), else a sample
  const [product] = await db
    .select({ name: schema.products.name, price: schema.products.price, options: schema.products.options, offers: schema.products.offers })
    .from(schema.products)
    .where(and(eq(schema.products.shopId, shop.id), eq(schema.products.status, "active")))
    .limit(1);
  return (
    <>
      <PageHeader title={t.sections.orderForm.title} description={t.orderForm.description} />
      <OrderFormEditor
        lang={lang}
        // A fresh editor for each template
        key={current?.id ?? "store"}
        initial={resolveForm(current ? current.form : shop.orderForm)}
        templates={{ base: sectionHref(lang, "orderForm"), list: templates.map(({ id, name, products: n }) => ({ id, name, products: n })), current: current?.id ?? null, products }}
        t={{ orderForm: t.orderForm, media: t.media, errors: t.errors, common: t.common }}
        preview={{
          storeText: getStoreText(storeLocale),
          locale: storeLocale,
          currency: currencyLabel(storeLocale),
          color: shop.primaryColor,
          theme: storeTheme(resolveDesign(shop.design)),
          product: product ? { ...product, options: product.options ?? [], offers: product.offers ?? [] } : { name: t.orderForm.sampleProduct, price: 3500, options: [], offers: [] },
          rates: await getShippingRates(shop.id),
          wilayas: wilayas.map((w) => ({ code: w.code, name: `${String(w.code).padStart(2, "0")} - ${storeLocale === "ar" ? w.ar : w.fr}` })),
          phone: shop.phone ?? "",
        }}
        action={saveOrderForm.bind(null, lang, current?.id ?? null)}
      />
    </>
  );
}
