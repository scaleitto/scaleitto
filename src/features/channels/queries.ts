import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { decryptJson } from "@/server/crypto";

// The shop's connected platforms, with the receiving address and (WooCommerce) the secret to paste there
export async function listChannels(shopId: string) {
  const rows = await db.select().from(schema.shopChannels).where(eq(schema.shopChannels.shopId, shopId));
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  return rows.map((r) => ({
    kind: r.kind,
    storeUrl: r.storeUrl,
    active: r.active,
    lastOrderAt: r.lastOrderAt,
    ordersCount: r.ordersCount,
    url: `${base}/api/channels/${r.token}`,
    // Shopify's key belongs to Shopify (never shown back); WooCommerce's was made here and must be pasted there
    secret: r.kind === "woocommerce" ? decryptJson<{ secret: string }>(r.secret).secret : null,
  }));
}
export type ChannelView = Awaited<ReturnType<typeof listChannels>>[number];
