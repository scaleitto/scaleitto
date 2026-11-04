"use server";

import { and, eq, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { verifyPassword } from "@/server/auth/password";
import { createSession, destroySession } from "@/server/auth/session";
import { safeAction } from "@/server/errors";
import { asLocale } from "@/i18n";
import { fieldErrorsFrom } from "@/lib/validation";
import type { ActionState } from "@/lib/action";
import { headers } from "next/headers";
import { clearAttempts, recordFailure, tooManyFailures } from "@/server/rate-limit";
import { clientIp } from "@/server/client-ip";

const loginSchema = z.object({
  store: z.string().trim().toLowerCase().min(1, "e:required").max(255),
  username: z.string().trim().toLowerCase().min(1, "e:required").max(191),
  password: z.string().min(1, "e:required").max(200),
});

// The agent portal's sign-in (Zimam): the store (its link name or its own domain), the agent's username (or email) and
// password. Only active agents of an active store get in; owners and managers use the normal sign-in.
export async function agentLogin(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = asLocale(lang);
  let ok = false;
  const result = await safeAction("auth/agent-login", async () => {
    const parsed = loginSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
    const { store, username, password } = parsed.data;
    const key = store.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
    const accountKey = `agent-login:${key}:${username}`;
    const ipKey = `login-ip:${clientIp(await headers()) ?? "?"}`;
    if (tooManyFailures(accountKey, 10, 15 * 60_000) || tooManyFailures(ipKey, 50, 15 * 60_000)) return { ok: false, error: "tooManyAttempts" };
    const [row] = await db
      .select({ userId: schema.users.id, hash: schema.users.passwordHash, role: schema.shopMembers.role, active: schema.shopMembers.active, status: schema.shops.status })
      .from(schema.shopMembers)
      .innerJoin(schema.shops, eq(schema.shops.id, schema.shopMembers.shopId))
      .innerJoin(schema.users, eq(schema.users.id, schema.shopMembers.userId))
      .where(and(or(eq(schema.shops.slug, key), eq(schema.shops.customDomain, key)), or(eq(schema.shopMembers.username, username), eq(schema.users.email, username))))
      .limit(1);
    if (!row || row.role !== "agent" || !(await verifyPassword(password, row.hash))) {
      recordFailure(accountKey);
      recordFailure(ipKey);
      return { ok: false, error: "invalidCredentials" };
    }
    clearAttempts(accountKey);
    if (!row.active || row.status !== "active") return { ok: false, error: "accountDisabled" };
    await createSession(row.userId);
    ok = true;
    return { ok: true };
  });
  if (ok) redirect(`/${locale}/call-center`);
  return result;
}

export async function agentLogout(lang: string) {
  await destroySession();
  redirect(`/${asLocale(lang)}/call-center/login`);
}
