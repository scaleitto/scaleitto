import { connection } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { cronKey } from "@/server/crypto";
import { processQueue } from "@/features/apps/sync";
import { trackDueShipments } from "@/features/delivery/tracking";
import { processWhatsApp, queueReminders } from "@/features/whatsapp/queue";

// Called every few minutes by the hosting's cron job: sends the orders still waiting for the shops' apps
// (Google Sheets, webhooks), updates the stage of parcels on their way (each one every few hours) and sends the
// WhatsApp messages due.
// The key is shown to the platform admin on Admin → System.
export async function GET(request: Request) {
  await connection();
  const key = new URL(request.url).searchParams.get("key") ?? "";
  const expected = cronKey();
  if (key.length !== expected.length || !timingSafeEqual(Buffer.from(key), Buffer.from(expected))) return new Response("Forbidden", { status: 403 });
  const result = await processQueue(null, { limit: 100, budgetMs: 30_000 });
  const tracking = await trackDueShipments({ limit: 60, budgetMs: 25_000 });
  // WhatsApp confirmation: reminders due, then every message waiting (quiet hours over, retries)
  const reminders = await queueReminders();
  const whatsapp = await processWhatsApp({ limit: 100, budgetMs: 20_000 });
  return Response.json({ ...result, tracking, whatsapp: { ...whatsapp, reminders } });
}
