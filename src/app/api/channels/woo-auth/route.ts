import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { decryptJson, encryptJson } from "@/server/crypto";
import { logError } from "@/server/errors";
import { wooCreateWebhook } from "@/features/channels/platforms";

// WooCommerce's authentication endpoint sends the REST keys here once the merchant approves our app on their store
// (user_id = the channel's random token). We keep the keys (encrypted) and create the "order.created" webhook.
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { user_id?: unknown; consumer_key?: unknown; consumer_secret?: unknown } | null;
    const token = typeof body?.user_id === "string" ? body.user_id : String(body?.user_id ?? "");
    const consumerKey = typeof body?.consumer_key === "string" ? body.consumer_key : "";
    const consumerSecret = typeof body?.consumer_secret === "string" ? body.consumer_secret : "";
    if (!/^[A-Za-z0-9_-]{20,40}$/.test(token) || !/^ck_\w{10,80}$/.test(consumerKey) || !/^cs_\w{10,80}$/.test(consumerSecret)) return new Response("Bad request", { status: 400 });
    const [channel] = await db.select().from(schema.shopChannels).where(and(eq(schema.shopChannels.token, token), eq(schema.shopChannels.kind, "woocommerce")));
    if (!channel?.storeUrl) return new Response("Not found", { status: 404 });
    const { secret } = decryptJson<{ secret: string }>(channel.secret);
    const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
    const hook = await wooCreateWebhook(channel.storeUrl, { consumerKey, consumerSecret }, `${base}/api/channels/${token}`, secret);
    await db
      .update(schema.shopChannels)
      .set({ secret: encryptJson({ secret, consumerKey, consumerSecret }), settings: hook.ok ? { webhookId: hook.webhookId } : { error: hook.detail } })
      .where(eq(schema.shopChannels.id, channel.id));
    return Response.json({ ok: true });
  } catch (err) {
    await logError("api/channels/woo-auth", err);
    return new Response("Error", { status: 500 });
  }
}
