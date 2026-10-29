import { connection } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { cronKey } from "@/server/crypto";
import { processQueue } from "@/features/apps/sync";
import { trackDueShipments } from "@/features/delivery/tracking";

// Called every few minutes by the hosting's cron job: sends the orders still waiting for the shops' apps
// (Google Sheets, webhooks), then updates the stage of parcels on their way (each one every few hours).
// The key is shown to the platform admin on Admin → System.
export async function GET(request: Request) {
  await connection();
  const key = new URL(request.url).searchParams.get("key") ?? "";
  const expected = cronKey();
  if (key.length !== expected.length || !timingSafeEqual(Buffer.from(key), Buffer.from(expected))) return new Response("Forbidden", { status: 403 });
  const result = await processQueue(null, { limit: 100, budgetMs: 30_000 });
  const tracking = await trackDueShipments({ limit: 60, budgetMs: 25_000 });
  return Response.json({ ...result, tracking });
}
