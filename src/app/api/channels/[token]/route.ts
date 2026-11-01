import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { decryptJson } from "@/server/crypto";
import { logError } from "@/server/errors";
import { parsers, signatureHeader, validSignature } from "@/features/channels/parse";
import { receiveOrder } from "@/features/channels/receive";

const MAX_BODY = 512 * 1024;

// A connected platform (Shopify, WooCommerce) sends a new order here. The body must be signed with the channel's secret;
// anything unsigned, unknown or paused is refused. A platform's own test ping (no order id) is answered 200.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return new Response("Not found", { status: 404 });
  try {
    const [channel] = await db.select().from(schema.shopChannels).where(eq(schema.shopChannels.token, token));
    if (!channel || !channel.active) return new Response("Not found", { status: 404 });
    const raw = await req.text();
    if (raw.length > MAX_BODY) return new Response("Too large", { status: 413 });
    const secret = decryptJson<{ secret: string }>(channel.secret).secret;
    if (!validSignature(raw, secret, req.headers.get(signatureHeader[channel.kind]))) return new Response("Bad signature", { status: 401 });
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      // WooCommerce's first ping is a form body ("webhook_id=…")
      return new Response("OK");
    }
    const order = parsers[channel.kind](body);
    if (!order) return new Response("OK");
    const result = await receiveOrder(channel.shopId, channel.kind, order);
    return Response.json({ ok: true, created: result.created });
  } catch (err) {
    await logError("api/channels", err);
    return new Response("Error", { status: 500 });
  }
}
