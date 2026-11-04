import { and, eq, gt, isNull } from "drizzle-orm";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { db, schema } from "@/server/db";
import { formatDate } from "@/lib/format";
import { listTeam } from "@/features/team/queries";
import { TeamInvites } from "@/features/team/TeamInvites";
import { staffUsage } from "@/features/team/invites";

// Team (Zimam): invite teammates by email, see who is in the store and who is still invited
export default async function TeamPage({ params }: PageProps<"/[lang]/dashboard/team">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop, role } = await requireSection(lang, "team");
  const [team, invites, usage] = await Promise.all([
    listTeam(shop.id),
    db
      .select({ id: schema.memberInvites.id, email: schema.memberInvites.email, role: schema.memberInvites.role, expiresAt: schema.memberInvites.expiresAt })
      .from(schema.memberInvites)
      .where(and(eq(schema.memberInvites.shopId, shop.id), isNull(schema.memberInvites.acceptedAt), gt(schema.memberInvites.expiresAt, new Date()))),
    staffUsage(shop.id),
  ]);
  return (
    <>
      <TeamInvites
        lang={lang}
        title={t.sections.team.title}
        description={t.sections.team.description}
        // Zimam lists and counts the teammates: the owner is not one of them (the plan's staff limit counts the owner's seat)
        members={team.filter((m) => m.active && m.role !== "owner").map((m) => ({ userId: m.userId, name: m.name, email: m.email, role: m.role, active: m.active }))}
        invites={invites.map((i) => ({ id: i.id, email: i.email, role: i.role, expires: formatDate(i.expiresAt, lang) }))}
        used={Math.max(0, usage.used - 1)}
        max={usage.max < 0 ? -1 : Math.max(0, usage.max - 1)}
        canInviteManagers={role === "owner"}
        t={{ team: t.team, errors: t.errors, profile: t.profile }}
      />
    </>
  );
}
