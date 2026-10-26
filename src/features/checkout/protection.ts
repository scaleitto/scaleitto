import "server-only";
import { and, count, eq, gte } from "drizzle-orm";
import { db, schema } from "@/server/db";

// Fake-order protection thresholds (per shop)
export const MAX_ORDERS_PER_PHONE_PER_DAY = 3;
export const MAX_ORDERS_PER_IP_PER_HOUR = 10;
export const MAX_LEADS_PER_IP_PER_HOUR = 30;

export type BlockReason = "blocked" | "tooMany" | "duplicate";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);

// Refuses blocked numbers, floods from one phone or one connection, and the same
// product ordered twice by the same phone while the first order is still new.
export async function checkOrderAllowed(shopId: string, phone: string, ip: string | null, productId: string): Promise<BlockReason | null> {
  const o = schema.orders;
  const [[blocked], [byPhone], [byIp], [duplicate]] = await Promise.all([
    db.select({ n: count() }).from(schema.blockedPhones).where(and(eq(schema.blockedPhones.shopId, shopId), eq(schema.blockedPhones.phone, phone))),
    db.select({ n: count() }).from(o).where(and(eq(o.shopId, shopId), eq(o.phone, phone), gte(o.createdAt, hoursAgo(24)))),
    ip ? db.select({ n: count() }).from(o).where(and(eq(o.shopId, shopId), eq(o.ip, ip), gte(o.createdAt, hoursAgo(1)))) : Promise.resolve([{ n: 0 }]),
    db
      .select({ n: count() })
      .from(o)
      .innerJoin(schema.orderItems, eq(schema.orderItems.orderId, o.id))
      .where(and(eq(o.shopId, shopId), eq(o.phone, phone), eq(o.status, "new"), eq(schema.orderItems.productId, productId), gte(o.createdAt, hoursAgo(24)))),
  ]);
  if (blocked.n > 0) return "blocked";
  if (duplicate.n > 0) return "duplicate";
  if (byPhone.n >= MAX_ORDERS_PER_PHONE_PER_DAY || byIp.n >= MAX_ORDERS_PER_IP_PER_HOUR) return "tooMany";
  return null;
}

export async function leadsFromIpLastHour(shopId: string, ip: string | null) {
  if (!ip) return 0;
  const [row] = await db.select({ n: count() }).from(schema.leads).where(and(eq(schema.leads.shopId, shopId), eq(schema.leads.ip, ip), gte(schema.leads.createdAt, hoursAgo(1))));
  return row.n;
}
