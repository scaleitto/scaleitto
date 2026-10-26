import { getDictionary, asLocale } from "@/i18n";
import { requireShop } from "@/lib/auth";
import { createProduct } from "../actions";
import { ProductForm } from "../ProductForm";

export default async function NewProductPage({ params }: PageProps<"/[lang]/dashboard/products/new">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  await requireShop(lang);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t.products.new}</h1>
      <ProductForm t={t} action={createProduct.bind(null, lang)} />
    </div>
  );
}
