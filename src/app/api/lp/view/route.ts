import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";

// One visit of a published landing page (sent by LandingView).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" && /^[0-9a-f-]{36}$/.test(body.id) ? body.id : null;
  if (!id) return Response.json({ ok: false }, { status: 400 });
  await db
    .update(schema.landingPages)
    .set({ views: sql`${schema.landingPages.views} + 1` })
    .where(and(eq(schema.landingPages.id, id), eq(schema.landingPages.status, "published")));
  return Response.json({ ok: true });
}
