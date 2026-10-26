import "server-only";
import { randomUUID } from "node:crypto";
import { unstable_rethrow } from "next/navigation";
import type { ZodError } from "zod";
import { db, schema } from "@/server/db";
import type { ActionState } from "@/lib/action";

// Saves a handled error so the platform admin can read it (admin → System → Errors).
export async function logError(where: string, err: unknown) {
  const e = err as { message?: string; stack?: string };
  console.error(`[${where}]`, err);
  await db
    .insert(schema.errorLogs)
    .values({ id: randomUUID(), message: String(e?.message ?? err).slice(0, 2000), stack: e?.stack?.slice(0, 6000) ?? null, path: where.slice(0, 500), routeType: "action" })
    .catch(() => {});
}

// Wraps a server action: an unexpected failure is logged and returned as a readable
// error instead of the generic "server error" page. redirect()/notFound() still work.
export async function safeAction(where: string, fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (err) {
    unstable_rethrow(err);
    await logError(where, err);
    return { ok: false, error: "unexpected" };
  }
}

// Zod issues → { field: "messageKey" } using the first problem of each field.
export function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (!out[field]) out[field] = issue.message.startsWith("e:") ? issue.message.slice(2) : "invalid";
  }
  return out;
}
