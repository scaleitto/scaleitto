import mysql from "mysql2/promise";
import { runMigrations } from "../scripts/migrate-lib.mjs";
import { setMigrationStatus } from "./server/migration-status";

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

const MAX_ERROR_LOGS = 300;

export async function logRequestError(error: unknown, request: { path: string; method: string }, context: { routeType: string }) {
  if (!process.env.DATABASE_URL) return;
  const e = error as { message?: string; stack?: string; digest?: string; cause?: { message?: string; code?: string } };
  // Redirects and not-found are normal control flow, not errors.
  if (typeof e?.digest === "string" && /^NEXT_(REDIRECT|HTTP_ERROR)/.test(e.digest)) return;
  let connection: mysql.Connection | undefined;
  try {
    connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 5_000 });
    await connection.query(
      "INSERT INTO error_logs (id, digest, message, stack, path, method, route_type) VALUES (UUID(), ?, ?, ?, ?, ?, ?)",
      [
        e?.digest?.slice(0, 64) ?? null,
        `${e?.cause?.message ? `${e.cause.code ? `${e.cause.code} ` : ""}${e.cause.message}\n` : ""}${String(e?.message ?? error)}`.slice(0, 2000),
        e?.stack?.slice(0, 6000) ?? null,
        request.path.slice(0, 500),
        request.method.slice(0, 10),
        context.routeType?.slice(0, 20) ?? null,
      ],
    );
    await connection.query(
      "DELETE FROM error_logs WHERE created_at < (SELECT created_at FROM (SELECT created_at FROM error_logs ORDER BY created_at DESC LIMIT 1 OFFSET ?) t)",
      [MAX_ERROR_LOGS],
    );
  } catch (err) {
    console.error("[error-log] could not save error:", err);
  } finally {
    await connection?.end().catch(() => {});
  }
}
