import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { isValidTag, type ClientPixel } from "./ids";

// The pixels a storefront page loads: those for every page, plus those of the page's products.
export async function pagePixels(shopId: string, productIds: string[] = []): Promise<ClientPixel[]> {
  const rows = await db
    .select({ platform: schema.pixels.platform, id: schema.pixels.tagId, purchaseOn: schema.pixels.purchaseOn, productIds: schema.pixels.productIds })
    .from(schema.pixels)
    .where(and(eq(schema.pixels.shopId, shopId), eq(schema.pixels.active, true)));
  return rows
    .filter((p) => isValidTag(p.platform, p.id) && (!p.productIds || p.productIds.some((id) => productIds.includes(id))))
    .map((p) => ({ platform: p.platform, id: p.id, purchaseOn: p.purchaseOn }));
}

export async function listPixels(shopId: string) {
  const rows = await db.select().from(schema.pixels).where(eq(schema.pixels.shopId, shopId)).orderBy(desc(schema.pixels.createdAt));
  // The secret never leaves the server: only whether one is saved
  return rows.map(({ secret, ...p }) => ({ ...p, hasSecret: Boolean(secret) }));
}
export type PixelRow = Awaited<ReturnType<typeof listPixels>>[number];

// Last server-side events, for the log on the dashboard
export async function recentPixelEvents(shopId: string, limit = 30) {
  return db
    .select({ id: schema.pixelEvents.id, event: schema.pixelEvents.event, status: schema.pixelEvents.status, detail: schema.pixelEvents.detail, createdAt: schema.pixelEvents.createdAt, pixelName: schema.pixels.name, platform: schema.pixels.platform, orderNumber: schema.orders.number })
    .from(schema.pixelEvents)
    .innerJoin(schema.pixels, eq(schema.pixels.id, schema.pixelEvents.pixelId))
    .leftJoin(schema.orders, eq(schema.orders.id, schema.pixelEvents.orderId))
    .where(eq(schema.pixelEvents.shopId, shopId))
    .orderBy(desc(schema.pixelEvents.createdAt))
    .limit(limit);
}

// The thank-you page: pixels of the ordered products, and the order as the browser reports it.
export async function orderPixels(shopId: string, order: { id: string; total: number; items: { productId: string | null; name: string; unitPrice: number; quantity: number }[] }) {
  const ids = order.items.map((i) => i.productId).filter((id): id is string => Boolean(id));
  return {
    pixels: await pagePixels(shopId, ids),
    order: { id: order.id, total: order.total, items: order.items.map((i) => ({ id: i.productId ?? i.name, name: i.name, price: i.unitPrice, quantity: i.quantity })) },
  };
}
