import "server-only";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { newId } from "@/server/auth/context";
import type { StoreShop } from "@/features/storefront/queries";
import { getShippingRates } from "@/features/storefront/queries";
import { checkOrderAllowed, type BlockReason } from "./protection";
import { linePrice, shippingPrice } from "./pricing";
import { pickAgent } from "@/features/team/assign";
import type { OrderInput } from "./validators";

export type CheckoutError = BlockReason | "unavailable" | "variant" | "stock" | "shipping";
export type PlaceOrderResult = { ok: true; orderId: string; number: number } | { ok: false; error: CheckoutError };

const FIRST_ORDER_NUMBER = 1001;

class OutOfStock extends Error {}

// Creates a cash-on-delivery order for one product. Used by the product page (and later landing pages).
export async function placeOrder(shop: StoreShop, productId: string, input: OrderInput, meta: { ip: string | null; userAgent: string | null; landingPageId?: string | null; extra?: { label: string; value: string }[] }): Promise<PlaceOrderResult> {
  const [product] = await db
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.shopId, shop.id), eq(schema.products.id, productId), eq(schema.products.status, "active")));
  if (!product) return { ok: false, error: "unavailable" };

  const variants = await db.select().from(schema.productVariants).where(and(eq(schema.productVariants.shopId, shop.id), eq(schema.productVariants.productId, product.id)));
  const variant = variants.find((v) => v.id === input.variantId) ?? null;
  if (variants.length > 0 && !variant) return { ok: false, error: "variant" };

  const blocked = await checkOrderAllowed(shop.id, input.phone, meta.ip, product.id);
  if (blocked) return { ok: false, error: blocked };

  const shipping = shippingPrice(await getShippingRates(shop.id), input.wilaya, input.deliveryType);
  if (shipping === null) return { ok: false, error: "shipping" };

  const line = linePrice(variant?.price ?? product.price, input.quantity, product.offers);
  const orderId = newId();

  try {
    const number = await db.transaction(async (tx) => {
      // Take the stock first, only if enough is left (safe when two customers order the last piece).
      if (product.trackStock) {
        const [res] = variant
          ? await tx
              .update(schema.productVariants)
              .set({ stock: sql`${schema.productVariants.stock} - ${input.quantity}` })
              .where(and(eq(schema.productVariants.id, variant.id), gte(schema.productVariants.stock, input.quantity)))
          : await tx
              .update(schema.products)
              .set({ stock: sql`${schema.products.stock} - ${input.quantity}` })
              .where(and(eq(schema.products.id, product.id), gte(schema.products.stock, input.quantity)));
        if (res.affectedRows === 0) throw new OutOfStock();
      }

      // Lock the shop row so two simultaneous orders never get the same number.
      await tx.select({ id: schema.shops.id }).from(schema.shops).where(eq(schema.shops.id, shop.id)).for("update");
      const [last] = await tx.select({ number: schema.orders.number }).from(schema.orders).where(eq(schema.orders.shopId, shop.id)).orderBy(desc(schema.orders.number)).limit(1);
      const number = last ? last.number + 1 : FIRST_ORDER_NUMBER;

      await tx.insert(schema.orders).values({
        id: orderId,
        shopId: shop.id,
        number,
        customerName: input.name,
        phone: input.phone,
        wilayaCode: input.wilaya,
        commune: input.commune,
        address: input.address || null,
        deliveryType: input.deliveryType,
        subtotal: line.total,
        shippingPrice: shipping,
        total: line.total + shipping,
        customerNote: input.note || null,
        landingPageId: meta.landingPageId ?? null,
        extra: meta.extra?.length ? meta.extra : null,
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 255) ?? null,
      });
      await tx.insert(schema.orderItems).values({
        id: newId(),
        orderId,
        shopId: shop.id,
        productId: product.id,
        variantId: variant?.id ?? null,
        name: product.name,
        variantTitle: variant?.title ?? null,
        sku: variant?.sku || product.sku,
        unitPrice: line.unitPrice,
        quantity: input.quantity,
        total: line.total,
        offerLabel: line.offer ? line.offer.label || `${line.offer.quantity}×` : null,
        stockTracked: product.trackStock,
      });
      await tx.insert(schema.orderEvents).values({ id: newId(), orderId, shopId: shop.id, type: "created", toStatus: "new" });
      // Hand the order to a call center agent (unless the shop assigns by hand)
      const agent = await pickAgent(tx, shop.id);
      if (agent) {
        await tx.update(schema.orders).set({ assignedTo: agent.userId, assignedAt: new Date() }).where(eq(schema.orders.id, orderId));
        await tx.insert(schema.orderEvents).values({ id: newId(), orderId, shopId: shop.id, type: "assign", note: agent.name });
      }
      // This visitor is no longer an abandoned cart.
      await tx
        .update(schema.leads)
        .set({ status: "converted", orderId })
        .where(and(eq(schema.leads.shopId, shop.id), eq(schema.leads.phone, input.phone), inArray(schema.leads.status, ["abandoned", "contacted"])));
      return number;
    });
    return { ok: true, orderId, number };
  } catch (err) {
    if (err instanceof OutOfStock) return { ok: false, error: "stock" };
    throw err;
  }
}
