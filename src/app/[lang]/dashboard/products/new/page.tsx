import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { storeAiLanguage as storeLanguage } from "@/features/ai/languages";
import { sectionHref } from "@/lib/permissions";
import { saveProduct } from "@/features/products/actions";
import { ProductForm, type ProductFormValues } from "@/features/products/ProductForm";
import { productFormText } from "@/features/products/text";
import { editorProps } from "@/features/products/editor-props";

const empty: ProductFormValues = {
  name: "",
  slug: "",
  description: "",
  shortDescription: "",
  price: null,
  compareAtPrice: null,
  sku: "",
  trackStock: false,
  stock: 0,
  lowStock: null,
  showOutOfStock: true,
  status: "active",
  images: [],
  descriptionImages: [],
  options: [],
  offers: [],
  variants: [],
  carrierAccountId: null,
  similarIds: null,
  collectionIds: null,
  customFields: null,
  wholesale: null,
};

export default async function NewProductPage({ params, searchParams }: PageProps<"/[lang]/dashboard/products/new">) {
  const lang = asLocale((await params).lang);
  const { shop } = await requireSection(lang, "products");
  const t = getDictionary(lang);
  // ?created=<id of the product just saved>: a fresh form each time (the key changes)
  const created = String((await searchParams).created ?? "");
  return (
    <ProductForm
      key={created || "new"}
      t={productFormText(t)}
      action={saveProduct.bind(null, lang, null)}
      values={empty}
      backHref={sectionHref(lang, "products")}
      isNew
      ai={{ lang, language: storeLanguage(shop.defaultLocale) }}
      notice={created ? t.products.createdAnother : undefined}
      {...await editorProps(lang, shop, null)}
    />
  );
}
