// Shared helpers for the end-to-end tests (run with: npm run test:e2e).
import { createRequire } from "node:module";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { deflateSync } from "node:zlib";

const require = createRequire(import.meta.url);

if (!process.env.DATABASE_URL && existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

export const BASE = process.env.E2E_URL ?? "http://localhost:3000";
// Test browsers present themselves as a normal desktop Chrome: the fake-order protection refuses "HeadlessChrome"
// (phase21 tests that with its own robot)
export const BROWSER_ARGS = ["--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"];
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
    // On GitHub Actions also as an annotation (readable from the API without the full log)
    if (process.env.GITHUB_ACTIONS) console.log(`::error title=e2e::${name} — ${String(err.message).split("\n")[0].replace(/[\r\n]/g, " ")}`);
  }
}
export const failed = () => failures;

// Creates a member directly in the database and returns a session token for it.
export async function createSession({ shopId, role, email }) {
  const userId = randomUUID();
  await db.query("INSERT INTO users (id, email, name, password_hash, locale, email_verified_at) VALUES (?, ?, ?, ?, 'ar', NOW())", [userId, email, `Test ${role}`, "scrypt$00$00"]);
  await db.query("INSERT INTO shop_members (shop_id, user_id, role) VALUES (?, ?, ?)", [shopId, userId, role]);
  const token = randomBytes(32).toString("base64url");
  await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))", [createHash("sha256").update(token).digest("hex"), userId]);
  return { userId, token };
}

// Creates a fresh shop (starter plan) with its owner and returns a logged-in browser context.
export async function createShop(browser, { viewport = { width: 1366, height: 900 } } = {}) {
  const tag = randomBytes(4).toString("hex");
  const shopId = randomUUID();
  const [[plan]] = await db.query("SELECT id FROM plans WHERE code = 'starter'");
  const ownerId = randomUUID();
  await db.query("INSERT INTO users (id, email, name, password_hash, locale, email_verified_at) VALUES (?, ?, ?, ?, 'ar', NOW())", [ownerId, `owner-${tag}@test.dz`, "Owner", "scrypt$00$00"]);
  await db.query("INSERT INTO shops (id, slug, name, owner_id, plan_id) VALUES (?, ?, ?, ?, ?)", [shopId, `shop-${tag}`, `Shop ${tag}`, ownerId, plan.id]);
  await db.query("INSERT INTO shop_members (shop_id, user_id, role) VALUES (?, ?, 'owner')", [shopId, ownerId]);
  const token = randomBytes(32).toString("base64url");
  await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))", [createHash("sha256").update(token).digest("hex"), ownerId]);
  const context = await browser.newContext({ viewport });
  await context.addCookies([{ name: "sc_session", value: token, url: BASE }]);
  return { shopId, context, tag };
}

// A tiny valid PNG of one color (for upload tests).
export function pngBuffer(rgb = [220, 40, 60], size = 64) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: size }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

export const playwright = () => require("playwright");

// The landing page wizard: manual / AI mode, page style ("images" Wibi style or "sections"), then generate
// (the AI asks to confirm the settings and their cost first).
export async function wizardMode(page, mode) {
  await page.locator("[data-testid=mode] button").nth(mode === "manual" ? 1 : 0).click();
}
export async function wizardStyle(page, style) {
  await page.locator("[data-testid=page-style] button").nth(style === "images" ? 0 : 1).click();
}
export async function wizardGenerate(page) {
  await page.click("[data-testid=ai-next]");
  await page.locator("[data-testid=ai-confirm] button").last().click();
}
