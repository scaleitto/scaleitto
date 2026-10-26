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

  let migrations: string[] = [];
  try {
    const [rows] = (await db.execute(sql`SELECT name FROM _migrations ORDER BY name`)) as unknown as [{ name: string }[]];
    migrations = rows.map((r) => r.name);
  } catch {
    // table missing: startupMigration below explains why
  }

  return Response.json({
    app: "ok",
    // Compare with the latest commit on GitHub to be sure the new version is the one running
    version: { commit: process.env.BUILD_COMMIT, builtAt: process.env.BUILD_TIME },
    node: process.version,
    database,
    plans,
    migrations,
    startupMigration: getMigrationStatus() ?? "not run (DATABASE_URL missing at startup?)",
    env,
  });
}
