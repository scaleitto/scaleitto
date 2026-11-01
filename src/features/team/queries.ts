import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";

// The shop's team (owner first), with what the Call Centers pages need.
export async function listTeam(shopId: string) {
  const rows = await db
    .select({
      userId: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      phone: schema.users.phone,
      role: schema.shopMembers.role,
      username: schema.shopMembers.username,
      active: schema.shopMembers.active,
      schedule: schema.shopMembers.schedule,
      createdAt: schema.shopMembers.createdAt,
    })
    .from(schema.shopMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.shopMembers.userId))
    .where(eq(schema.shopMembers.shopId, shopId))
    .orderBy(asc(schema.shopMembers.createdAt));
  const order = { owner: 0, manager: 1, agent: 2 };
  return rows.sort((a, b) => order[a.role] - order[b.role]);
}

export type TeamMember = Awaited<ReturnType<typeof listTeam>>[number];

// Members who can be given orders: active agents and managers.
export async function assignableMembers(shopId: string) {
  return db
    .select({ userId: schema.users.id, name: schema.users.name, role: schema.shopMembers.role })
    .from(schema.shopMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.shopMembers.userId))
    .where(and(eq(schema.shopMembers.shopId, shopId), eq(schema.shopMembers.active, true)))
    .orderBy(asc(schema.users.name));
}
