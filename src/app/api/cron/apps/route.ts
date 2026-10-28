import { connection } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { cronKey } from "@/server/crypto";
import { processQueue } from "@/features/apps/sync";

// Called every few minutes by the hosting's cron job: sends the orders still waiting for the shops' apps
// (Google Sheets, webhooks). The key is shown to the platform admin on Admin → System.
export async function GET(request: Request) {
  await connection();
  const key = new URL(request.url).searchParams.get("key") ?? "";
  const expected = cronKey();
  if (key.length !== expected.length || !timingSafeEqual(Buffer.from(key), Buffer.from(expected))) return new Response("Forbidden", { status: 403 });
  const result = await processQueue(null, { limit: 100, budgetMs: 50_000 });
  return Response.json(result);
}
