import { connection } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getMigrationStatus } from "@/lib/migration-status";

// Diagnostics page for deployments: open /api/health to see what is misconfigured.
// It never shows secret values, only whether they are set.
export async function GET() {
  await connection();
  const env = Object.fromEntries(
    ["DATABASE_URL", "APP_URL", "ROOT_DOMAIN", "PLATFORM_ADMIN_EMAIL", "TZ", "OPENAI_API_KEY"].map((k) => [k, process.env[k] ? "set" : "MISSING"]),
  );

  let database: string;
  let plans: number | null = null;
  try {
    const [rows] = (await db.execute(sql`SELECT COUNT(*) AS n FROM plans`)) as unknown as [{ n: number }[]];
    plans = Number(rows[0].n);
    database = plans > 0 ? "ok" : "connected, but plans are not seeded";
  } catch (err) {
    const e = err as { code?: string; message?: string; cause?: { code?: string; message?: string } };
    const cause = e.cause ?? e;
    database = `error: ${cause.code ?? ""} ${cause.message ?? String(err)}`.trim();
  }

  return Response.json({
    app: "ok",
    node: process.version,
    database,
    plans,
    startupMigration: getMigrationStatus() ?? "not run (DATABASE_URL missing at startup?)",
    env,
  });
}
