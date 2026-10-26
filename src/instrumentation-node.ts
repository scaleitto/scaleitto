import mysql from "mysql2/promise";
import { runMigrations } from "../scripts/migrate-lib.mjs";
import { setMigrationStatus } from "./lib/migration-status";

// Brings the database up to date at startup, so a deploy on shared hosting needs
// no terminal access. Errors are logged, not thrown, so the site still starts and
// /api/health can show what is wrong.
export async function migrateOnStartup() {
  if (!process.env.DATABASE_URL) return;
  let connection: mysql.Connection | undefined;
  try {
    connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 10_000 });
    await runMigrations(connection, process.cwd(), (msg: string) => console.log(`[migrate] ${msg}`));
    setMigrationStatus({ ok: true });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    console.error("[migrate] failed:", e);
    setMigrationStatus({ ok: false, error: `${e.code ?? ""} ${e.message ?? String(err)}`.trim() });
  } finally {
    await connection?.end().catch(() => {});
  }
}
