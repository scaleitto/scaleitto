import { getDictionary, asLocale } from "@/i18n";
import { requirePlatformAdmin } from "@/server/auth/context";
import { logout } from "@/features/auth/actions";
import { DashboardShell, THEME_SCRIPT } from "@/features/shell/DashboardShell";

// The platform admin area (PLATFORM_ADMIN_EMAIL's account), with its own menu
export default async function AdminLayout({ children, params }: LayoutProps<"/[lang]/admin">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const user = await requirePlatformAdmin(lang);
  const n = t.admin.nav;
  const items: { key: string; path: string; label: string }[] = [
    { key: "adminOverview", path: "", label: n.overview },
    { key: "adminShops", path: "/shops", label: n.shops },
    { key: "adminRequests", path: "/plan-requests", label: n.requests },
    { key: "adminPlans", path: "/plans", label: n.plans },
    { key: "adminSystem", path: "/system", label: n.system },
  ];
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <DashboardShell
        lang={lang}
        brand={t.brand}
        user={{ name: user.name, role: n.adminLink }}
        backLink={{ href: `/${lang}/dashboard`, label: n.toDashboard }}
        sections={[{ key: "admin", items: items.map((i) => ({ key: i.key, href: `/${lang}/admin${i.path}`, label: i.label })) }]}
        labels={{ ...t.shell, logout: t.nav.logout, menu: t.nav.menu }}
        logout={logout.bind(null, lang)}
        ping={false}
      >
        {children}
      </DashboardShell>
    </>
  );
}
