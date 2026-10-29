"use server";

import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { createSession, destroySession, getCurrentUser } from "@/server/auth/session";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { newId } from "@/server/auth/context";
import { consumeAuthToken } from "@/server/auth/tokens";
import { logError, safeAction } from "@/server/errors";
import { mailConfigured } from "@/server/mail";
import { fieldErrorsFrom } from "@/lib/validation";
import { homeSection, sectionHref } from "@/lib/permissions";
import { asLocale } from "@/i18n";
import type { ActionState } from "@/lib/action";
import { emailSchema, loginSchema, newPasswordSchema, registerSchema } from "./validators";
import { sendResetEmail, sendVerifyEmail } from "./emails";

const adminEmail = () => process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase() || null;

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
    const isAdmin = adminEmail() === d.email;
    // Without email sending set up on the server the address cannot be confirmed: it counts as confirmed
    const confirmNow = isAdmin || !mailConfigured();
    await db.transaction(async (tx) => {
      await tx.insert(schema.users).values({
        id: userId,
        email: d.email,
        name: d.name,
        phone: d.phone,
        passwordHash: await hashPassword(d.password),
        isPlatformAdmin: isAdmin,
        locale,
        emailVerifiedAt: confirmNow ? new Date() : null,
      });
      await tx.insert(schema.shops).values({ id: shopId, slug: d.shopSlug, name: d.shopName, ownerId: userId, planId: starter.id, defaultLocale: d.storeLanguage, phone: d.phone });
      await tx.insert(schema.shopMembers).values({ shopId, userId, role: "owner" });
    });
    if (!confirmNow) {
      // The account exists either way: a failed email can be sent again from the confirmation page
      await sendVerifyEmail({ id: userId, email: d.email, name: d.name }, locale).catch((err) => logError("auth/verify-mail", err));
    }
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
    const [member] = await db.select({ role: schema.shopMembers.role, active: schema.shopMembers.active }).from(schema.shopMembers).where(eq(schema.shopMembers.userId, user.id)).limit(1);
    if (member && !member.active) return { ok: false, error: "accountDisabled" };
    // The account named in PLATFORM_ADMIN_EMAIL becomes the platform admin, even if it was created before the setting
    if (!user.isPlatformAdmin && adminEmail() === user.email) {
      await db.update(schema.users).set({ isPlatformAdmin: true, emailVerifiedAt: user.emailVerifiedAt ?? new Date() }).where(eq(schema.users.id, user.id));
    }
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

// "Send the email again" on the confirmation page
export async function resendVerification(lang: string): Promise<ActionState> {
  return safeAction("auth/resend", async () => {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "forbidden" };
    if (user.emailVerifiedAt) return { ok: true };
    await sendVerifyEmail(user, asLocale(lang));
    return { ok: true };
  });
}

// The link of the confirmation email: true when the address is now confirmed
export async function confirmEmail(token: string) {
  const userId = await consumeAuthToken(token, "verify");
  if (!userId) return false;
  await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(and(eq(schema.users.id, userId), isNull(schema.users.emailVerifiedAt)));
  return true;
}

// "Forgot your password?": the same answer whether the address exists or not (nobody can test which emails have accounts)
export async function forgotPassword(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("auth/forgot", async () => {
    const parsed = emailSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
    if (!mailConfigured()) return { ok: false, error: "mailNotSetUp" };
    const [user] = await db.select({ id: schema.users.id, email: schema.users.email, name: schema.users.name }).from(schema.users).where(eq(schema.users.email, parsed.data.email));
    if (user) await sendResetEmail(user, asLocale(lang));
    return { ok: true };
  });
}

// The new password from the reset link: every other session ends, and the user is signed in
export async function resetPassword(lang: string, token: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = asLocale(lang);
  const result = await safeAction("auth/reset", async () => {
    const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
    const userId = await consumeAuthToken(token, "reset");
    if (!userId) return { ok: false, error: "linkExpired" };
    await db.update(schema.users).set({ passwordHash: await hashPassword(parsed.data.password), emailVerifiedAt: new Date() }).where(eq(schema.users.id, userId));
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
    await createSession(userId);
    return { ok: true };
  });
  if (result.ok) redirect(`/${locale}/dashboard`);
  return result;
}
