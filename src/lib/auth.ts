import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "@/db";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

const SESSION_COOKIE = "sc_session";
const SESSION_DAYS = 30;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [, saltHex, keyHex] = stored.split("$");
  if (!saltHex || !keyHex) return false;
  const key = await scrypt(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(keyHex, "hex");
  return expected.length === key.length && timingSafeEqual(expected, key);
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(schema.sessions).values({ id: hashToken(token), userId, expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token)));
  store.delete(SESSION_COOKIE);
}

export type CurrentUser = { id: string; name: string; email: string; isPlatformAdmin: boolean };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  // Everything after a session read is per-request (expiry checks, "this month" stats…)
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      isPlatformAdmin: schema.users.isPlatformAdmin,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, hashToken(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export async function requireUser(locale: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  return user;
}

// Layouts and pages render in parallel, so every admin page calls this itself.
export async function requireAdmin(locale: string) {
  const user = await requireUser(locale);
  if (!user.isPlatformAdmin) notFound();
  return user;
}

export type ShopContext = {
  user: CurrentUser;
  shop: typeof schema.shops.$inferSelect;
  role: "owner" | "admin" | "confirmer";
};

// Every dashboard read/write goes through this: it resolves the shop from the
// session, so a merchant can never act on another merchant's shop.
export async function requireShop(locale: string): Promise<ShopContext> {
  const user = await requireUser(locale);
  const [row] = await db
    .select({ shop: schema.shops, role: schema.shopMembers.role })
    .from(schema.shopMembers)
    .innerJoin(schema.shops, eq(schema.shops.id, schema.shopMembers.shopId))
    .where(eq(schema.shopMembers.userId, user.id))
    .limit(1);
  if (!row) redirect(`/${locale}/register`);
  return { user, shop: row.shop, role: row.role };
}

export const newId = () => randomUUID();
