import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "@/server/db";

const COOKIE = "sc_session";
const DAYS = 30;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + DAYS * 86_400_000);
  await db.insert(schema.sessions).values({ id: hashToken(token), userId, expiresAt });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token)));
  store.delete(COOKIE);
}

export type CurrentUser = { id: string; name: string; email: string; phone: string | null; locale: string; isPlatformAdmin: boolean; emailVerifiedAt: Date | null };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  // Everything that reads the session is per-request (also lets pages use new Date()).
  await connection();
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      phone: schema.users.phone,
      locale: schema.users.locale,
      isPlatformAdmin: schema.users.isPlatformAdmin,
      emailVerifiedAt: schema.users.emailVerifiedAt,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, hashToken(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}
