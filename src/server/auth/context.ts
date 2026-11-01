import "server-only";
import { notFound, redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import type { MemberRole } from "@/server/db/schema";
import { canAccess, homeSection, sectionHref, type SectionKey } from "@/lib/permissions";
import { getCurrentUser, type CurrentUser } from "./session";
import { mailConfigured } from "@/server/mail";

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
  // Suspended by the platform: no dashboard and no actions, only an explanation
  if (m.shop.status !== "active") redirect(`/${locale}/suspended`);
  // A new store's owner confirms their email first (when the server can send emails; team members are created
  // by the owner and need no confirmation)
  if (m.role === "owner" && !user.emailVerifiedAt && !user.isPlatformAdmin && mailConfigured()) redirect(`/${locale}/verify`);
  return { user, shop: m.shop, role: m.role };
}

// Guard for a dashboard section: members without access go to their own home section.
// Pages AND their server actions call this (layouts render in parallel with pages).
export async function requireSection(locale: string, key: SectionKey): Promise<ShopContext> {
  const ctx = await requireShop(locale);
  // Agents work in their own portal (Zimam's call-center portal); only order actions accept them
  if (ctx.role === "agent" && key !== "orders") redirect(agentHome(locale));
  if (!canAccess(ctx.role, key)) redirect(sectionHref(locale, homeSection(ctx.role).key));
  return ctx;
}

// The call-center agents' portal (/[lang]/call-center): its own sign-in page, dashboard and orders
export const agentHome = (locale: string) => `/${locale}/call-center`;
export async function requireAgent(locale: string): Promise<ShopContext> {
  if (!(await getCurrentUser())) redirect(`${agentHome(locale)}/login`);
  const ctx = await requireShop(locale);
  if (ctx.role !== "agent") redirect(sectionHref(locale, homeSection(ctx.role).key));
  return ctx;
}

// For route handlers: the member's shop context or null (no redirects).
export async function getShopContext(): Promise<ShopContext | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const m = await membershipOf(user.id);
  return m?.active && m.shop.status === "active" ? { user, shop: m.shop, role: m.role } : null;
}

export async function requirePlatformAdmin(locale: string) {
  const user = await requireUser(locale);
  if (!user.isPlatformAdmin) notFound();
  return user;
}
