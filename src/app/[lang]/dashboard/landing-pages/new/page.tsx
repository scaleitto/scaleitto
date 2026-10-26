import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getDictionary, asLocale } from "@/i18n";
import { requireManager } from "@/lib/auth";
import { createLandingPage } from "../actions";
import { LandingForm } from "../LandingForm";

export default async function NewLandingPage({ params }: PageProps<"/[lang]/dashboard/landing-pages/new">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop } = await requireManager(lang);
  const products = await db
    .select({ id: schema.products.id, name: schema.products.name, images: schema.products.images })
    .from(schema.products)
    .where(eq(schema.products.shopId, shop.id));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t.landingPages.new}</h1>
      {products.length === 0 ? (
        <div className="card text-center text-slate-500">
          {t.landingPages.noProducts}
          <div className="mt-4">
            <Link href={`/${lang}/dashboard/products/new`} className="btn">+ {t.products.new}</Link>
          </div>
        </div>
      ) : (
        <LandingForm t={t} action={createLandingPage.bind(null, lang)} products={products.map((p) => ({ id: p.id, name: p.name, image: p.images[0] ?? null }))} />
      )}
    </div>
  );
}
