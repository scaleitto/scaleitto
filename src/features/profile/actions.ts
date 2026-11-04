"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { requireSection } from "@/server/auth/context";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { safeAction } from "@/server/errors";
import { fieldErrorsFrom } from "@/lib/validation";
import { isValidDzPhone, normalizePhone } from "@/lib/phone";
import { cookies } from "next/headers";
import { asLocale } from "@/i18n";
import { locales } from "@/i18n/config";
import type { ActionState } from "@/lib/action";

const profileSchema = z.object({
  name: z.string().trim().min(2, "e:tooShort").max(120),
  phone: z
    .string()
    .trim()
    .transform((v) => (v ? normalizePhone(v) : ""))
    .refine((v) => v === "" || isValidDzPhone(v), "e:phone"),
  // Dashboard language (Zimam: Profile → Dashboard Language)
  locale: z.enum(locales).optional(),
});

export async function updateProfile(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("profile/update", async () => {
    const { user } = await requireSection(asLocale(lang), "profile");
    const parsed = profileSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
    const { name, phone, locale } = parsed.data;
    await db.update(schema.users).set({ name, phone: phone || null, ...(locale ? { locale } : {}) }).where(eq(schema.users.id, user.id));
    // The same cookie as the language switcher: the next visits open in this language
    if (locale) (await cookies()).set("sc_locale", locale, { path: "/", maxAge: 31_536_000 });
    return { ok: true };
  });
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "e:required"),
  newPassword: z.string().min(8, "e:password").max(200),
});

export async function changePassword(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("profile/password", async () => {
    const { user } = await requireSection(asLocale(lang), "profile");
    const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
    const [row] = await db.select({ hash: schema.users.passwordHash }).from(schema.users).where(eq(schema.users.id, user.id));
    if (!row || !(await verifyPassword(parsed.data.currentPassword, row.hash))) return { ok: false, fieldErrors: { currentPassword: "wrongPassword" } };
    await db.update(schema.users).set({ passwordHash: await hashPassword(parsed.data.newPassword) }).where(eq(schema.users.id, user.id));
    return { ok: true };
  });
}
