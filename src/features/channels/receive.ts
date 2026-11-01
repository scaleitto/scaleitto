import "server-only";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { newId } from "@/server/auth/context";
import type { ChannelKind } from "@/server/db/schema";
import { nextOrderNumber } from "@/features/checkout/place-order";
import { takeOrderSlot } from "@/features/plans/locked";
import { orderRule } from "@/server/limits";
import { pickAgent } from "@/features/team/assign";
import { scheduleOrderSync } from "@/features/apps/sync";
import type { ExternalOrder } from "./parse";

// A connected platform's new order becomes an order here (status pending, like a store order): never twice (external
// ref), lines matched to the store's products by SKU then by name (unmatched lines keep their name and price), the
// plan's monthly count, an agent by the store's rule. The platform keeps its own stock: none is taken here.
export async function receiveOrder(shopId: string, kind: ChannelKind, order: ExternalOrder): Promise<{ created: boolean; id: string }> {
  const [existing] = await db.select({ id: schema.orders.id }).from(schema.orders).where(and(eq(schema.orders.shopId, shopId), eq(schema.orders.externalRef, order.ref)));
  if (existing) return { created: false, id: existing.id };

  const skus = order.lines.map((l) => l.sku).filter((s): s is string => Boolean(s));
  const names = order.lines.map((l) => l.name);
  const products = await db
    .select({ id: schema.products.id, name: schema.products.name, sku: schema.products.sku })
    .from(schema.products)
    .where(and(eq(schema.products.shopId, shopId), or(skus.length ? inArray(schema.products.sku, skus) : undefined, inArray(schema.products.name, names))));
  const variants = skus.length
    ? await db.select({ id: schema.productVariants.id, productId: schema.productVariants.productId, sku: schema.productVariants.sku, title: schema.productVariants.title }).from(schema.productVariants).where(and(eq(schema.productVariants.shopId, shopId), inArray(schema.productVariants.sku, skus)))
    : [];
  const lines = order.lines.map((l) => {
    const variant = l.sku ? variants.find((v) => v.sku === l.sku) : undefined;
    const product = variant ? products.find((p) => p.id === variant.productId) : (products.find((p) => l.sku && p.sku === l.sku) ?? products.find((p) => p.name === l.name));
    return {
      productId: variant?.productId ?? product?.id ?? null,
      variantId: variant?.id ?? null,
      name: product?.name ?? l.name,
      variantTitle: variant?.title ?? l.variant,
      sku: l.sku,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      total: l.unitPrice * l.quantity,
      stockTracked: false,
    };
  });
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const id = newId();
  const rule = await orderRule(shopId);
  try {
    await db.transaction(async (tx) => {
      const number = await nextOrderNumber(tx, shopId);
      const locked = await takeOrderSlot(tx, shopId, rule);
      await tx.insert(schema.orders).values({
        id,
        shopId,
        number,
        status: "pending",
        customerName: order.name || "—",
        phone: order.phone,
        wilayaCode: order.wilayaCode,
        commune: order.commune,
        address: order.address,
        deliveryType: "home",
        subtotal,
        shippingPrice: order.shipping,
        total: order.total || subtotal + order.shipping,
        customerNote: order.note,
        channel: kind,
        externalRef: order.ref,
        locked,
      });
      if (lines.length) await tx.insert(schema.orderItems).values(lines.map((l) => ({ id: newId(), orderId: id, shopId, ...l })));
      await tx.insert(schema.orderEvents).values({ id: newId(), orderId: id, shopId, type: "created", toStatus: "pending", note: `${kind} ${order.label}` });
      const agent = locked ? null : await pickAgent(tx, shopId);
      if (agent) {
        await tx.update(schema.orders).set({ assignedTo: agent.userId, assignedAt: new Date() }).where(eq(schema.orders.id, id));
        await tx.insert(schema.orderEvents).values({ id: newId(), orderId: id, shopId, type: "assign", note: agent.name });
      }
      await tx
        .update(schema.shopChannels)
        .set({ lastOrderAt: new Date(), ordersCount: sql`${schema.shopChannels.ordersCount} + 1` })
        .where(and(eq(schema.shopChannels.shopId, shopId), eq(schema.shopChannels.kind, kind)));
    });
  } catch (err) {
    // The same order delivered twice at once: the other request created it
    if (err instanceof Error && /Duplicate entry .*orders_shop_external_uq/.test(err.message)) {
      const [row] = await db.select({ id: schema.orders.id }).from(schema.orders).where(and(eq(schema.orders.shopId, shopId), eq(schema.orders.externalRef, order.ref)));
      if (row) return { created: false, id: row.id };
    }
    throw err;
  }
  await scheduleOrderSync(shopId, id);
  return { created: true, id };
}
