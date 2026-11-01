import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { ProductList } from "@/features/products/ProductList";

export default async function ProductsPage({ params, searchParams }: PageProps<"/[lang]/dashboard/products">) {
  const lang = asLocale((await params).lang);
  const { shop } = await requireSection(lang, "products");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  return <ProductList lang={lang} t={getDictionary(lang)} shop={shop} page={Math.max(1, Number(one(sp.page)) || 1)} created={one(sp.created) === "1"} />;
}
