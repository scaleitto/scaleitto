"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { newId } from "@/lib/auth";
import { canAdd } from "@/lib/limits";
import { getShopBySlug, storeBase } from "@/lib/store";
import { wilayas } from "@/lib/wilayas";

export type OrderFormState = { error?: "phone" | "tooMany" | "stock" | "unavailable" | "closed" | "generic" };

// Fake-order protection thresholds
const MAX_ORDERS_PER_PHONE_PER_DAY = 3;
const MAX_ORDERS_PER_IP_PER_HOUR = 10;

function normalizePhone(raw: string) {
  let p = raw.replace(/[\s.\-()]/g, "");
  if (p.startsWith("+213")) p = "0" + p.slice(4);
  else if (p.startsWith("00213")) p = "0" + p.slice(5);
  return p;
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

export async function placeOrder(slug: string, productId: string, _prev: OrderFormState, formData: FormData): Promise<OrderFormState> {
  const shop = await getShopBySlug(slug);
  if (!shop) return { error: "closed" };

  const parsed = orderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "generic" };
  const d = parsed.data;
  if (d.website) return { error: "generic" };
  if (!/^0[5-7]\d{8}$/.test(d.phone)) return { error: "phone" };

  if (!(await canAdd(shop.id, "maxOrdersPerMonth"))) return { error: "closed" };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
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
  const subtotal = unitPrice * d.quantity;
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
    return next;
  });

  redirect(`${await storeBase(shop.slug)}/thanks?n=${number}`);
}
