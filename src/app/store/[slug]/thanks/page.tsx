import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getShopBySlug, storeBase } from "@/lib/store";
import { getStoreDictionary } from "@/i18n/store";
import { getDictionary } from "@/i18n";
import { TrackPurchase } from "@/components/storefront/Tracking";
import { acceptUpsell } from "../actions";
import { UpsellOffer } from "./UpsellOffer";

const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

export default async function ThanksPage({ params, searchParams }: PageProps<"/store/[slug]/thanks">) {
  const shop = await getShopBySlug((await params).slug);
  if (!shop) notFound();
  const { n, o } = await searchParams;
  const s = getStoreDictionary(shop.defaultLocale);
  const currency = getDictionary(shop.defaultLocale).common.currency;
  const base = await storeBase(shop.slug);

  const [order] = isUuid(o)
    ? await db.select().from(schema.orders).where(and(eq(schema.orders.id, o), eq(schema.orders.shopId, shop.id)))
    : [];
  const items = order ? await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id)) : [];

  // Post-purchase offer: configured on the ordered product, not yet accepted, product available.
  let upsell: { name: string; image: string | null; price: number; compareAt: number } | null = null;
  const main = items.find((i) => !i.isUpsell);
  if (order && order.status === "new" && main?.productId && !items.some((i) => i.isUpsell)) {
    const [source] = await db.select().from(schema.products).where(eq(schema.products.id, main.productId));
    if (source?.upsellProductId) {
      const [p] = await db
        .select()
        .from(schema.products)
        .where(and(eq(schema.products.id, source.upsellProductId), eq(schema.products.shopId, shop.id), eq(schema.products.status, "active")));
      const [{ n: variantCount }] = p ? await db.select({ n: count() }).from(schema.productVariants).where(eq(schema.productVariants.productId, p.id)) : [{ n: 1 }];
      if (p && variantCount === 0 && (!p.trackStock || p.stock > 0)) {
        upsell = { name: p.name, image: p.images[0] ?? null, price: source.upsellPrice ?? p.price, compareAt: p.price };
      }
    }
  }

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      {order && (
        <TrackPurchase
          orderId={order.id}
          value={order.total}
          currency={shop.currency}
          items={items.map((i) => ({ id: i.productId ?? i.id, name: i.name, price: i.unitPrice, quantity: i.quantity }))}
        />
      )}
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-600">✓</div>
      <h1 className="mt-5 text-2xl font-bold">{s.thanksTitle}</h1>
      <p className="mt-2 text-slate-600">{s.thanksBody}</p>
      {typeof n === "string" && /^\d+$/.test(n) && (
        <p className="mt-4 text-sm">
          {s.orderNumber}: <b>#{n}</b>
        </p>
      )}
      {order && upsell && <UpsellOffer accept={acceptUpsell.bind(null, shop.slug, order.id)} s={s} currency={currency} product={upsell} />}
      <Link href={base || "/"} className="btn mt-8">{s.backToStore}</Link>
    </div>
  );
}
