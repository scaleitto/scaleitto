import "server-only";
import { randomUUID } from "node:crypto";
import { unstable_rethrow } from "next/navigation";
import { db, schema } from "@/server/db";
import type { ActionState } from "@/lib/action";

// Saves a handled error so the platform admin can read it (admin → System → Errors).
export async function logError(where: string, err: unknown) {
  const e = err as { message?: string; stack?: string; cause?: { message?: string; code?: string } };
  console.error(`[${where}]`, err);
  // Database errors arrive wrapped ("Failed query: …"): the driver's own reason (in the cause) goes first
  const cause = e?.cause?.message ? `${e.cause.code ? `${e.cause.code} ` : ""}${e.cause.message}\n` : "";
  await db
    .insert(schema.errorLogs)
    .values({ id: randomUUID(), message: `${cause}${String(e?.message ?? err)}`.slice(0, 2000), stack: e?.stack?.slice(0, 6000) ?? null, path: where.slice(0, 500), routeType: "action" })
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
