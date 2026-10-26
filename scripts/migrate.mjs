// Applies pending SQL migrations from ./drizzle and seeds default plans.
// The server also does this automatically at startup (src/instrumentation.ts).
// Usage: node scripts/migrate.mjs   (reads DATABASE_URL from the environment or .env)
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import mysql from "mysql2/promise";
import { runMigrations } from "./migrate-lib.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

if (!process.env.DATABASE_URL && existsSync(path.join(root, ".env"))) {
  for (const line of readFileSync(path.join(root, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });
await runMigrations(connection, root);
await connection.end();
console.log("✓ database is up to date");
