import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { fmt, formatDate, formatTime } from "@/lib/format";
import { listTeam } from "@/features/team/queries";
import { teamPerformance } from "@/features/team/metrics";
import { TeamManager } from "@/features/team/TeamManager";

// Call center (Zimam): the agents as cards, "Add agent", and where they sign in. Agents use their own portal.
export default async function CallCentersPage({ params }: PageProps<"/[lang]/dashboard/call-centers">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop, user, role } = await requireSection(lang, "callCenters");
  const team = await listTeam(shop.id);

  const today = await teamPerformance(shop.id, team, "today");
  const presence = new Map(today.map((p) => [p.userId, p]));
  return (
    <>
      <TeamManager
        lang={lang}
        viewer={{ userId: user.id, role }}
        portal={{ url: `${(process.env.APP_URL ?? "").replace(/\/$/, "")}/${lang}/call-center/login?store=${shop.slug}`, storeId: shop.slug }}
        t={{ team: t.team, profile: t.profile, errors: t.errors, common: t.common }}
        members={team.map((m) => {
          const p = presence.get(m.userId);
          return {
            userId: m.userId,
            name: m.name,
            email: m.email,
            username: m.username ?? null,
            created: formatDate(m.createdAt, lang),
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
