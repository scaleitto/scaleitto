// Shared helpers for the end-to-end tests (run with: npm run test:e2e).
import { createRequire } from "node:module";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";

const require = createRequire(import.meta.url);

if (!process.env.DATABASE_URL && existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

export const BASE = process.env.E2E_URL ?? "http://localhost:3000";
const mysql = require("mysql2/promise");
export const db = await mysql.createConnection({ uri: process.env.DATABASE_URL });

export function expect(condition, message) {
  if (!condition) throw new Error(`Expected: ${message}`);
}

let failures = 0;
export async function step(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    console.log(`  ✓ ${name} (${Date.now() - t0}ms)`);
  } catch (err) {
    failures++;
    console.log(`  ✗ ${name}\n    ${String(err.message).split("\n")[0]}`);
  }
}
export const failed = () => failures;

// Creates a member directly in the database and returns a session token for it.
export async function createSession({ shopId, role, email }) {
  const userId = randomUUID();
  await db.query("INSERT INTO users (id, email, name, password_hash, locale) VALUES (?, ?, ?, ?, 'ar')", [userId, email, `Test ${role}`, "scrypt$00$00"]);
  await db.query("INSERT INTO shop_members (shop_id, user_id, role) VALUES (?, ?, ?)", [shopId, userId, role]);
  const token = randomBytes(32).toString("base64url");
  await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))", [createHash("sha256").update(token).digest("hex"), userId]);
  return { userId, token };
}

export const playwright = () => require("playwright");
