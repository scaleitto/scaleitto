import "server-only";
import { turnstileSiteKey, verifyTurnstile } from "@/server/turnstile";
import { withPromotion } from "@/features/promotions/apply";
import { offered } from "@/features/products/variants";
import { resolveApps } from "@/features/apps/settings";
import { matchDeliveryRule } from "@/features/apps/rules";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { newId } from "@/server/auth/context";
import type { StoreShop } from "@/features/storefront/queries";
import { getShippingRates } from "@/features/storefront/queries";
import { checkOrderAllowed, protectionFor, riskSignals, scoreOrder, type BlockReason } from "./protection";
import { isObviousBot } from "./risk";
import { lineShipping, linePrice, maxQuantityFor, resolveWholesale, shippingPrice } from "./pricing";
import { pickAgent } from "@/features/team/assign";
import { takeOrderSlot } from "@/features/plans/locked";
import { orderRule } from "@/server/limits";
import type { OrderInput } from "./validators";
import { applyOrderStatus } from "@/features/orders/transition";
import type { OrderTracking } from "@/server/db/schema";

export type CheckoutError = BlockReason | "unavailable" | "variant" | "stock" | "shipping" | "invalid" | "minQuantity" | "maxPerOrder" | "captcha" | "captchaDown";
export type PlaceOrderResult = { ok: true; orderId: string; number: number } | { ok: false; error: CheckoutError };

const FIRST_ORDER_NUMBER = 1001;

class OutOfStock extends Error {}

async function shopApps(shopId: string) {
  const [shop] = await db.select({ apps: schema.shops.apps }).from(schema.shops).where(eq(schema.shops.id, shopId));
  return resolveApps(shop?.apps);
}

// The delivery company the shop's rules give a new order (a company since disconnected is skipped)
async function ruleCarrier(shopId: string, order: { wilaya: number; total: number; deliveryType: "home" | "office" }) {
  const id = matchDeliveryRule((await shopApps(shopId)).deliveryRules, order);
  if (!id) return null;
  const [account] = await db.select({ id: schema.carrierAccounts.id }).from(schema.carrierAccounts).where(and(eq(schema.carrierAccounts.shopId, shopId), eq(schema.carrierAccounts.id, id)));
  return account?.id ?? null;
}

export type CartLine = { productId: string; variantId: string | null; quantity: number };
export const MAX_CART_LINES = 20;

// Creates a cash-on-delivery order for one product. Used by every order form, and by the team when an abandoned cart
// is recovered by phone (meta.memberId: the protection's customer checks and the risk score are skipped — a person
// talked to the customer).
export function placeOrder(shop: Pick<StoreShop, "id">, productId: string, input: OrderInput, meta: OrderMeta): Promise<PlaceOrderResult> {
  return placeCartOrder(shop, [{ productId, variantId: input.variantId || null, quantity: input.quantity }], input, meta);
}

type OrderMeta = { ip: string | null; userAgent: string | null; captcha?: string | null; landingPageId?: string | null; landingVersion?: string | null; extra?: { label: string; value: string }[]; tracking?: OrderTracking | null; memberId?: string };

// One order for one or several products (Apps → Shopping cart): every line priced as the store shows it (promotion,
// wholesale tier, quantity offer), its stock taken atomically, one delivery fee (free when a line's offer says so).
export async function placeCartOrder(shop: Pick<StoreShop, "id">, cart: CartLine[], input: OrderInput, meta: OrderMeta): Promise<PlaceOrderResult> {
  // The same product and variant twice count as one line
  const merged: CartLine[] = [];
  for (const l of cart) {
    const same = merged.find((m) => m.productId === l.productId && m.variantId === l.variantId);
    if (same) same.quantity += l.quantity;
    else merged.push({ ...l });
  }
  if (!merged.length || merged.length > MAX_CART_LINES) return { ok: false, error: "invalid" };
  const apps = await shopApps(shop.id);
  const productIds = [...new Set(merged.map((l) => l.productId))];
  const products = await db
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.shopId, shop.id), inArray(schema.products.id, productIds), eq(schema.products.status, "active")));
  if (products.length !== productIds.length) return { ok: false, error: "unavailable" };
  const allVariants = await db.select().from(schema.productVariants).where(and(eq(schema.productVariants.shopId, shop.id), inArray(schema.productVariants.productId, productIds)));

  type Line = { product: (typeof products)[number]; variant: (typeof allVariants)[number] | null; quantity: number; price: ReturnType<typeof linePrice> };
  const lines: Line[] = [];
  for (const l of merged) {
    const product = products.find((p) => p.id === l.productId)!;
    // Prices as the store shows them now (a running promotion lowers them)
    const { variants, ...priced } = await withPromotion(shop.id, { ...product, variants: offered(product.options, allVariants.filter((v) => v.productId === product.id)) });
    // Apps → Wholesale: the minimum order and the larger quantities apply while it is on
    const wholesale = apps.wholesale ? resolveWholesale(priced.wholesale) : null;
    if (l.quantity < 1 || l.quantity > maxQuantityFor(wholesale)) return { ok: false, error: "invalid" };
    if (wholesale && l.quantity < wholesale.minQty) return { ok: false, error: "minQuantity" };
    const variant = variants.find((v) => v.id === l.variantId) ?? null;
    if (variants.length > 0 && !variant) return { ok: false, error: "variant" };
    lines.push({ product, variant, quantity: l.quantity, price: linePrice(variant?.price ?? priced.price, l.quantity, priced.offers, wholesale) });
  }
  // The product's "maximum per order" counts all its combinations together
  for (const p of products) if (p.maxPerOrder && lines.filter((l) => l.product.id === p.id).reduce((n, l) => n + l.quantity, 0) > p.maxPerOrder) return { ok: false, error: "maxPerOrder" };
  const first = lines[0];
  const quantity = lines.reduce((n, l) => n + l.quantity, 0);

  // Fake-order protection: refuse what the store does not accept, score the rest (suspicious orders are flagged)
  const protection = await protectionFor(shop.id);
  const member = Boolean(meta.memberId);
  if (!member) {
    const blocked = await checkOrderAllowed(shop.id, { ...input, quantity }, meta.ip, first.product.id, protection);
    if (blocked) return { ok: false, error: blocked };
  }
  const signals = await riskSignals(shop.id, input, meta, protection);
  if (!member && protection.enabled && protection.blockBots && isObviousBot(signals)) return { ok: false, error: "bot" };
  const risk = member || !protection.enabled ? { score: 0, reasons: [] } : scoreOrder(signals);
  const suspicious = risk.score >= protection.riskThreshold;
  // Checkout captcha (Zimam): on every order, or only for a suspicious buyer; Cloudflare unreachable → the store's choice
  if (!member && protection.enabled && protection.captcha !== "never" && turnstileSiteKey() && (protection.captcha === "always" || suspicious)) {
    const check = await verifyTurnstile(meta.captcha, meta.ip);
    if (check === "failed") return { ok: false, error: "captcha" };
    if (check === "unreachable" && protection.captchaFallback === "refuse") return { ok: false, error: "captchaDown" };
  }
  // Very high risk: marked "fake order" right away (kept for the record, given to nobody, stock given back)
  const autoFake = protection.autoFakeScore > 0 && risk.score >= protection.autoFakeScore;

  const subtotal = lines.reduce((n, l) => n + l.price.total, 0);
  const freeOffer = lines.map((l) => l.price.offer).find((o) => o?.freeShipping) ?? null;
  // A product sold with one delivery option limits the order to it
  const shipping = lineShipping(shippingPrice(await getShippingRates(shop.id, lines.find((l) => l.product.deliveryOption)?.product.deliveryOption), input.wilaya, input.deliveryType), freeOffer);
  if (shipping === null) return { ok: false, error: "shipping" };
  const orderId = newId();
  const rule = await orderRule(shop.id);
  let locked = false;

  try {
    const number = await db.transaction(async (tx) => {
      // Take the stock first, only if enough is left (safe when two customers order the last piece).
      for (const l of lines) {
        if (!l.product.trackStock) continue;
        const [res] = l.variant
          ? await tx
              .update(schema.productVariants)
              .set({ stock: sql`${schema.productVariants.stock} - ${l.quantity}` })
              .where(and(eq(schema.productVariants.id, l.variant.id), gte(schema.productVariants.stock, l.quantity)))
          : await tx
              .update(schema.products)
              .set({ stock: sql`${schema.products.stock} - ${l.quantity}` })
              .where(and(eq(schema.products.id, l.product.id), gte(schema.products.stock, l.quantity)));
        if (res.affectedRows === 0) throw new OutOfStock();
      }

      // The visitor's abandoned checkouts (drafts saved while they typed) become this order: it gives their number
      let reused: number | null = null;
      for (const id of productIds) reused = (await dropAbandoned(tx, shop.id, input.phone, id)) ?? reused;
      const number = reused ?? (await nextOrderNumber(tx, shop.id));
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
        subtotal,
        shippingPrice: shipping,
        total: subtotal + shipping,
        customerNote: input.note || null,
        landingPageId: meta.landingPageId ?? null,
        landingVersion: meta.landingPageId ? (meta.landingVersion ?? "A") : null,
        // The product's own delivery company (Zimam: every order of this product goes to it), else Apps → Delivery
        // auto assign
        carrierAccountId: lines.find((l) => l.product.carrierAccountId)?.product.carrierAccountId ?? (await ruleCarrier(shop.id, { wilaya: input.wilaya, total: subtotal + shipping, deliveryType: input.deliveryType })),
        extra: meta.extra?.length ? meta.extra : null,
        tracking: meta.tracking ?? null,
        locked,
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 255) ?? null,
        risk: risk.score,
        riskReasons: risk.reasons.length ? risk.reasons : null,
      });
      await tx.insert(schema.orderItems).values(
        lines.map((l) => ({
          id: newId(),
          orderId,
          shopId: shop.id,
          productId: l.product.id,
          variantId: l.variant?.id ?? null,
          name: l.product.name,
          variantTitle: l.variant?.title ?? null,
          sku: l.variant?.sku || l.product.sku,
          unitPrice: l.price.unitPrice,
          quantity: l.quantity,
          total: l.price.total,
          // The offer as the team sees it on the order: its name, and the gift to put in the parcel
          offerLabel: l.price.offer ? [l.price.offer.label || `${l.price.offer.quantity}×`, l.price.offer.gift && `🎁 ${l.price.offer.gift}`].filter(Boolean).join(" · ").slice(0, 160) : null,
          stockTracked: l.product.trackStock,
        })),
      );
      await tx.insert(schema.orderEvents).values({ id: newId(), orderId, shopId: shop.id, userId: meta.memberId ?? null, type: "created", toStatus: "pending", note: member ? "↺" : null });
      if (suspicious) await tx.insert(schema.orderEvents).values({ id: newId(), orderId, shopId: shop.id, type: "risk", note: `${risk.score}: ${risk.reasons.join(", ")}` });
      // Hand the order to a call center agent (unless the shop assigns by hand)
      // (a locked order waits until it is unlocked: nobody can work on it yet; a suspicious one waits for a review
      // when the store holds them)
      if (autoFake) await applyOrderStatus(tx, shop.id, orderId, "flagged", null, `${risk.score}/100`);
      const agent = locked || autoFake || (suspicious && protection.holdSuspicious) ? null : await pickAgent(tx, shop.id, { productIds, wilaya: input.wilaya, source: meta.landingPageId ? "landing" : "store" });
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
  const [row] = input.variantId ? await db.select().from(schema.productVariants).where(and(eq(schema.productVariants.shopId, shopId), eq(schema.productVariants.id, input.variantId))) : [];
  const { variants, ...priced } = await withPromotion(shopId, { ...product, variants: row ? [row] : [] });
  const variant = variants[0];
  const wholesale = (await shopApps(shopId)).wholesale ? resolveWholesale(priced.wholesale) : null;
  const line = linePrice(variant?.price ?? priced.price, Math.min(input.quantity, maxQuantityFor(wholesale)), priced.offers, wholesale);
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
