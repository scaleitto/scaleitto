import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { fmt, formatTime } from "@/lib/format";
import { listTeam } from "@/features/team/queries";
import { teamPerformance } from "@/features/team/metrics";
import { TeamManager } from "@/features/team/TeamManager";
import { CallCenterHeader, MyPerformance, parsePeriod } from "@/features/team/views";
import { distributionBoard } from "@/features/team/distribution";
import { DistributionBoard } from "@/features/team/DistributionBoard";

// Managers: the team. Agents: their own performance.
export default async function CallCentersPage({ params, searchParams }: PageProps<"/[lang]/dashboard/call-centers">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop, user, role } = await requireSection(lang, "callCenters");
  const team = await listTeam(shop.id);

  if (role === "agent") {
    const period = parsePeriod((await searchParams).period);
    const [me] = await teamPerformance(shop.id, team.filter((m) => m.userId === user.id), period);
    return <MyPerformance lang={lang} p={me} period={period} t={t} />;
  }

  const [today, board] = await Promise.all([teamPerformance(shop.id, team, "today"), distributionBoard(shop.id)]);
  const presence = new Map(today.map((p) => [p.userId, p]));
  return (
    <>
      <CallCenterHeader lang={lang} t={t} current="team" />
      <DistributionBoard lang={lang} mode={shop.assignMode} board={board} t={t} />
      <TeamManager
        lang={lang}
        viewer={{ userId: user.id, role }}
        t={{ team: t.team, profile: t.profile, errors: t.errors, common: t.common }}
        members={team.map((m) => {
          const p = presence.get(m.userId);
          return {
            userId: m.userId,
            name: m.name,
            email: m.email,
            role: m.role,
            active: m.active,
            schedule: m.schedule ?? null,
            online: p?.online ?? false,
            presence: p?.todayStart ? fmt(t.team.startedAt, { time: formatTime(p.todayStart, lang) }) : t.team.notToday,
          };
        })}
      />
    </>
  );
}
