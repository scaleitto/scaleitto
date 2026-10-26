import { connection } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { getMigrationStatus } from "@/server/migration-status";

// Deployment diagnostics: open /api/health to see what is misconfigured.
// It never shows secret values, only whether they are set.
export async function GET() {
  await connection();
  const env = Object.fromEntries(
    ["DATABASE_URL", "APP_URL", "ROOT_DOMAIN", "PLATFORM_ADMIN_EMAIL", "TZ", "OPENAI_API_KEY"].map((k) => [k, process.env[k] ? "set" : "MISSING"]),
  );

  let database = "ok";
  let plans: number | null = null;
  let migrations: string[] = [];
  try {
    const [rows] = (await db.execute(sql`SELECT COUNT(*) AS n FROM plans`)) as unknown as [{ n: number }[]];
    plans = Number(rows[0].n);
    if (plans === 0) database = "connected, but plans are not seeded";
    const [m] = (await db.execute(sql`SELECT name FROM _migrations ORDER BY name`)) as unknown as [{ name: string }[]];
    migrations = m.map((r) => r.name);
  } catch (err) {
    const e = err as { code?: string; message?: string; cause?: { code?: string; message?: string } };
    const cause = e.cause ?? e;
    database = `error: ${cause.code ?? ""} ${cause.message ?? String(err)}`.trim();
  }

  return Response.json({
    app: "ok",
    version: { commit: process.env.BUILD_COMMIT, builtAt: process.env.BUILD_TIME },
    node: process.version,
    database,
    plans,
    migrations,
    startupMigration: getMigrationStatus() ?? "not run (DATABASE_URL missing at startup?)",
    env,
  });
}
