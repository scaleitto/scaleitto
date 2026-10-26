import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getDictionary, asLocale } from "@/i18n";
import { requireManager } from "@/lib/auth";
import { createProduct } from "../actions";
import { ProductForm } from "../ProductForm";

export default async function NewProductPage({ params }: PageProps<"/[lang]/dashboard/products/new">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop } = await requireManager(lang);
  const otherProducts = await db.select({ id: schema.products.id, name: schema.products.name }).from(schema.products).where(eq(schema.products.shopId, shop.id));
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t.products.new}</h1>
      <ProductForm t={t} action={createProduct.bind(null, lang)} otherProducts={otherProducts} />
    </div>
  );
}
