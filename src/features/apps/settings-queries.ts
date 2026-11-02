import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { resolveProtection } from "@/features/checkout/protection-settings";
import type { AppPageKey } from "./registry";
import { resolveApps } from "./settings";
import { runningPercents } from "@/features/promotions/apply";

// What the Apps pages need about the store, read once
export async function appsContext(shopId: string) {
  const [shop] = await db
    .select({ apps: schema.shops.apps, protection: schema.shops.protection, assignMode: schema.shops.assignMode, slug: schema.shops.slug })
    .from(schema.shops)
    .where(eq(schema.shops.id, shopId));
  return { apps: resolveApps(shop?.apps), protection: resolveProtection(shop?.protection), assignMode: shop?.assignMode ?? "balanced", slug: shop?.slug ?? "" };
}
export type AppsContext = Awaited<ReturnType<typeof appsContext>>;

// The grid's ACTIVE / INACTIVE pill (null = the app has no on/off state)
export async function appStates(shopId: string): Promise<Partial<Record<AppPageKey, boolean | null>>> {
  const ctx = await appsContext(shopId);
  const [webhook] = await db.select({ active: schema.shopApps.active }).from(schema.shopApps).where(and(eq(schema.shopApps.shopId, shopId), eq(schema.shopApps.app, "webhook")));
  const a = ctx.apps;
  const running = await runningPercents(shopId);
  return {
    cart: a.cart,
    abandoned: a.abandoned,
    fakeGuard: ctx.protection.enabled,
    agentAssign: ctx.assignMode !== "manual" || a.agentRules.some((r) => r.active),
    deliveryAssign: a.deliveryRules.some((r) => r.active),
    trustBadges: a.badges.some((b) => b.on),
    quickContact: (a.contact.phoneOn && Boolean(a.contact.phone)) || (a.contact.whatsappOn && Boolean(a.contact.whatsapp)),
    thankYou: Boolean(a.thanks.title || a.thanks.message || a.thanks.button || a.thanks.redirect === "product"),
    orderTracking: a.tracking.enabled,
    promotions: running.size > 0,
    customFields: a.customFields,
    parcelScanner: a.scanner,
    wholesale: a.wholesale,
    webhook: Boolean(webhook?.active),
  };
}

export async function blockedPhoneList(shopId: string) {
  return db.select({ phone: schema.blockedPhones.phone, reason: schema.blockedPhones.reason, createdAt: schema.blockedPhones.createdAt }).from(schema.blockedPhones).where(eq(schema.blockedPhones.shopId, shopId)).orderBy(desc(schema.blockedPhones.createdAt)).limit(500);
}

// The store's products for the QR generator (published ones have a page)
export async function qrProducts(shopId: string) {
  return db
    .select({ id: schema.products.id, name: schema.products.name, slug: schema.products.slug })
    .from(schema.products)
    .where(and(eq(schema.products.shopId, shopId), eq(schema.products.status, "active")))
    .orderBy(desc(schema.products.createdAt))
    .limit(200);
}
