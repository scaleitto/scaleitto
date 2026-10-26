import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getDictionary, asLocale } from "@/i18n";
import { requireManager } from "@/lib/auth";
import { storeUrl } from "@/lib/urls";
import { deleteLandingPage, updateLandingPage } from "../actions";
import { LandingForm } from "../LandingForm";

export default async function EditLandingPage({ params }: PageProps<"/[lang]/dashboard/landing-pages/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = asLocale(rawLang);
  const t = getDictionary(lang);
  const { shop } = await requireManager(lang);

  const [[page], products] = await Promise.all([
    db.select().from(schema.landingPages).where(and(eq(schema.landingPages.id, id), eq(schema.landingPages.shopId, shop.id))),
    db
      .select({ id: schema.products.id, name: schema.products.name, images: schema.products.images })
      .from(schema.products)
      .where(eq(schema.products.shopId, shop.id)),
  ]);
  if (!page) notFound();
  const url = `${storeUrl(shop.slug)}/lp/${encodeURIComponent(page.slug)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{page.title}</h1>
          <a href={url} target="_blank" rel="noreferrer" className="text-sm text-brand underline" dir="ltr">{url} ↗</a>
        </div>
        <form action={deleteLandingPage.bind(null, lang, id)}>
          <button className="btn-danger">{t.common.delete}</button>
        </form>
      </div>
      <LandingForm
        t={t}
        action={updateLandingPage.bind(null, lang, id)}
        products={products.map((p) => ({ id: p.id, name: p.name, image: p.images[0] ?? null }))}
        initial={{ title: page.title, productId: page.productId, status: page.status, sections: page.sections }}
      />
    </div>
  );
}
