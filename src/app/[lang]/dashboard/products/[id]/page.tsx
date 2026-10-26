import { notFound } from "next/navigation";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { saveProduct } from "@/features/products/actions";
import { getProduct } from "@/features/products/queries";
import { ProductForm } from "@/features/products/ProductForm";
import { productFormText } from "@/features/products/text";

export default async function EditProductPage({ params }: PageProps<"/[lang]/dashboard/products/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = asLocale(rawLang);
  const { shop } = await requireSection(lang, "products");
  const product = await getProduct(shop.id, id);
  if (!product) notFound();
  return (
    <ProductForm
      key={product.id}
      t={productFormText(getDictionary(lang))}
      action={saveProduct.bind(null, lang, product.id)}
      values={{ ...product, description: product.description ?? "", sku: product.sku ?? "" }}
      backHref={sectionHref(lang, "products")}
      isNew={false}
    />
  );
}
