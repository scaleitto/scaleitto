import { getDictionary, asLocale } from "@/i18n";
import { requireAgent } from "@/server/auth/context";
import { agentOverview } from "@/features/team/agent-overview";
import { AgentDashboard } from "@/features/team/AgentDashboard";

export default async function PortalHome({ params }: PageProps<"/[lang]/call-center">) {
  const lang = asLocale((await params).lang);
  const { shop, user } = await requireAgent(lang);
  const data = await agentOverview(shop.id, user.id);
  return <AgentDashboard lang={lang} name={user.name} data={data} t={getDictionary(lang)} />;
}
