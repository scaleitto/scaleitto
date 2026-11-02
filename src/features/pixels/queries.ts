import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { pixelPlatforms, type PixelPlatform } from "@/server/db/schema";
import { isValidTag, type ClientPixel } from "./ids";

// The pixels a storefront page loads: those for every page, plus those of the page's products. A landing page can
// keep only some of them per platform (`only`: platform → pixel row ids; a platform not listed keeps all of its).
export async function pagePixels(shopId: string, productIds: string[] = [], only?: Record<string, string[]> | null): Promise<ClientPixel[]> {
  const rows = await db
    .select({ rowId: schema.pixels.id, platform: schema.pixels.platform, id: schema.pixels.tagId, purchaseOn: schema.pixels.purchaseOn, productIds: schema.pixels.productIds })
    .from(schema.pixels)
    .where(and(eq(schema.pixels.shopId, shopId), eq(schema.pixels.active, true)));
  return rows
    .filter((p) => isValidTag(p.platform, p.id) && (!p.productIds || p.productIds.some((id) => productIds.includes(id))) && (!only?.[p.platform] || only[p.platform].includes(p.rowId)))
    .map((p) => ({ platform: p.platform, id: p.id, purchaseOn: p.purchaseOn }));
}

// One app page's pixels (oldest first: the order they were added)
export async function listPixels(shopId: string, platform: PixelPlatform) {
  const rows = await db.select().from(schema.pixels).where(and(eq(schema.pixels.shopId, shopId), eq(schema.pixels.platform, platform))).orderBy(asc(schema.pixels.createdAt));
  // The secret never leaves the server: only whether one is saved
  return rows.map(({ secret, ...p }) => ({ ...p, hasSecret: Boolean(secret) }));
}
export type PixelRow = Awaited<ReturnType<typeof listPixels>>[number];

// The Pixels grid: how many pixels each platform has, and how many run
export async function pixelSummary(shopId: string) {
  const rows = await db.select({ platform: schema.pixels.platform, active: schema.pixels.active }).from(schema.pixels).where(eq(schema.pixels.shopId, shopId));
  const out = {} as Record<PixelPlatform, { total: number; active: number }>;
  for (const p of pixelPlatforms) out[p] = { total: 0, active: 0 };
  for (const r of rows) {
    out[r.platform].total++;
    if (r.active) out[r.platform].active++;
  }
  return out;
}

// Last server-side events of one platform, for the log on its page
export async function recentPixelEvents(shopId: string, platform: PixelPlatform, limit = 30) {
  return db
    .select({ id: schema.pixelEvents.id, event: schema.pixelEvents.event, status: schema.pixelEvents.status, detail: schema.pixelEvents.detail, createdAt: schema.pixelEvents.createdAt, pixelName: schema.pixels.name, platform: schema.pixels.platform, orderNumber: schema.orders.number })
    .from(schema.pixelEvents)
    .innerJoin(schema.pixels, eq(schema.pixels.id, schema.pixelEvents.pixelId))
    .leftJoin(schema.orders, eq(schema.orders.id, schema.pixelEvents.orderId))
    .where(and(eq(schema.pixelEvents.shopId, shopId), eq(schema.pixels.platform, platform)))
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
