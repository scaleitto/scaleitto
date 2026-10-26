import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getShopBySlug } from "@/lib/store";
import { getStoreDictionary } from "@/i18n/store";
import { getDictionary } from "@/i18n";
import { formatPrice } from "@/lib/format";
import { placeOrder } from "../../actions";
import { OrderForm } from "./OrderForm";

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export default async function ProductPage({ params }: PageProps<"/store/[slug]/p/[product]">) {
  const { slug, product: productSlug } = await params;
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();
  const s = getStoreDictionary(shop.defaultLocale);
  const currency = getDictionary(shop.defaultLocale).common.currency;

  const [product] = await db
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.shopId, shop.id), eq(schema.products.slug, safeDecode(productSlug)), eq(schema.products.status, "active")));
  if (!product) notFound();

  const [variants, rateRows] = await Promise.all([
    db.select().from(schema.productVariants).where(eq(schema.productVariants.productId, product.id)),
    db.select().from(schema.shippingRates).where(eq(schema.shippingRates.shopId, shop.id)),
  ]);
  const rates = rateRows.length ? Object.fromEntries(rateRows.map((r) => [r.wilayaCode, { home: r.homePrice, desk: r.deskPrice }])) : null;

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="space-y-3">
        <div className="aspect-square overflow-hidden rounded-2xl bg-slate-100">
          {product.images[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
          )}
        </div>
        {product.images.length > 1 && (
          <div className="grid grid-cols-4 gap-2">
            {product.images.slice(1).map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" className="aspect-square rounded-lg object-cover" />
            ))}
          </div>
        )}
      </div>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-extrabold">{product.name}</h1>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-2xl font-bold text-brand">{formatPrice(product.price, currency)}</span>
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <span className="text-lg text-slate-400 line-through">{formatPrice(product.compareAtPrice, currency)}</span>
            )}
          </div>
        </div>
        <OrderForm
          action={placeOrder.bind(null, shop.slug, product.id)}
          s={s}
          locale={shop.defaultLocale}
          currency={currency}
          price={product.price}
          options={product.options}
          variants={variants.map((v) => ({ id: v.id, title: v.title, optionValues: v.optionValues, price: v.price, stock: v.stock }))}
          trackStock={product.trackStock}
          productStock={product.stock}
          rates={rates}
        />
        {product.description && <div className="whitespace-pre-line leading-relaxed text-slate-700">{product.description}</div>}
      </div>
    </div>
  );
}
