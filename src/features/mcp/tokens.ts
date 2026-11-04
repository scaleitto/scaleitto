import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { newId } from "@/server/auth/context";
import { cleanScopes, type McpScope } from "./scopes";

// Tokens are shown once ("scm_" + 32 random bytes); only their sha256 is kept.
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createToken(shopId: string, userId: string, name: string, scopes: McpScope[]) {
  const token = `scm_${randomBytes(32).toString("base64url")}`;
  await db.insert(schema.mcpTokens).values({ id: newId(), shopId, userId, name: name.slice(0, 80), tokenHash: hash(token), scopes: cleanScopes(scopes) });
  return token;
}

export type McpCaller = { tokenId: string; shopId: string; userId: string; scopes: McpScope[] };

// The caller of a request ("Authorization: Bearer scm_…"): a live token of an active store whose creator is still a member
export async function tokenCaller(header: string | null): Promise<McpCaller | null> {
  const token = /^Bearer\s+(scm_[\w-]{20,})$/i.exec(header ?? "")?.[1];
  if (!token) return null;
  const t = schema.mcpTokens;
  const [row] = await db
    .select({ id: t.id, shopId: t.shopId, userId: t.userId, scopes: t.scopes, status: schema.shops.status, active: schema.shopMembers.active, role: schema.shopMembers.role })
    .from(t)
    .innerJoin(schema.shops, eq(schema.shops.id, t.shopId))
    .innerJoin(schema.shopMembers, and(eq(schema.shopMembers.shopId, t.shopId), eq(schema.shopMembers.userId, t.userId)))
    .where(and(eq(t.tokenHash, hash(token)), isNull(t.revokedAt)));
  if (!row || row.status !== "active" || !row.active || row.role === "agent") return null;
  return { tokenId: row.id, shopId: row.shopId, userId: row.userId, scopes: cleanScopes(row.scopes) };
}

export async function touchToken(tokenId: string, client?: string) {
  await db
    .update(schema.mcpTokens)
    .set({ lastUsedAt: new Date(), ...(client ? { client: client.slice(0, 120) } : {}) })
    .where(eq(schema.mcpTokens.id, tokenId));
}
