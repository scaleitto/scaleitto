import { notFound } from "next/navigation";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { storeAiLanguage as storeLanguage } from "@/features/ai/languages";
import { sectionHref } from "@/lib/permissions";
import { storeUrl } from "@/lib/urls";
import { saveProduct } from "@/features/products/actions";
import { getProduct } from "@/features/products/queries";
import { ProductForm } from "@/features/products/ProductForm";
import { productFormText } from "@/features/products/text";
import { editorProps } from "@/features/products/editor-props";

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
      values={{
        ...product,
        description: product.description ?? "",
        shortDescription: product.shortDescription ?? "",
        sku: product.sku ?? "",
        descriptionImages: product.descriptionImages ?? [],
      }}
      backHref={sectionHref(lang, "products")}
      viewHref={product.status === "active" ? `${storeUrl(shop)}/p/${encodeURIComponent(product.slug)}` : undefined}
      isNew={false}
      ai={{ lang, language: storeLanguage(shop.defaultLocale) }}
      {...await editorProps(lang, shop, product.id)}
    />
  );
}
