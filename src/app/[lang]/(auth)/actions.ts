"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { createSession, destroySession, hashPassword, newId, verifyPassword } from "@/lib/auth";
import { asLocale } from "@/i18n";

const RESERVED_SLUGS = new Set(["www", "app", "admin", "api", "store", "dashboard", "ar", "fr", "en"]);

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(191),
  password: z.string().min(8).max(200),
  shopName: z.string().trim().min(2).max(120),
  shopSlug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/),
});

export async function register(lang: string, formData: FormData) {
  const locale = asLocale(lang);
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/${locale}/register?error=validation`);
  const data = parsed.data;

  if (RESERVED_SLUGS.has(data.shopSlug)) redirect(`/${locale}/register?error=slugTaken`);
  const [emailUsed] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, data.email));
  if (emailUsed) redirect(`/${locale}/register?error=emailTaken`);
  const [slugUsed] = await db.select({ id: schema.shops.id }).from(schema.shops).where(eq(schema.shops.slug, data.shopSlug));
  if (slugUsed) redirect(`/${locale}/register?error=slugTaken`);

  const [starter] = await db.select({ id: schema.plans.id }).from(schema.plans).where(eq(schema.plans.code, "starter"));
  if (!starter) throw new Error("Plans are not seeded. Run `node scripts/migrate.mjs`.");

  const userId = newId();
  const shopId = newId();
  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL?.toLowerCase();
  await db.transaction(async (tx) => {
    await tx.insert(schema.users).values({
      id: userId,
      email: data.email,
      name: data.name,
      passwordHash: await hashPassword(data.password),
      isPlatformAdmin: !!adminEmail && adminEmail === data.email,
      locale,
    });
    await tx.insert(schema.shops).values({
      id: shopId,
      slug: data.shopSlug,
      name: data.shopName,
      ownerId: userId,
      planId: starter.id,
      defaultLocale: locale,
    });
    await tx.insert(schema.shopMembers).values({ shopId, userId, role: "owner" });
  });

  await createSession(userId);
  redirect(`/${locale}/dashboard`);
}

export async function login(lang: string, formData: FormData) {
  const locale = asLocale(lang);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    redirect(`/${locale}/login?error=invalid`);
  }
  await createSession(user.id);
  redirect(`/${locale}/dashboard`);
}

export async function logout(lang: string) {
  await destroySession();
  redirect(`/${asLocale(lang)}/login`);
}
