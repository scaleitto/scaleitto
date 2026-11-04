import { and, count, inArray } from "drizzle-orm";
import { getDictionary, asLocale } from "@/i18n";
import { agentHome, requireAgent } from "@/server/auth/context";
import { db, schema } from "@/server/db";
import { fmt } from "@/lib/format";
import { agentLogout } from "@/features/team/portal";
import { DashboardShell, THEME_SCRIPT } from "@/features/shell/DashboardShell";
import { visibleOrders, viewerOf } from "@/features/orders/access";

// The call-center agents' portal (Zimam): Dashboard, Orders and Log out, nothing else of the store
export default async function PortalLayout({ children, params }: LayoutProps<"/[lang]/call-center">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const ctx = await requireAgent(lang);
  const home = agentHome(lang);
  const [waiting] = await db
    .select({ n: count() })
    .from(schema.orders)
    .where(and(visibleOrders(viewerOf(ctx)), inArray(schema.orders.status, ["pending"])));
  const s = t.shell;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <DashboardShell
        lang={lang}
        brand={`${t.brand} ${t.portal.brand}`}
        user={{ name: ctx.user.name, role: t.portal.badge }}
        sections={[
          {
            key: "main",
            items: [
              { key: "overview", href: home, label: t.portal.nav.dashboard },
              { key: "orders", href: `${home}/orders`, label: t.portal.nav.orders },
            ],
          },
        ]}
        alerts={{ title: t.settings.notify.alertTitle, body: t.settings.notify.alertBody, href: `${home}/orders` }}
        notifications={{ count: waiting.n, text: fmt(s.waitingOrders, { n: waiting.n }), href: `${home}/orders?status=pending` }}
        labels={{ ...s, logout: t.portal.nav.logout, menu: t.portal.menu }}
        logout={agentLogout.bind(null, lang)}
        logoutInNav
      >
        {children}
      </DashboardShell>
    </>
  );
}
