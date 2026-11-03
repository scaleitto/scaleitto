import { connection } from "next/server";
import { logError } from "@/server/errors";
import { validWebhookSignature } from "@/features/whatsapp/cloud";
import { receiveWhatsApp } from "@/features/whatsapp/queue";

// Meta's webhook for the platform's WhatsApp number (Callback URL = <APP_URL>/api/whatsapp, field "messages").
// GET = Meta checks the URL with WHATSAPP_VERIFY_TOKEN; POST = delivery reports and the buyers' replies, signed.
export async function GET(request: Request) {
  await connection();
  const q = new URL(request.url).searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  if (q.get("hub.mode") === "subscribe" && token && q.get("hub.verify_token") === token) return new Response(q.get("hub.challenge") ?? "", { status: 200 });
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  await connection();
  const raw = await request.text();
  if (!validWebhookSignature(raw, request.headers.get("x-hub-signature-256"))) return new Response("Invalid signature", { status: 401 });
  try {
    await receiveWhatsApp(JSON.parse(raw));
  } catch (err) {
    await logError("whatsapp/webhook", err);
  }
  // Always 200 once signed, or Meta retries the same call for days
  return new Response("OK", { status: 200 });
}
