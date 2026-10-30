import "server-only";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { newId } from "@/server/auth/context";
import type { StoreShop } from "@/features/storefront/queries";
import { getShippingRates } from "@/features/storefront/queries";
import { checkOrderAllowed, protectionFor, riskSignals, scoreOrder, type BlockReason } from "./protection";
import { isObviousBot } from "./risk";
import { lineShipping, linePrice, shippingPrice } from "./pricing";
import { pickAgent } from "@/features/team/assign";
import { takeOrderSlot } from "@/features/plans/locked";
import { orderRule } from "@/server/limits";
import type { OrderInput } from "./validators";
import { logStock } from "@/features/inventory/movements";
import { applyOrderStatus } from "@/features/orders/transition";
import type { OrderTracking } from "@/server/db/schema";

export type CheckoutError = BlockReason | "unavailable" | "variant" | "stock" | "shipping";
export type PlaceOrderResult = { ok: true; orderId: string; number: number } | { ok: false; error: CheckoutError };

const FIRST_ORDER_NUMBER = 1001;

class OutOfStock extends Error {}

// Creates a cash-on-delivery order for one product. Used by every order form, and by the team when an abandoned cart
// is recovered by phone (meta.memberId: the protection's customer checks and the risk score are skipped — a person
// talked to the customer).
export async function placeOrder(shop: Pick<StoreShop, "id">, productId: string, input: OrderInput, meta: { ip: string | null; userAgent: string | null; landingPageId?: string | null; extra?: { label: string; value: string }[]; tracking?: OrderTracking | null; memberId?: string }): Promise<PlaceOrderResult> {
  const [product] = await db
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.shopId, shop.id), eq(schema.products.id, productId), eq(schema.products.status, "active")));
  if (!product) return { ok: false, error: "unavailable" };

  const variants = await db.select().from(schema.productVariants).where(and(eq(schema.productVariants.shopId, shop.id), eq(schema.productVariants.productId, product.id)));
  const variant = variants.find((v) => v.id === input.variantId) ?? null;
  if (variants.length > 0 && !variant) return { ok: false, error: "variant" };

  // Fake-order protection: refuse what the store does not accept, score the rest (suspicious orders are flagged)
  const protection = await protectionFor(shop.id);
  const member = Boolean(meta.memberId);
  if (!member) {
    const blocked = await checkOrderAllowed(shop.id, input, meta.ip, product.id, protection);
    if (blocked) return { ok: false, error: blocked };
  }
  const signals = await riskSignals(shop.id, input, meta, protection);
  if (!member && protection.blockBots && isObviousBot(signals)) return { ok: false, error: "bot" };
  const risk = member ? { score: 0, reasons: [] } : scoreOrder(signals);
  const suspicious = risk.score >= protection.riskThreshold;
  // Very high risk: marked "fake order" right away (kept for the record, given to nobody, stock given back)
  const autoFake = protection.autoFakeScore > 0 && risk.score >= protection.autoFakeScore;

  const line = linePrice(variant?.price ?? product.price, input.quantity, product.offers);
  const shipping = lineShipping(shippingPrice(await getShippingRates(shop.id), input.wilaya, input.deliveryType), line.offer);
  if (shipping === null) return { ok: false, error: "shipping" };
  const orderId = newId();
  const rule = await orderRule(shop.id);
  let locked = false;

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
        await logStock(tx, [{ shopId: shop.id, productId: product.id, variantId: variant?.id, delta: -input.quantity, reason: "order", orderId }]);
      }

      // Lock the shop row so two simultaneous orders never get the same number.
      await tx.select({ id: schema.shops.id }).from(schema.shops).where(eq(schema.shops.id, shop.id)).for("update");
      const [last] = await tx.select({ number: schema.orders.number }).from(schema.orders).where(eq(schema.orders.shopId, shop.id)).orderBy(desc(schema.orders.number)).limit(1);
      const number = last ? last.number + 1 : FIRST_ORDER_NUMBER;
      // Over the plan's monthly orders, or no pay-as-you-go balance left: kept (the customer is never turned away) but locked
      locked = await takeOrderSlot(tx, shop.id, rule);

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
        tracking: meta.tracking ?? null,
        locked,
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 255) ?? null,
        risk: risk.score,
        riskReasons: risk.reasons.length ? risk.reasons : null,
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
        // The offer as the team sees it on the order: its name, and the gift to put in the parcel
        offerLabel: line.offer ? [line.offer.label || `${line.offer.quantity}×`, line.offer.gift && `🎁 ${line.offer.gift}`].filter(Boolean).join(" · ").slice(0, 160) : null,
        stockTracked: product.trackStock,
      });
      await tx.insert(schema.orderEvents).values({ id: newId(), orderId, shopId: shop.id, userId: meta.memberId ?? null, type: "created", toStatus: "new", note: member ? "↺" : null });
      if (suspicious) await tx.insert(schema.orderEvents).values({ id: newId(), orderId, shopId: shop.id, type: "risk", note: `${risk.score}: ${risk.reasons.join(", ")}` });
      // Hand the order to a call center agent (unless the shop assigns by hand)
      // (a locked order waits until it is unlocked: nobody can work on it yet; a suspicious one waits for a review
      // when the store holds them)
      if (autoFake) await applyOrderStatus(tx, shop.id, orderId, "fake", null, `${risk.score}/100`);
      const agent = locked || autoFake || (suspicious && protection.holdSuspicious) ? null : await pickAgent(tx, shop.id);
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
