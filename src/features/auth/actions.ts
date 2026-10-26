"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { createSession, destroySession } from "@/server/auth/session";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { newId } from "@/server/auth/context";
import { fieldErrorsFrom, safeAction } from "@/server/errors";
import { homeSection, sectionHref } from "@/lib/permissions";
import { asLocale } from "@/i18n";
import type { ActionState } from "@/lib/action";
import { loginSchema, registerSchema } from "./validators";

export async function register(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = asLocale(lang);
  const result = await safeAction("auth/register", async () => {
    const parsed = registerSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
    const d = parsed.data;

    const [[emailUsed], [slugUsed], [starter]] = await Promise.all([
      db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, d.email)),
      db.select({ id: schema.shops.id }).from(schema.shops).where(eq(schema.shops.slug, d.shopSlug)),
      db.select({ id: schema.plans.id }).from(schema.plans).where(eq(schema.plans.code, "starter")),
    ]);
    if (emailUsed) return { ok: false, fieldErrors: { email: "emailTaken" } };
    if (slugUsed) return { ok: false, fieldErrors: { shopSlug: "slugTaken" } };
    if (!starter) return { ok: false, error: "notSetUp" };

    const userId = newId();
    const shopId = newId();
    const adminEmail = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
    await db.transaction(async (tx) => {
      await tx.insert(schema.users).values({
        id: userId,
        email: d.email,
        name: d.name,
        passwordHash: await hashPassword(d.password),
        isPlatformAdmin: !!adminEmail && adminEmail === d.email,
        locale,
      });
      await tx.insert(schema.shops).values({ id: shopId, slug: d.shopSlug, name: d.shopName, ownerId: userId, planId: starter.id, defaultLocale: locale });
      await tx.insert(schema.shopMembers).values({ shopId, userId, role: "owner" });
    });
    await createSession(userId);
    return { ok: true };
  });
  if (result.ok) redirect(sectionHref(locale, "overview"));
  return result;
}

export async function login(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = asLocale(lang);
  let target: string | null = null;
  const result = await safeAction("auth/login", async () => {
    const parsed = loginSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, parsed.data.email));
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) return { ok: false, error: "invalidCredentials" };
    const [member] = await db.select({ role: schema.shopMembers.role }).from(schema.shopMembers).where(eq(schema.shopMembers.userId, user.id)).limit(1);
    await createSession(user.id);
    target = member ? sectionHref(locale, homeSection(member.role).key) : `/${locale}/register`;
    return { ok: true };
  });
  if (result.ok && target) redirect(target);
  return result;
}

export async function logout(lang: string) {
  await destroySession();
  redirect(`/${asLocale(lang)}/login`);
}
