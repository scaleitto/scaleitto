import { notFound } from "next/navigation";
import { getShippingRates, getShopBySlug, getStoreProduct } from "@/features/storefront/queries";
import { saveLead, submitOrder } from "@/features/checkout/actions";
import { CheckoutForm } from "@/features/storefront/CheckoutForm";
import { HeightReporter } from "@/features/landing/HeightReporter";
import { StoreFrame } from "@/features/storefront/blocks";
import { shopLocale } from "@/features/storefront/StoreShell";
import { resolveDesign, storeTheme } from "@/features/design/types";
import { PixelScope } from "@/features/pixels/PixelScope";
import { pagePixels } from "@/features/pixels/queries";
import { productForm } from "@/features/order-form/resolve";
import { currencyLabel, getStoreText } from "@/i18n/store";
import { dir } from "@/i18n/config";
import { wilayas } from "@/lib/wilayas";

// A product's order form alone (the same form as its product page), for <iframe> embedding on any website.
// The code to paste is given in Store design → Order form.
export default async function EmbedProductForm({ params }: PageProps<"/embed/[slug]/p/[product]">) {
  const { slug, product: productSlug } = await params;
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();
  const product = await getStoreProduct(shop.id, decodeURIComponent(productSlug));
  if (!product) notFound();
  const locale = shopLocale(shop);
  const t = getStoreText(locale);
  return (
    <StoreFrame locale={locale} color={shop.primaryColor} theme={storeTheme(resolveDesign(shop.design))} className="bg-transparent p-1">
      <PixelScope pixels={await pagePixels(shop.id, [product.id])} item={{ id: product.id, name: product.name, price: product.price, quantity: 1 }}>
        <div lang={locale} dir={dir(locale)}>
          <CheckoutForm
            t={t}
            currency={currencyLabel(locale)}
            product={{ price: product.price, trackStock: product.trackStock, stock: product.stock, options: product.options, offers: product.offers }}
            variants={product.variants.map((v) => ({ id: v.id, values: v.optionValues, price: v.price, stock: v.stock }))}
            rates={await getShippingRates(shop.id)}
            wilayas={wilayas.map((w) => ({ code: w.code, name: `${String(w.code).padStart(2, "0")} - ${locale === "ar" ? w.ar : w.fr}` }))}
            action={submitOrder.bind(null, shop.slug, product.id, null, true)}
            saveLead={saveLead.bind(null, shop.slug, product.id)}
            settings={await productForm(shop, product.formTemplateId)}
            whatsapp={{ phone: shop.phone ?? "", product: product.name }}
            embedded
          />
          <HeightReporter frameId={product.id} />
        </div>
      </PixelScope>
    </StoreFrame>
  );
}
