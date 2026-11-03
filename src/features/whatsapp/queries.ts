import "server-only";
import { and, count, desc, eq, gte, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { algeriaMonthStart } from "@/lib/time";

// The WhatsApp app page: the store's products, balance and this month's messages and replies
export async function whatsappView(shopId: string) {
  const since = algeriaMonthStart();
  const m = schema.whatsappMessages;
  const o = schema.orders;
  const [products, [shop], [sent], replies] = await Promise.all([
    db.select({ id: schema.products.id, name: schema.products.name }).from(schema.products).where(eq(schema.products.shopId, shopId)).orderBy(desc(schema.products.createdAt)).limit(300),
    db.select({ credits: schema.shops.credits }).from(schema.shops).where(eq(schema.shops.id, shopId)),
    db.select({ n: count() }).from(m).where(and(eq(m.shopId, shopId), inArray(m.status, ["sent", "delivered", "read"]), gte(m.createdAt, since))),
    db.select({ answer: o.whatsapp, n: count() }).from(o).where(and(eq(o.shopId, shopId), inArray(o.whatsapp, ["confirmed", "cancelled"]), gte(o.createdAt, since))).groupBy(o.whatsapp),
  ]);
  const replied = (a: string) => replies.find((r) => r.answer === a)?.n ?? 0;
  return { products, balance: shop?.credits ?? 0, month: { sent: sent.n, confirmed: replied("confirmed"), cancelled: replied("cancelled") } };
}
