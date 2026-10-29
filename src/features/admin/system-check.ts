import { mailConfigured } from "@/server/mail";
import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { asc, lte, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { uploadsDir } from "@/server/storage";
import { checkAiConnection } from "@/server/ai/openai";
import type { CheckStep } from "@/ui/CheckCard";

// The platform's full check (admin → system): everything a live server needs, each with the exact reason.
export async function runSystemCheck(): Promise<CheckStep[]> {
  const steps: CheckStep[] = [];
  const run = async (step: string, fn: () => Promise<string>) => {
    try {
      steps.push({ step, ok: true, detail: await fn() });
    } catch (err) {
      steps.push({ step, ok: false, detail: err instanceof Error ? err.message : String(err) });
    }
  };

  await run("database", async () => {
    await db.execute(sql`SELECT 1`);
    return "OK";
  });

  // Saving photos: write, read back and delete a small file where uploads are kept
  await run("uploads", async () => {
    const dir = uploadsDir();
    const file = path.join(/* turbopackIgnore: true */ dir, `.check-${randomUUID()}`);
    await mkdir(/* turbopackIgnore: true */ dir, { recursive: true });
    await writeFile(/* turbopackIgnore: true */ file, "ok");
    const back = await readFile(/* turbopackIgnore: true */ file, "utf8");
    await unlink(/* turbopackIgnore: true */ file);
    if (back !== "ok") throw new Error(`${dir}: read back failed`);
    return dir;
  });

  await run("settings", async () => {
    const missing = ["APP_URL", "APP_SECRET"].filter((k) => !process.env[k]);
    if (missing.length) throw new Error(`missing: ${missing.join(", ")}`);
    // A server copied from a test setup would give merchants "localhost" links
    const local = ["APP_URL", "ROOT_DOMAIN"].filter((k) => /localhost|127\.0\.0\.1/.test(process.env[k] ?? ""));
    if (local.length && process.env.NODE_ENV === "production" && !process.env.E2E_CARRIER_URL) throw new Error(`${local.join(", ")}: put the platform's real address (e.g. https://scaleitto.com / scaleitto.com)`);
    return "APP_URL, APP_SECRET";
  });

  // Emails (account confirmation, new password): sent through the hosting's SMTP account
  await run("mail", async () => {
    if (!mailConfigured()) throw new Error("SMTP_HOST / SMTP_USER / SMTP_PASS not set: accounts are not confirmed by email and passwords cannot be reset");
    return process.env.E2E_MAIL_URL ? "test inbox" : `${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 465}`;
  });

  // The cron job: orders due for the apps for more than 15 minutes mean nothing sends them in the background
  await run("cron", async () => {
    const q = schema.appQueue;
    const [late] = await db.select({ nextAt: q.nextAt }).from(q).where(lte(q.nextAt, sql`CURRENT_TIMESTAMP(3) - INTERVAL 15 MINUTE`)).orderBy(asc(q.nextAt)).limit(1);
    if (late) throw new Error(`orders waiting since ${late.nextAt.toISOString().slice(0, 16).replace("T", " ")} UTC: add the cron job below`);
    return "OK";
  });

  for (const s of await checkAiConnection()) steps.push({ step: `ai-${s.step}`, ok: s.ok, detail: s.detail });
  return steps;
}
