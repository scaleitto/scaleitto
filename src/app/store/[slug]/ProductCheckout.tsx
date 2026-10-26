import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getStoreDictionary } from "@/i18n/store";
import { placeOrder, saveLead } from "./actions";
import { OrderForm } from "./p/[product]/OrderForm";
import { TrackViewContent } from "@/components/storefront/Tracking";

type Shop = typeof schema.shops.$inferSelect;
type Product = typeof schema.products.$inferSelect;

// The COD order form for one product, used by product pages and landing pages.
export async function ProductCheckout({
  shop,
  product,
  currency,
  locale = shop.defaultLocale,
  landingPageId = null,
}: {
  shop: Shop;
  product: Product;
  currency: string;
  locale?: string;
  landingPageId?: string | null;
}) {
  const [variants, rateRows] = await Promise.all([
    db.select().from(schema.productVariants).where(eq(schema.productVariants.productId, product.id)),
    db.select().from(schema.shippingRates).where(eq(schema.shippingRates.shopId, shop.id)),
  ]);
  const rates = rateRows.length ? Object.fromEntries(rateRows.map((r) => [r.wilayaCode, { home: r.homePrice, desk: r.deskPrice }])) : null;

  return (
    <>
      <TrackViewContent item={{ id: product.id, name: product.name, price: product.price }} currency={shop.currency} />
      <OrderForm
        action={placeOrder.bind(null, shop.slug, product.id, landingPageId)}
        saveLead={saveLead.bind(null, shop.slug, product.id, landingPageId)}
        product={{ id: product.id, name: product.name }}
        offers={product.offers ?? []}
        s={getStoreDictionary(locale)}
        locale={locale}
        currency={currency}
        currencyCode={shop.currency}
        price={product.price}
        options={product.options}
        variants={variants.map((v) => ({ id: v.id, title: v.title, optionValues: v.optionValues, price: v.price, stock: v.stock }))}
        trackStock={product.trackStock}
        productStock={product.stock}
        rates={rates}
      />
    </>
  );
}
