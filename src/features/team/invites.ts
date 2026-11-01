"use server";

import { createHash, randomBytes } from "node:crypto";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { newId, requireSection } from "@/server/auth/context";
import { hashPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { safeAction, logError } from "@/server/errors";
import { mailConfigured, mailHtml, sendMail } from "@/server/mail";
import { getEffectiveLimits } from "@/server/limits";
import { asLocale, getDictionary } from "@/i18n";
import { fmt } from "@/lib/format";
import { fieldErrorsFrom } from "@/lib/validation";
import { sectionHref } from "@/lib/permissions";
import type { ActionState } from "@/lib/action";

const DAYS = 7;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const inviteSchema = z.object({ email: z.string().trim().toLowerCase().email("e:email").max(255), role: z.enum(["manager", "agent"]) });

// Active members + invitations still waiting: together they stay within the plan's staff limit
export async function staffUsage(shopId: string) {
  const [[members], [pending], max] = await Promise.all([
    db.select({ n: count() }).from(schema.shopMembers).where(and(eq(schema.shopMembers.shopId, shopId), eq(schema.shopMembers.active, true))),
    db.select({ n: count() }).from(schema.memberInvites).where(and(eq(schema.memberInvites.shopId, shopId), isNull(schema.memberInvites.acceptedAt), gt(schema.memberInvites.expiresAt, new Date()))),
    getEffectiveLimits(shopId),
  ]);
  return { used: members.n + pending.n, max: max.maxStaff };
}

// Team → invite: a link valid 7 days, emailed when mail is set up; the link is also returned so it can be shared by hand
export async function inviteMember(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("team/invite", async () => {
    const locale = asLocale(lang);
    const ctx = await requireSection(locale, "team");
    const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const { email, role } = parsed.data;
    if (role === "manager" && ctx.role !== "owner") return { ok: false, error: "forbidden" };
    const [user] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
    if (user) return { ok: false, error: "checkFields", fieldErrors: { email: "emailTaken" } };
    // A new invitation to the same email replaces the old one
    await db.delete(schema.memberInvites).where(and(eq(schema.memberInvites.shopId, ctx.shop.id), eq(schema.memberInvites.email, email), isNull(schema.memberInvites.acceptedAt)));
    const { used, max } = await staffUsage(ctx.shop.id);
    if (max >= 0 && used >= max) return { ok: false, error: "limitStaff" };
    const token = randomBytes(32).toString("base64url");
    await db.insert(schema.memberInvites).values({ id: newId(), shopId: ctx.shop.id, email, role, tokenHash: hash(token), invitedBy: ctx.user.id, expiresAt: new Date(Date.now() + DAYS * 86400_000) });
    const link = `${(process.env.APP_URL ?? "").replace(/\/$/, "")}/${locale}/invite/${token}`;
    if (mailConfigured()) {
      const m = getDictionary(locale).team.invite.mail;
      const lines = [fmt(m.body, { name: ctx.user.name, store: ctx.shop.name }), fmt(m.expires, { days: DAYS })];
      try {
        await sendMail({ to: email, subject: fmt(m.subject, { store: ctx.shop.name }), text: `${lines.join("\n")}\n${link}`, html: mailHtml({ title: fmt(m.subject, { store: ctx.shop.name }), lines, button: m.button, url: link, footer: m.footer, rtl: locale === "ar" }) });
      } catch (err) {
        // The invitation stays: the link can still be shared by hand
        await logError("team/invite-mail", err);
      }
    }
    refresh();
    return { ok: true, message: link };
  });
}

export async function cancelInvite(lang: string, inviteId: string): Promise<ActionState> {
  return safeAction("team/cancel-invite", async () => {
    const { shop } = await requireSection(asLocale(lang), "team");
    await db.delete(schema.memberInvites).where(and(eq(schema.memberInvites.shopId, shop.id), eq(schema.memberInvites.id, inviteId), isNull(schema.memberInvites.acceptedAt)));
    refresh();
    return { ok: true };
  });
}

const acceptSchema = z.object({
  name: z.string().trim().min(2, "e:tooShort").max(120, "e:invalid"),
  password: z.string().min(8, "e:passwordShort").max(200, "e:invalid"),
});

// The invited person chooses a name and a password: an account in this shop with the invited role, signed in
export async function acceptInvite(lang: string, token: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = asLocale(lang);
  const result = await safeAction("team/accept", async () => {
    if (!/^[\w-]{20,100}$/.test(token)) return { ok: false, error: "inviteInvalid" };
    const [invite] = await db.select().from(schema.memberInvites).where(and(eq(schema.memberInvites.tokenHash, hash(token)), isNull(schema.memberInvites.acceptedAt), gt(schema.memberInvites.expiresAt, new Date())));
    if (!invite) return { ok: false, error: "inviteInvalid" };
    const parsed = acceptSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const [taken] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, invite.email));
    if (taken) return { ok: false, error: "inviteInvalid" };
    const userId = newId();
    await db.transaction(async (tx) => {
      // The emailed link proves the address
      await tx.insert(schema.users).values({ id: userId, email: invite.email, name: parsed.data.name, passwordHash: await hashPassword(parsed.data.password), locale, emailVerifiedAt: new Date() });
      await tx.insert(schema.shopMembers).values({ shopId: invite.shopId, userId, role: invite.role });
      await tx.update(schema.memberInvites).set({ acceptedAt: new Date() }).where(eq(schema.memberInvites.id, invite.id));
    });
    await createSession(userId);
    return { ok: true, message: invite.role };
  });
  if (result.ok) redirect(result.message === "agent" ? sectionHref(locale, "orders") : sectionHref(locale, "overview"));
  return result;
}
