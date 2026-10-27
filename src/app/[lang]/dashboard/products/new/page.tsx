import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { storeLanguage } from "@/features/landing/types";
import { sectionHref } from "@/lib/permissions";
import { saveProduct } from "@/features/products/actions";
import { ProductForm, type ProductFormValues } from "@/features/products/ProductForm";
import { productFormText } from "@/features/products/text";

const empty: ProductFormValues = {
  name: "",
  slug: "",
  description: "",
  price: null,
  compareAtPrice: null,
  costPrice: null,
  sku: "",
  trackStock: false,
  stock: 0,
  status: "active",
  images: [],
  options: [],
  offers: [],
  variants: [],
};

export default async function NewProductPage({ params }: PageProps<"/[lang]/dashboard/products/new">) {
  const lang = asLocale((await params).lang);
  const { shop } = await requireSection(lang, "products");
  return <ProductForm t={productFormText(getDictionary(lang))} action={saveProduct.bind(null, lang, null)} values={empty} backHref={sectionHref(lang, "products")} isNew ai={{ lang, language: storeLanguage(shop.defaultLocale) }} />;
}
