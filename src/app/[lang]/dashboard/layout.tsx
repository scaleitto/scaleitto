import { getDictionary, asLocale } from "@/i18n";
import { requireShop } from "@/server/auth/context";
import { sectionHref, sectionsFor } from "@/lib/permissions";
import { storeUrl } from "@/lib/urls";
import { logout } from "@/features/auth/actions";
import { DashboardShell } from "@/features/shell/DashboardShell";
import { planNotice } from "@/features/plans/queries";
import { PlanNoticeBanner } from "@/features/plans/views";

export default async function DashboardLayout({ children, params }: LayoutProps<"/[lang]/dashboard">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop, user, role } = await requireShop(lang);
  // Locked orders / a limit past its alert threshold (agents are not concerned)
  const notice = role === "agent" ? null : await planNotice(shop.id);
  return (
    <DashboardShell
      lang={lang}
      brand={t.brand}
      shopName={shop.name}
      userName={user.name}
      // Call center agents work on orders only: no link to the store they do not manage
      topLink={role === "agent" ? undefined : { href: storeUrl(shop), label: t.nav.viewStore, external: true }}
      adminLink={user.isPlatformAdmin ? { href: `/${lang}/admin`, label: t.admin.nav.adminLink } : undefined}
      items={sectionsFor(role).map((s) => ({ key: s.key, href: sectionHref(lang, s.key), label: t.nav[s.key] }))}
      labels={{ logout: t.nav.logout, menu: t.nav.menu }}
      logout={logout.bind(null, lang)}
    >
      {notice && <PlanNoticeBanner notice={notice} plansHref={role === "owner" ? sectionHref(lang, "plans") : null} t={t} />}
      {children}
    </DashboardShell>
  );
}
