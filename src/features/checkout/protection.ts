import "server-only";
import { and, count, countDistinct, eq, gte, ne } from "drizzle-orm";
import { db, schema } from "@/server/db";
import type { ProtectionSettings } from "@/lib/enums";
import { resolveProtection } from "./protection-settings";
import { isBotAgent, scoreOrder, type RiskSignals } from "./risk";

export const MAX_LEADS_PER_IP_PER_HOUR = 30;

export type BlockReason = "blocked" | "tooMany" | "duplicate" | "bot";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);

export async function protectionFor(shopId: string): Promise<ProtectionSettings> {
  const [row] = await db.select({ protection: schema.shops.protection }).from(schema.shops).where(eq(schema.shops.id, shopId));
  return resolveProtection(row?.protection);
}

// Refuses blocked numbers, floods from one phone or one connection, and the same product ordered twice
// by the same phone while the first order is still new (limits from the store's protection settings).
export async function checkOrderAllowed(shopId: string, phone: string, ip: string | null, productId: string, settings: ProtectionSettings): Promise<BlockReason | null> {
  const o = schema.orders;
  const [[blocked], [byPhone], [byIp], [duplicate]] = await Promise.all([
    db.select({ n: count() }).from(schema.blockedPhones).where(and(eq(schema.blockedPhones.shopId, shopId), eq(schema.blockedPhones.phone, phone))),
    db.select({ n: count() }).from(o).where(and(eq(o.shopId, shopId), eq(o.phone, phone), gte(o.createdAt, hoursAgo(24)))),
    ip ? db.select({ n: count() }).from(o).where(and(eq(o.shopId, shopId), eq(o.ip, ip), gte(o.createdAt, hoursAgo(1)))) : Promise.resolve([{ n: 0 }]),
    settings.blockDuplicates
      ? db
          .select({ n: count() })
          .from(o)
          .innerJoin(schema.orderItems, eq(schema.orderItems.orderId, o.id))
          .where(and(eq(o.shopId, shopId), eq(o.phone, phone), eq(o.status, "new"), eq(schema.orderItems.productId, productId), gte(o.createdAt, hoursAgo(24))))
      : Promise.resolve([{ n: 0 }]),
  ]);
  if (blocked.n > 0) return "blocked";
  if (duplicate.n > 0) return "duplicate";
  if (byPhone.n >= settings.maxPerPhonePerDay || byIp.n >= settings.maxPerIpPerHour) return "tooMany";
  return null;
}

// Everything the risk score looks at for a new order (src/features/checkout/risk.ts)
export async function riskSignals(shopId: string, input: { phone: string; name: string; fill: number | null }, meta: { ip: string | null; userAgent: string | null }, settings: ProtectionSettings): Promise<RiskSignals> {
  const o = schema.orders;
  const [history, [network], [ipPhones]] = await Promise.all([
    db.select({ status: o.status, n: count() }).from(o).where(and(eq(o.shopId, shopId), eq(o.phone, input.phone))).groupBy(o.status),
    settings.useNetwork ? db.select({ n: count() }).from(o).where(and(eq(o.phone, input.phone), ne(o.shopId, shopId), eq(o.status, "returned"))) : Promise.resolve([{ n: 0 }]),
    meta.ip ? db.select({ n: countDistinct(o.phone) }).from(o).where(and(eq(o.shopId, shopId), eq(o.ip, meta.ip), ne(o.phone, input.phone), gte(o.createdAt, hoursAgo(24)))) : Promise.resolve([{ n: 0 }]),
  ]);
  const by = (s: string) => history.find((h) => h.status === s)?.n ?? 0;
  return {
    returned: by("returned"),
    cancelled: by("cancelled"),
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

export async function leadsFromIpLastHour(shopId: string, ip: string | null) {
  if (!ip) return 0;
  const [row] = await db.select({ n: count() }).from(schema.leads).where(and(eq(schema.leads.shopId, shopId), eq(schema.leads.ip, ip), gte(schema.leads.createdAt, hoursAgo(1))));
  return row.n;
}
