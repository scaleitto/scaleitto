import "server-only";
import { randomUUID } from "node:crypto";
import { db, schema } from "@/db";

// Saves a handled error so the platform admin sees it in admin → System → Error log.
export async function logError(where: string, err: unknown) {
  const e = err as { message?: string; stack?: string };
  console.error(`[${where}]`, err);
  await db
    .insert(schema.errorLogs)
    .values({ id: randomUUID(), message: String(e?.message ?? err).slice(0, 2000), stack: e?.stack?.slice(0, 6000) ?? null, path: where.slice(0, 500), routeType: "handled" })
    .catch(() => {});
}
