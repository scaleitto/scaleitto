"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { newId } from "@/lib/auth";
import { canAdd } from "@/lib/limits";
import { getShopBySlug, storeBase } from "@/lib/store";
import { wilayas } from "@/lib/wilayas";
import { isValidDzPhone, normalizePhone } from "@/lib/phone";

export type OrderFormState = { error?: "phone" | "tooMany" | "stock" | "unavailable" | "closed" | "generic" };

// Fake-order protection thresholds
const MAX_ORDERS_PER_PHONE_PER_DAY = 3;
const MAX_ORDERS_PER_IP_PER_HOUR = 10;
const MAX_LEADS_PER_IP_PER_HOUR = 30;
// The post-purchase upsell can be accepted for this long after ordering
const UPSELL_WINDOW_MS = 30 * 60_000;

async function clientIp() {
  return ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
}

const orderSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().transform(normalizePhone),
  wilaya: z.coerce.number().int().refine((c) => wilayas.some((w) => w.code === c)),
  commune: z.string().trim().min(2).max(120),
  address: z.string().trim().max(255).optional().default(""),
  deliveryType: z.enum(["home", "desk"]),
  quantity: z.coerce.number().int().min(1).max(20),
  variantId: z.string().optional().default(""),
  website: z.string().optional().default(""), // honeypot: real customers never fill it
});

export async function placeOrder(
  slug: string,
  productId: string,
  landingPageId: string | null,
  _prev: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const shop = await getShopBySlug(slug);
  if (!shop) return { error: "closed" };

  const parsed = orderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "generic" };
  const d = parsed.data;
  if (d.website) return { error: "generic" };
  if (!isValidDzPhone(d.phone)) return { error: "phone" };

  if (!(await canAdd(shop.id, "maxOrdersPerMonth"))) return { error: "closed" };

  const ip = await clientIp();
  const dayAgo = new Date(Date.now() - 86400_000);
  const hourAgo = new Date(Date.now() - 3600_000);
  const [[byPhone], [byIp]] = await Promise.all([
    db.select({ n: count() }).from(schema.orders).where(and(eq(schema.orders.shopId, shop.id), eq(schema.orders.phone, d.phone), gte(schema.orders.createdAt, dayAgo))),
    ip
      ? db.select({ n: count() }).from(schema.orders).where(and(eq(schema.orders.shopId, shop.id), eq(schema.orders.ip, ip), gte(schema.orders.createdAt, hourAgo)))
      : Promise.resolve([{ n: 0 }]),
  ]);
  if (byPhone.n >= MAX_ORDERS_PER_PHONE_PER_DAY || byIp.n >= MAX_ORDERS_PER_IP_PER_HOUR) return { error: "tooMany" };

  const [product] = await db
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.id, productId), eq(schema.products.shopId, shop.id), eq(schema.products.status, "active")));
  if (!product) return { error: "generic" };

  let landing: string | null = null;
  if (landingPageId) {
    const [lp] = await db
      .select({ id: schema.landingPages.id })
      .from(schema.landingPages)
      .where(and(eq(schema.landingPages.id, landingPageId), eq(schema.landingPages.shopId, shop.id), eq(schema.landingPages.productId, product.id)));
    landing = lp?.id ?? null;
  }

  const variants = await db.select().from(schema.productVariants).where(eq(schema.productVariants.productId, product.id));
  const variant = variants.find((v) => v.id === d.variantId) ?? null;
  if (variants.length > 0 && !variant) return { error: "generic" };

  const available = variant ? variant.stock : product.stock;
  if (product.trackStock && available < d.quantity) return { error: "stock" };

  // Shipping: if the shop configured no rates at all, delivery is free everywhere.
  const rates = await db.select().from(schema.shippingRates).where(eq(schema.shippingRates.shopId, shop.id));
  let shippingCost = 0;
  if (rates.length > 0) {
    const rate = rates.find((r) => r.wilayaCode === d.wilaya);
    const price = d.deliveryType === "home" ? rate?.homePrice : rate?.deskPrice;
    if (price == null) return { error: "unavailable" };
    shippingCost = price;
  }

  const unitPrice = variant?.price ?? product.price;
  const offer = product.offers?.find((o) => o.quantity === d.quantity) ?? null;
  const subtotal = offer ? offer.price : unitPrice * d.quantity;
  const orderId = newId();

  const number = await db.transaction(async (tx) => {
    // Lock the shop row so two simultaneous orders don't get the same number.
    await tx.select({ id: schema.shops.id }).from(schema.shops).where(eq(schema.shops.id, shop.id)).for("update");
    const [last] = await tx
      .select({ number: schema.orders.number })
      .from(schema.orders)
      .where(eq(schema.orders.shopId, shop.id))
      .orderBy(desc(schema.orders.number))
      .limit(1);
    const next = (last?.number ?? 1000) + 1;

    await tx.insert(schema.orders).values({
      id: orderId,
      shopId: shop.id,
      number: next,
      customerName: d.name,
      phone: d.phone,
      wilayaCode: d.wilaya,
      commune: d.commune,
      address: d.address || null,
      deliveryType: d.deliveryType,
      subtotal,
      shippingCost,
      total: subtotal + shippingCost,
      ip,
      landingPageId: landing,
    });
    await tx.insert(schema.orderItems).values({
      id: newId(),
      orderId,
      productId: product.id,
      variantId: variant?.id ?? null,
      name: product.name,
      variantTitle: variant?.title ?? null,
      sku: variant?.sku ?? product.sku,
      unitPrice,
      quantity: d.quantity,
      lineTotal: offer ? offer.price : null,
    });
    if (product.trackStock) {
      if (variant) {
        await tx
          .update(schema.productVariants)
          .set({ stock: sql`GREATEST(${schema.productVariants.stock} - ${d.quantity}, 0)` })
          .where(eq(schema.productVariants.id, variant.id));
      } else {
        await tx
          .update(schema.products)
          .set({ stock: sql`GREATEST(${schema.products.stock} - ${d.quantity}, 0)` })
          .where(eq(schema.products.id, product.id));
      }
    }
    // This customer is no longer an abandoned cart.
    await tx
      .update(schema.leads)
      .set({ status: "converted", orderId })
      .where(
        and(
          eq(schema.leads.shopId, shop.id),
          eq(schema.leads.phone, d.phone),
          inArray(schema.leads.status, ["abandoned", "contacted"]),
          gte(schema.leads.createdAt, new Date(Date.now() - 7 * 86400_000)),
        ),
      );
    return next;
  });

  redirect(`${await storeBase(shop.slug)}/thanks?n=${number}&o=${orderId}`);
}

// Called from the order form as soon as the visitor has typed a valid phone,
// so merchants can call back people who leave without ordering.
export async function saveLead(
  slug: string,
  productId: string,
  landingPageId: string | null,
  input: { name: string; phone: string; wilaya: number | null },
) {
  const shop = await getShopBySlug(slug);
  if (!shop) return;
  const phone = normalizePhone(String(input.phone ?? ""));
  if (!isValidDzPhone(phone)) return;
  const name = String(input.name ?? "").trim().slice(0, 120) || null;
  const wilaya = wilayas.some((w) => w.code === input.wilaya) ? input.wilaya : null;

  const [product] = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(and(eq(schema.products.id, productId), eq(schema.products.shopId, shop.id)));
  if (!product) return;

  const dayAgo = new Date(Date.now() - 86400_000);
  const [existing] = await db
    .select({ id: schema.leads.id })
    .from(schema.leads)
    .where(and(eq(schema.leads.shopId, shop.id), eq(schema.leads.phone, phone), eq(schema.leads.productId, product.id), gte(schema.leads.createdAt, dayAgo)))
    .limit(1);
  if (existing) {
    await db.update(schema.leads).set({ name, wilayaCode: wilaya }).where(eq(schema.leads.id, existing.id));
    return;
  }

  const ip = await clientIp();
  if (ip) {
    const [byIp] = await db
      .select({ n: count() })
      .from(schema.leads)
      .where(and(eq(schema.leads.shopId, shop.id), eq(schema.leads.ip, ip), gte(schema.leads.createdAt, new Date(Date.now() - 3600_000))));
    if (byIp.n >= MAX_LEADS_PER_IP_PER_HOUR) return;
  }
  // Someone who already ordered this product today is not an abandoned cart.
  const [ordered] = await db
    .select({ n: count() })
    .from(schema.orders)
    .where(and(eq(schema.orders.shopId, shop.id), eq(schema.orders.phone, phone), gte(schema.orders.createdAt, dayAgo)));
  if (ordered.n > 0) return;

  await db.insert(schema.leads).values({
    id: newId(),
    shopId: shop.id,
    productId: product.id,
    landingPageId,
    name,
    phone,
    wilayaCode: wilaya,
    ip,
  });
}

export type UpsellState = { added?: boolean; total?: number; error?: "expired" | "stock" };

// One-click add-on from the thank-you page: adds the shop's upsell product to the
// order that was just placed, while it is still new and within the time window.
export async function acceptUpsell(slug: string, orderId: string): Promise<UpsellState> {
  const shop = await getShopBySlug(slug);
  if (!shop) return { error: "expired" };

  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(and(eq(schema.orders.id, orderId), eq(schema.orders.shopId, shop.id)))
      .for("update");
    if (!order || order.status !== "new" || Date.now() - order.createdAt.getTime() > UPSELL_WINDOW_MS) return { error: "expired" };

    const items = await tx.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
    if (items.some((i) => i.isUpsell)) return { added: true, total: order.total };
    const main = items[0];
    if (!main?.productId) return { error: "expired" };

    const [source] = await tx.select().from(schema.products).where(eq(schema.products.id, main.productId));
    if (!source?.upsellProductId) return { error: "expired" };
    const [upsell] = await tx
      .select()
      .from(schema.products)
      .where(and(eq(schema.products.id, source.upsellProductId), eq(schema.products.shopId, shop.id), eq(schema.products.status, "active")));
    if (!upsell) return { error: "expired" };
    // Upsells are single-variant add-ons for now; products with variants are skipped.
    const [{ n: variantCount }] = await tx.select({ n: count() }).from(schema.productVariants).where(eq(schema.productVariants.productId, upsell.id));
    if (variantCount > 0) return { error: "expired" };
    if (upsell.trackStock && upsell.stock < 1) return { error: "stock" };

    const price = source.upsellPrice ?? upsell.price;
    await tx.insert(schema.orderItems).values({
      id: newId(),
      orderId,
      productId: upsell.id,
      name: upsell.name,
      sku: upsell.sku,
      unitPrice: price,
      quantity: 1,
      isUpsell: true,
    });
    if (upsell.trackStock) {
      await tx
        .update(schema.products)
        .set({ stock: sql`GREATEST(${schema.products.stock} - 1, 0)` })
        .where(eq(schema.products.id, upsell.id));
    }
    const total = order.total + price;
    await tx.update(schema.orders).set({ subtotal: order.subtotal + price, total }).where(eq(schema.orders.id, orderId));
    return { added: true, total };
  });
}

// Counted from the visitor's browser (once per session) so prefetches, bots and
// server re-renders don't inflate landing page visits.
export async function recordLandingView(slug: string, landingPageId: string) {
  const shop = await getShopBySlug(slug);
  if (!shop) return;
  await db
    .update(schema.landingPages)
    .set({ views: sql`${schema.landingPages.views} + 1` })
    .where(and(eq(schema.landingPages.id, landingPageId), eq(schema.landingPages.shopId, shop.id)));
}
