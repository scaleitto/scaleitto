import "server-only";
import { and, count, countDistinct, eq, gte, inArray, ne } from "drizzle-orm";
import { db, schema } from "@/server/db";
import type { ProtectionSettings } from "@/lib/enums";
import { blockedWordIn, resolveProtection } from "./protection-settings";
import { PENDING_STATUSES } from "@/features/orders/statuses";
import { isBotAgent, scoreOrder, type RiskSignals } from "./risk";

export const MAX_LEADS_PER_IP_PER_HOUR = 30;

export type BlockReason = "blocked" | "tooMany" | "duplicate" | "bot" | "quantity" | "noWilaya";
type OrderCheck = { phone: string; name: string; address?: string | null; note?: string | null; wilaya: number; quantity: number };

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);

export async function protectionFor(shopId: string): Promise<ProtectionSettings> {
  const [row] = await db.select({ protection: schema.shops.protection }).from(schema.shops).where(eq(schema.shops.id, shopId));
  return resolveProtection(row?.protection);
}

// Refuses what the store's protection settings do not accept: blocked numbers, connections and words, wilayas the
// store does not serve, too many pieces, floods from one phone (day / week) or one connection, and the same product
// ordered again by the same phone while the first order is not sent yet.
export async function checkOrderAllowed(shopId: string, input: OrderCheck, ip: string | null, productId: string, settings: ProtectionSettings): Promise<BlockReason | null> {
  const { phone } = input;
  if (ip && settings.blockedIps.includes(ip)) return "blocked";
  if (!settings.enabled) {
    // Protection off: only the blacklist (blocked connections above, blocked numbers here)
    const [[blocked]] = await Promise.all([db.select({ n: count() }).from(schema.blockedPhones).where(and(eq(schema.blockedPhones.shopId, shopId), eq(schema.blockedPhones.phone, phone)))]);
    return blocked.n > 0 ? "blocked" : null;
  }
  if (blockedWordIn(settings.blockedWords, input.name, input.address, input.note)) return "blocked";
  if (settings.blockedWilayas.includes(input.wilaya)) return "noWilaya";
  if (settings.maxQuantity > 0 && input.quantity > settings.maxQuantity) return "quantity";
  const o = schema.orders;
  // Abandoned checkouts are not orders: they never count towards the limits
  const real = ne(o.status, "abandoned");
  const [[blocked], [byPhone], [byWeek], [byIp], [duplicate]] = await Promise.all([
    db.select({ n: count() }).from(schema.blockedPhones).where(and(eq(schema.blockedPhones.shopId, shopId), eq(schema.blockedPhones.phone, phone))),
    db.select({ n: count() }).from(o).where(and(eq(o.shopId, shopId), real, eq(o.phone, phone), gte(o.createdAt, hoursAgo(24)))),
    db.select({ n: count() }).from(o).where(and(eq(o.shopId, shopId), real, eq(o.phone, phone), gte(o.createdAt, hoursAgo(24 * 7)))),
    ip ? db.select({ n: count() }).from(o).where(and(eq(o.shopId, shopId), real, eq(o.ip, ip), gte(o.createdAt, hoursAgo(1)))) : Promise.resolve([{ n: 0 }]),
    settings.blockDuplicates
      ? db
          .select({ n: count() })
          .from(o)
          .innerJoin(schema.orderItems, eq(schema.orderItems.orderId, o.id))
          .where(and(eq(o.shopId, shopId), eq(o.phone, phone), inArray(o.status, [...PENDING_STATUSES, "confirmed"]), eq(schema.orderItems.productId, productId), gte(o.createdAt, hoursAgo(settings.duplicateHours))))
      : Promise.resolve([{ n: 0 }]),
  ]);
  if (blocked.n > 0) return "blocked";
  if (duplicate.n > 0) return "duplicate";
  if (byPhone.n >= settings.maxPerPhonePerDay || byWeek.n >= settings.maxPerPhonePerWeek || byIp.n >= settings.maxPerIpPerHour) return "tooMany";
  return null;
}

// Everything the risk score looks at for a new order (src/features/checkout/risk.ts)
export async function riskSignals(shopId: string, input: { phone: string; name: string; fill: number | null }, meta: { ip: string | null; userAgent: string | null }, settings: ProtectionSettings): Promise<RiskSignals> {
  const o = schema.orders;
  const [history, [network], [ipPhones]] = await Promise.all([
    db.select({ status: o.status, n: count() }).from(o).where(and(eq(o.shopId, shopId), eq(o.phone, input.phone))).groupBy(o.status),
    settings.useNetwork ? db.select({ n: count() }).from(o).where(and(eq(o.phone, input.phone), ne(o.shopId, shopId), inArray(o.status, ["returned", "flagged"]))) : Promise.resolve([{ n: 0 }]),
    meta.ip ? db.select({ n: countDistinct(o.phone) }).from(o).where(and(eq(o.shopId, shopId), ne(o.status, "abandoned"), eq(o.ip, meta.ip), ne(o.phone, input.phone), gte(o.createdAt, hoursAgo(24)))) : Promise.resolve([{ n: 0 }]),
  ]);
  const by = (s: string) => history.find((h) => h.status === s)?.n ?? 0;
  return {
    returned: by("returned"),
    cancelled: by("cancelled"),
    fake: by("flagged"),
    delivered: by("delivered"),
    networkReturned: network.n,
    fillSeconds: input.fill,
    minFillSeconds: settings.minFillSeconds,
    botAgent: isBotAgent(meta.userAgent),
    name: input.name,
    phonesFromIp: ipPhones.n + 1,
  };
}

export { scoreOrder };


// After an order is marked fake / wrong number: the phone is blocked once it reaches the store's limit
export async function autoBlockFakePhone(shopId: string, phone: string) {
  const settings = await protectionFor(shopId);
  if (!settings.autoBlockFake) return false;
  const o = schema.orders;
  const [row] = await db.select({ n: count() }).from(o).where(and(eq(o.shopId, shopId), eq(o.phone, phone), eq(o.status, "flagged")));
  if (row.n < settings.autoBlockFake) return false;
  await db.insert(schema.blockedPhones).ignore().values({ shopId, phone, reason: `auto: ${row.n}× fake` });
  return true;
}
