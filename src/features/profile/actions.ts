"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { requireSection } from "@/server/auth/context";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { fieldErrorsFrom, safeAction } from "@/server/errors";
import { isValidDzPhone, normalizePhone } from "@/lib/phone";
import { asLocale } from "@/i18n";
import type { ActionState } from "@/lib/action";

const profileSchema = z.object({
  name: z.string().trim().min(2, "e:tooShort").max(120),
  phone: z
    .string()
    .trim()
    .transform((v) => (v ? normalizePhone(v) : ""))
    .refine((v) => v === "" || isValidDzPhone(v), "e:phone"),
});

export async function updateProfile(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("profile/update", async () => {
    const { user } = await requireSection(asLocale(lang), "profile");
    const parsed = profileSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
    await db.update(schema.users).set({ name: parsed.data.name, phone: parsed.data.phone || null }).where(eq(schema.users.id, user.id));
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
