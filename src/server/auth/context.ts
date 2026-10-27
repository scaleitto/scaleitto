import "server-only";
import { notFound, redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import type { MemberRole } from "@/server/db/schema";
import { canAccess, homeSection, sectionHref, type SectionKey } from "@/lib/permissions";
import { getCurrentUser, type CurrentUser } from "./session";

export const newId = () => randomUUID();

export type ShopContext = {
  user: CurrentUser;
  shop: typeof schema.shops.$inferSelect;
  role: MemberRole;
};

export async function requireUser(locale: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  return user;
}

async function membershipOf(userId: string) {
  const [row] = await db
    .select({ shop: schema.shops, role: schema.shopMembers.role, active: schema.shopMembers.active })
    .from(schema.shopMembers)
    .innerJoin(schema.shops, eq(schema.shops.id, schema.shopMembers.shopId))
    .where(eq(schema.shopMembers.userId, userId))
    .limit(1);
  return row ?? null;
}

// The signed-in user's shop. Every dashboard query filters by this shop id,
// so a merchant can never read or change another merchant's data.
export async function requireShop(locale: string): Promise<ShopContext> {
  const user = await requireUser(locale);
  const m = await membershipOf(user.id);
  if (!m) redirect(`/${locale}/register`);
  if (!m.active) {
    // Deactivated by the shop: sign out everywhere and explain on the login page
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, user.id));
    redirect(`/${locale}/login?disabled=1`);
  }
  return { user, shop: m.shop, role: m.role };
}

// Guard for a dashboard section: members without access go to their own home section.
// Pages AND their server actions call this (layouts render in parallel with pages).
export async function requireSection(locale: string, key: SectionKey): Promise<ShopContext> {
  const ctx = await requireShop(locale);
  if (!canAccess(ctx.role, key)) redirect(sectionHref(locale, homeSection(ctx.role).key));
  return ctx;
}

// For route handlers: the member's shop context or null (no redirects).
export async function getShopContext(): Promise<ShopContext | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const m = await membershipOf(user.id);
  return m?.active ? { user, shop: m.shop, role: m.role } : null;
}

export async function requirePlatformAdmin(locale: string) {
  const user = await requireUser(locale);
  if (!user.isPlatformAdmin) notFound();
  return user;
}
