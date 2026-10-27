import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { getShopContext } from "@/server/auth/context";
import { logError } from "@/server/errors";
import { algeriaParts } from "@/lib/time";
import { inShift } from "@/features/team/schedule";

// Heartbeat sent every minute by an open and used dashboard: counts working minutes per day
// (and how many of them fall inside the member's schedule). Several tabs never count twice.
export async function POST() {
  const ctx = await getShopContext();
  if (!ctx) return Response.json({ ok: false }, { status: 401 });
  try {
    const now = new Date();
    const { day, weekday, minutes } = algeriaParts(now);
    const [member] = await db
      .select({ schedule: schema.shopMembers.schedule })
      .from(schema.shopMembers)
      .where(and(eq(schema.shopMembers.shopId, ctx.shop.id), eq(schema.shopMembers.userId, ctx.user.id)));
    const shift = inShift(member?.schedule ?? null, weekday, minutes) ? 1 : 0;
    const a = schema.memberActivity;
    // A minute counts only if the previous one was counted at least 50 seconds ago
    const counts = sql`${a.lastSeen} <= ${new Date(now.getTime() - 50_000)}`;
    await db
      .insert(a)
      .values({ shopId: ctx.shop.id, userId: ctx.user.id, day, firstSeen: now, lastSeen: now, activeMinutes: 1, shiftMinutes: shift })
      .onDuplicateKeyUpdate({
        set: {
          activeMinutes: sql`IF(${counts}, ${a.activeMinutes} + 1, ${a.activeMinutes})`,
          shiftMinutes: sql`IF(${counts}, ${a.shiftMinutes} + ${shift}, ${a.shiftMinutes})`,
          lastSeen: sql`IF(${counts}, ${now}, ${a.lastSeen})`,
        },
      });
    return Response.json({ ok: true });
  } catch (err) {
    await logError("api/activity", err);
    return Response.json({ ok: false }, { status: 500 });
  }
}
