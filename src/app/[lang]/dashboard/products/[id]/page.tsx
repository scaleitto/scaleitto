import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getDictionary, asLocale } from "@/i18n";
import { requireShop } from "@/lib/auth";
import { deleteProduct, updateProduct } from "../actions";
import { ProductForm } from "../ProductForm";

export default async function EditProductPage({ params }: PageProps<"/[lang]/dashboard/products/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = asLocale(rawLang);
  const t = getDictionary(lang);
  const { shop } = await requireShop(lang);

  const [product] = await db.select().from(schema.products).where(and(eq(schema.products.id, id), eq(schema.products.shopId, shop.id)));
  if (!product) notFound();
  const variants = await db.select().from(schema.productVariants).where(eq(schema.productVariants.productId, id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{product.name}</h1>
        <form action={deleteProduct.bind(null, lang, id)}>
          <button className="btn-danger">{t.common.delete}</button>
        </form>
      </div>
      <ProductForm
        t={t}
        action={updateProduct.bind(null, lang, id)}
        initial={{
          name: product.name,
          description: product.description ?? "",
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          sku: product.sku ?? "",
          stock: product.stock,
          trackStock: product.trackStock,
          status: product.status,
          images: product.images,
          options: product.options,
          variants: variants.map((v) => ({ optionValues: v.optionValues, title: v.title, sku: v.sku ?? "", price: v.price, stock: v.stock })),
        }}
      />
    </div>
  );
}
