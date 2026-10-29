"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  Blocks,
  Boxes,
  Wallet,
  Building2,
  ClipboardCheck,
  Gauge,
  ServerCog,
  ChartColumn,
  CircleUser,
  DollarSign,
  ExternalLink,
  Headset,
  House,
  LayoutTemplate,
  LogOut,
  Menu,
  Package,
  Palette,
  Settings,
  ShoppingCart,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { NavGroupKey } from "@/lib/permissions";
import { LanguageSwitcher } from "@/ui/LanguageSwitcher";
import { ActivityPing } from "./ActivityPing";
import { LogoMark } from "@/ui/Logo";

// Merchant sections and the platform admin's pages
export type ShellKey = NavGroupKey | "adminOverview" | "adminShops" | "adminRequests" | "adminPlans" | "adminSystem";

const icons: Record<ShellKey, LucideIcon> = {
  overview: House,
  products: Package,
  inventory: Boxes,
  orders: ShoppingCart,
  delivery: Truck,
  finance: Wallet,
  storeDesign: Palette,
  callCenters: Headset,
  landingPages: LayoutTemplate,
  analytics: ChartColumn,
  integrations: Blocks,
  plans: DollarSign,
  settings: Settings,
  profile: CircleUser,
  adminOverview: Gauge,
  adminShops: Building2,
  adminRequests: ClipboardCheck,
  adminPlans: DollarSign,
  adminSystem: ServerCog,
};

// A sidebar entry; a group lists its sub-sections (shown under it in the sidebar and as tabs above its pages)
export type NavItem = { key: ShellKey; href: string; label: string; children?: { key: string; href: string; label: string }[] };

export function DashboardShell({
  lang,
  brand,
  shopName,
  userName,
  topLink,
  backLink,
  adminLink,
  items,
  labels,
  logout,
  ping = true,
  children,
}: {
  lang: Locale;
  brand: string;
  shopName: string;
  userName: string;
  // The link at the top (the store)
  topLink?: { href: string; label: string; external?: boolean };
  // A way back (the platform admin area → the merchant dashboard), first in the sidebar and in the header
  backLink?: { href: string; label: string };
  // Shown to the platform admin only
  adminLink?: { href: string; label: string };
  items: NavItem[];
  labels: { logout: string; menu: string };
  logout: () => Promise<void>;
  // Working-time heartbeat (shop members only)
  ping?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  // The mobile menu is open only on the page where it was opened, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);

  // The longest matching href wins, so /dashboard does not stay active on /dashboard/orders (nor orders on orders/shipping).
  const pages = items.flatMap((i) => (i.children?.length ? i.children.map((c) => ({ group: i.key, key: c.key, href: c.href })) : [{ group: i.key, key: i.key as string, href: i.href }]));
  const current = pages.filter((p) => pathname === p.href || pathname.startsWith(`${p.href}/`)).sort((a, b) => b.href.length - a.href.length)[0];
  const active = current?.group;
  const activeGroup = items.find((i) => i.key === active);
  const tabs = activeGroup?.children && activeGroup.children.length > 1 ? activeGroup.children : null;

  const initials = userName.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0)).join("").toUpperCase() || "•";

  const sidebar = (
    <nav className="flex h-full flex-col overflow-y-auto px-3 pt-4 pb-3" aria-label={labels.menu}>
      <div className="mb-6 flex items-center gap-3 rounded-xl px-2 py-1">
        <LogoMark className="size-10 drop-shadow-[0_6px_12px_rgba(124,108,242,.45)]" />
        <span className="min-w-0">
          <span className="block text-[17px] leading-tight font-bold tracking-tight text-white">{brand}</span>
          <span className="block truncate text-xs text-white/55">{shopName}</span>
        </span>
      </div>
      {backLink && (
        <Link
          href={backLink.href}
          className="mb-4 flex items-center gap-2 rounded-[10px] bg-white/[0.08] px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.14]"
          data-testid="back-to-dashboard"
        >
          <ArrowRight size={16} className="ltr:rotate-180" /> {backLink.label}
        </Link>
      )}
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const Icon = icons[item.key];
          const isActive = item.key === active;
          const sub = item.children && item.children.length > 1 ? item.children : null;
          return (
            <li key={item.key} data-nav={item.key}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex min-h-10 items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-accent-bright/60 ${
                  isActive ? "bg-white/[0.09] text-white" : "text-white/65 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                {/* The active page: a bright green bar on the inner edge */}
                {isActive && <span className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-accent-bright" aria-hidden />}
                <Icon size={18} strokeWidth={isActive ? 2.2 : 1.9} aria-hidden className={isActive ? "text-accent-bright" : "text-white/55"} />
                {item.label}
              </Link>
              {/* The group's sub-sections, open under the active group */}
              {sub && isActive && (
                <ul className="ms-[1.35rem] mt-0.5 mb-1 border-s border-white/10 ps-2.5" data-testid="nav-children">
                  {sub.map((c) => {
                    const here = current?.key === c.key;
                    return (
                      <li key={c.key}>
                        <Link
                          href={c.href}
                          aria-current={here ? "page" : undefined}
                          className={`block rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${here ? "font-semibold text-white" : "text-white/55 hover:text-white"}`}
                        >
                          {c.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-auto flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 pt-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white" aria-hidden>
          {initials}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-white/85">{userName}</span>
        <form action={logout}>
          <button className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-accent-bright/60 focus-visible:outline-none" title={labels.logout} aria-label={labels.logout} data-testid="logout">
            <LogOut size={17} />
          </button>
        </form>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen md:flex" data-shell>
      {ping && <ActivityPing />}
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[17rem] shrink-0 bg-gradient-to-b from-sidebar to-ink md:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" aria-label="close" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-[17rem] bg-gradient-to-b from-sidebar to-ink shadow-2xl">
            <button className="absolute end-2 top-3 rounded-lg p-2 text-white/60 hover:text-white" onClick={() => setOpen(false)} aria-label="close">
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-panel/90 px-4 backdrop-blur-md md:px-8">
          <div className="flex items-center gap-2">
            <button className="flex size-10 items-center justify-center rounded-[10px] text-muted hover:bg-panel-2 hover:text-fg md:hidden" onClick={() => setOpen(true)} aria-label={labels.menu}>
              <Menu size={20} />
            </button>
            {backLink && (
              <Link href={backLink.href} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm font-medium text-fg transition-colors hover:border-accent/40 hover:text-accent" data-testid="top-back">
                <ArrowRight size={14} className="ltr:rotate-180" /> {backLink.label}
              </Link>
            )}
            {topLink && (
              <a
                href={topLink.href}
                target={topLink.external ? "_blank" : undefined}
                rel={topLink.external ? "noreferrer" : undefined}
                className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm font-medium text-fg transition-colors hover:border-accent/40 hover:text-accent"
                data-testid="top-link"
              >
                <ExternalLink size={14} /> {topLink.label}
              </a>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {adminLink && (
              <Link href={adminLink.href} className="hidden items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5 text-sm font-semibold text-accent hover:bg-accent/15 sm:flex" data-testid="admin-link">
                <Gauge size={15} /> {adminLink.label}
              </Link>
            )}
            <LanguageSwitcher current={lang} />
            <span className="hidden items-center gap-2 text-sm font-medium text-fg lg:flex">
              <span className="flex size-8 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent" aria-hidden>
                {initials}
              </span>
              {userName}
            </span>
            <form action={logout} className="md:hidden">
              <button className="flex size-10 items-center justify-center rounded-[10px] text-muted hover:bg-panel-2 hover:text-danger" title={labels.logout} aria-label={labels.logout} data-testid="logout">
                <LogOut size={17} />
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
          {/* The active group's sub-sections */}
          {tabs && (
            <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-line bg-panel p-1 text-sm shadow-sm" aria-label={activeGroup?.label} data-testid="section-tabs">
              {tabs.map((c) => {
                const here = current?.key === c.key;
                return (
                  <Link
                    key={c.key}
                    href={c.href}
                    aria-current={here ? "page" : undefined}
                    data-tab={c.key}
                    className={`shrink-0 rounded-lg px-3.5 py-2 font-semibold whitespace-nowrap transition-colors ${here ? "bg-accent text-accent-fg shadow-sm" : "text-muted hover:bg-panel-2 hover:text-fg"}`}
                  >
                    {c.label}
                  </Link>
                );
              })}
            </nav>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
