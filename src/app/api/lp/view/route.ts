import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";

// One visit of a published landing page and of the version shown (sent by LandingView).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: unknown; v?: unknown } | null;
  const id = typeof body?.id === "string" && /^[0-9a-f-]{36}$/.test(body.id) ? body.id : null;
  const version = body?.v === "B" || body?.v === "C" ? body.v : "A";
  if (!id) return Response.json({ ok: false }, { status: 400 });
  const [page] = await db.select({ shopId: schema.landingPages.shopId }).from(schema.landingPages).where(and(eq(schema.landingPages.id, id), eq(schema.landingPages.status, "published")));
  if (!page) return Response.json({ ok: false }, { status: 404 });
  await db.update(schema.landingPages).set({ views: sql`${schema.landingPages.views} + 1` }).where(eq(schema.landingPages.id, id));
  await db
    .insert(schema.landingStats)
    .values({ pageId: id, version, shopId: page.shopId, views: 1 })
    .onDuplicateKeyUpdate({ set: { views: sql`${schema.landingStats.views} + 1` } });
  return Response.json({ ok: true });
}
