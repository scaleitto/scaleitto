import { and, count, inArray } from "drizzle-orm";
import { getDictionary, asLocale } from "@/i18n";
import { requireShop } from "@/server/auth/context";
import { db, schema } from "@/server/db";
import { navFor, sectionHref } from "@/lib/permissions";
import { storeUrl } from "@/lib/urls";
import { fmt } from "@/lib/format";
import { getCurrentPlan, getUsage, orderRule } from "@/server/limits";
import { logout } from "@/features/auth/actions";
import { DashboardShell, THEME_SCRIPT } from "@/features/shell/DashboardShell";
import { planNotice } from "@/features/plans/queries";
import { PlanNoticeBanner } from "@/features/plans/views";
import { visibleOrders, viewerOf } from "@/features/orders/access";

export default async function DashboardLayout({ children, params }: LayoutProps<"/[lang]/dashboard">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const ctx = await requireShop(lang);
  const { shop, user, role } = ctx;
  // Agents work in their portal: no dashboard shell; each page sends them to its portal page (order links keep their id)
  if (role === "agent") return children;
  const s = t.shell;
  // Locked orders / a limit past its alert threshold
  const [notice, plan, rule, used, [waiting]] = await Promise.all([
    planNotice(shop.id),
    getCurrentPlan(shop.id),
    orderRule(shop.id),
    getUsage(shop.id, "maxOrdersPerMonth"),
    // The bell: new orders waiting for a call
    db
      .select({ n: count() })
      .from(schema.orders)
      .where(and(visibleOrders(viewerOf(ctx)), inArray(schema.orders.status, ["pending"]))),
  ]);
  const url = storeUrl(shop);
  const usage =
    plan && rule
      ? {
          plan: plan.plan.name,
          text: rule.kind === "credits" ? fmt(s.usageCredits, { n: rule.credits }) : rule.limit === -1 ? fmt(s.usageUnlimited, { n: used }) : fmt(s.usage, { n: used, limit: rule.limit }),
          ratio: rule.kind === "monthly" && rule.limit > 0 ? used / rule.limit : null,
        }
      : undefined;
  const whatsapp = process.env.PAYMENT_WHATSAPP?.replace(/[^\d]/g, "");
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <DashboardShell
        lang={lang}
        brand={t.brand}
        store={{ name: shop.name, host: url.replace(/^https?:\/\//, ""), href: url, settingsHref: sectionHref(lang, "settings") }}
        user={{ name: user.name, role: t.profile.roles[role] }}
        sections={navFor(role).map((g) => ({
          key: g.key,
          label: g.key === "main" ? undefined : t.nav.groups[g.key],
          items: g.items.map((e) => ({
            key: e.key,
            href: sectionHref(lang, e.children[0] ?? e.key),
            label: t.nav.items[e.key as keyof typeof t.nav.items] ?? t.subnav[e.key],
            children: e.children.length > 1 ? e.children.map((k) => ({ key: k, href: sectionHref(lang, k), label: t.subnav[k] })) : undefined,
          })),
        }))}
        usage={usage}
        notifications={{ count: waiting.n, text: fmt(s.waitingOrders, { n: waiting.n }), href: `${sectionHref(lang, "orders")}?status=pending` }}
        supportHref={whatsapp ? `https://wa.me/${whatsapp}` : null}
        profileHref={sectionHref(lang, "profile")}
        adminLink={user.isPlatformAdmin ? { href: `/${lang}/admin`, label: t.admin.nav.adminLink } : undefined}
        labels={{ ...s, logout: t.nav.logout, menu: t.nav.menu }}
        logout={logout.bind(null, lang)}
      >
        {notice && <PlanNoticeBanner notice={notice} plansHref={role === "owner" ? sectionHref(lang, "plans") : null} t={t} />}
        {children}
      </DashboardShell>
    </>
  );
}
