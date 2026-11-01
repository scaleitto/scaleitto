import { and, eq, gt, isNull } from "drizzle-orm";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { db, schema } from "@/server/db";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/ui";
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
      <PageHeader title={t.sections.team.title} description={t.sections.team.description} />
      <TeamInvites
        lang={lang}
        members={team.filter((m) => m.active).map((m) => ({ userId: m.userId, name: m.name, email: m.email, role: m.role, active: m.active }))}
        invites={invites.map((i) => ({ id: i.id, email: i.email, role: i.role, expires: formatDate(i.expiresAt, lang) }))}
        used={usage.used}
        max={usage.max}
        canInviteManagers={role === "owner"}
        t={{ team: t.team, errors: t.errors, profile: t.profile }}
      />
    </>
  );
}
