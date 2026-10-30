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

      // The visitor's abandoned checkout (the draft saved while they typed) becomes this order: it gives its number
      const number = (await dropAbandoned(tx, shop.id, input.phone, product.id)) ?? (await nextOrderNumber(tx, shop.id));
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
      await tx.insert(schema.orderEvents).values({ id: newId(), orderId, shopId: shop.id, userId: meta.memberId ?? null, type: "created", toStatus: "pending", note: member ? "↺" : null });
      if (suspicious) await tx.insert(schema.orderEvents).values({ id: newId(), orderId, shopId: shop.id, type: "risk", note: `${risk.score}: ${risk.reasons.join(", ")}` });
      // Hand the order to a call center agent (unless the shop assigns by hand)
      // (a locked order waits until it is unlocked: nobody can work on it yet; a suspicious one waits for a review
      // when the store holds them)
      if (autoFake) await applyOrderStatus(tx, shop.id, orderId, "flagged", null, `${risk.score}/100`);
      const agent = locked || autoFake || (suspicious && protection.holdSuspicious) ? null : await pickAgent(tx, shop.id);
      if (agent) {
        await tx.update(schema.orders).set({ assignedTo: agent.userId, assignedAt: new Date() }).where(eq(schema.orders.id, orderId));
        await tx.insert(schema.orderEvents).values({ id: newId(), orderId, shopId: shop.id, type: "assign", note: agent.name });
      }
      return number;
    });
    return { ok: true, orderId, number };
  } catch (err) {
    if (err instanceof OutOfStock) return { ok: false, error: "stock" };
    throw err;
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// The shop's next order number (#1001, #1002…); the shop row is locked so two orders never get the same one
export async function nextOrderNumber(tx: Tx, shopId: string) {
  await tx.select({ id: schema.shops.id }).from(schema.shops).where(eq(schema.shops.id, shopId)).for("update");
  const [last] = await tx.select({ number: schema.orders.number }).from(schema.orders).where(eq(schema.orders.shopId, shopId)).orderBy(desc(schema.orders.number)).limit(1);
  return last ? last.number + 1 : FIRST_ORDER_NUMBER;
}

// The abandoned checkouts of a phone for a product (drafts of the last day), removed once the real order exists
async function abandonedDrafts(tx: Tx | typeof db, shopId: string, phone: string, productId: string) {
  return tx
    .select({ id: schema.orders.id, number: schema.orders.number })
    .from(schema.orders)
    .innerJoin(schema.orderItems, eq(schema.orderItems.orderId, schema.orders.id))
    .where(and(eq(schema.orders.shopId, shopId), eq(schema.orders.phone, phone), eq(schema.orders.status, "abandoned"), eq(schema.orderItems.productId, productId), gte(schema.orders.createdAt, new Date(Date.now() - 86400_000))));
}

// Deletes the drafts and returns the first one's number (the real order takes it, so carts never leave gaps)
async function dropAbandoned(tx: Tx, shopId: string, phone: string, productId: string) {
  await tx.select({ id: schema.shops.id }).from(schema.shops).where(eq(schema.shops.id, shopId)).for("update");
  const drafts = await abandonedDrafts(tx, shopId, phone, productId);
  const ids = drafts.map((r) => r.id);
  if (!ids.length) return null;
  await tx.delete(schema.orderItems).where(inArray(schema.orderItems.orderId, ids));
  await tx.delete(schema.orderEvents).where(inArray(schema.orderEvents.orderId, ids));
  await tx.delete(schema.orders).where(and(eq(schema.orders.shopId, shopId), inArray(schema.orders.id, ids)));
  return Math.min(...drafts.map((d) => d.number));
}

// Abandoned orders (Zimam's "Abandoned Orders"): as soon as a visitor types a valid phone in the order form, a draft
// order is kept with what they chose; it shows under the Abandoned tab until they order (then it is removed) or the team
// recovers it. Drafts take no stock, no plan slot and no agent; one per phone and product per day (updated as they type).
export async function saveAbandoned(shopId: string, productId: string, input: { name: string; phone: string; wilaya: number | null; variantId: string | null; quantity: number }, ip: string | null) {
  const [product] = await db.select().from(schema.products).where(and(eq(schema.products.shopId, shopId), eq(schema.products.id, productId), eq(schema.products.status, "active")));
  if (!product) return;
  const [variant] = input.variantId ? await db.select().from(schema.productVariants).where(and(eq(schema.productVariants.shopId, shopId), eq(schema.productVariants.id, input.variantId))) : [];
  const line = linePrice(variant?.price ?? product.price, input.quantity, product.offers);
  const values = { customerName: input.name, wilayaCode: input.wilaya ?? 0, subtotal: line.total, total: line.total };
  const [draft] = await abandonedDrafts(db, shopId, input.phone, productId);
  if (draft) {
    await db.transaction(async (tx) => {
      await tx.update(schema.orders).set(values).where(eq(schema.orders.id, draft.id));
      await tx.update(schema.orderItems).set({ variantId: variant?.id ?? null, variantTitle: variant?.title ?? null, unitPrice: line.unitPrice, quantity: input.quantity, total: line.total }).where(eq(schema.orderItems.orderId, draft.id));
    });
    return;
  }
  const orderId = newId();
  await db.transaction(async (tx) => {
    const number = await nextOrderNumber(tx, shopId);
    await tx.insert(schema.orders).values({ id: orderId, shopId, number, status: "abandoned", phone: input.phone, commune: "", deliveryType: "home", shippingPrice: 0, ip, ...values });
    await tx.insert(schema.orderItems).values({ id: newId(), orderId, shopId, productId: product.id, variantId: variant?.id ?? null, name: product.name, variantTitle: variant?.title ?? null, sku: variant?.sku || product.sku, unitPrice: line.unitPrice, quantity: input.quantity, total: line.total, stockTracked: false });
    await tx.insert(schema.orderEvents).values({ id: newId(), orderId, shopId, type: "created", toStatus: "abandoned" });
  });
}
