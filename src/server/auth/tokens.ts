import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "@/server/db";

type Kind = (typeof schema.authTokenKinds)[number];
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

// A one-time link token for this user (the previous ones of the same kind stop working)
export async function createAuthToken(userId: string, kind: Kind, hours: number) {
  const token = randomBytes(32).toString("base64url");
  await db.delete(schema.authTokens).where(and(eq(schema.authTokens.userId, userId), eq(schema.authTokens.kind, kind)));
  await db.insert(schema.authTokens).values({ id: hash(token), userId, kind, expiresAt: new Date(Date.now() + hours * 3600_000) });
  return token;
}

// The user the token belongs to, or null (unknown, expired or already used). The token is used up.
export async function consumeAuthToken(token: string, kind: Kind) {
  if (!/^[\w-]{20,100}$/.test(token)) return null;
  const id = hash(token);
  const [row] = await db
    .select({ userId: schema.authTokens.userId })
    .from(schema.authTokens)
    .where(and(eq(schema.authTokens.id, id), eq(schema.authTokens.kind, kind), gt(schema.authTokens.expiresAt, new Date())));
  if (!row) return null;
  await db.delete(schema.authTokens).where(eq(schema.authTokens.id, id));
  return row.userId;
}
