"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  ChevronDown,
  ClipboardList,
  Dot,
  ListOrdered,
  Paintbrush,
  Plug,
  Radar,
  ScanLine,
  Send,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Undo2,
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

// The sub-sections' icons (sidebar and tabs)
const subIcons: Partial<Record<string, LucideIcon>> = {
  orders: ListOrdered,
  shipping: Send,
  tracking: Radar,
  returns: Undo2,
  abandoned: ShoppingBasket,
  protection: ShieldCheck,
  storeDesign: Paintbrush,
  themes: Sparkles,
  orderForm: ClipboardList,
  pixels: ScanLine,
  apps: Plug,
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
  // The open group in the sidebar: the current page's group, until the merchant opens or closes one
  const [openGroup, setOpenGroup] = useState<string | null>(active ?? null);
  const [seenActive, setSeenActive] = useState(active);
  if (seenActive !== active) {
    setSeenActive(active);
    setOpenGroup(active ?? null);
  }

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
          const entry = `relative flex min-h-10 w-full items-center gap-3 rounded-[10px] px-3 py-2 text-start text-sm font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-accent-bright/60 ${
            isActive ? "bg-white/[0.09] text-white" : "text-white/65 hover:bg-white/[0.05] hover:text-white"
          }`;
          const head = (
            <>
              {/* The active section: a bright bar on the inner edge */}
              {isActive && <span className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-accent-bright" aria-hidden />}
              <Icon size={18} strokeWidth={isActive ? 2.2 : 1.9} aria-hidden className={isActive ? "text-accent-bright" : "text-white/55"} />
              <span className="flex-1">{item.label}</span>
            </>
          );
          if (!sub)
            return (
              <li key={item.key} data-nav={item.key}>
                <Link href={item.href} aria-current={isActive ? "page" : undefined} className={entry} data-nav-link>
                  {head}
                </Link>
              </li>
            );
          // A group: its header opens and closes its sub-sections (they slide down and up)
          const expanded = openGroup === item.key;
          return (
            <li key={item.key} data-nav={item.key} data-open={expanded}>
              <button type="button" aria-expanded={expanded} onClick={() => setOpenGroup(expanded ? null : item.key)} className={entry} data-nav-toggle>
                {head}
                <ChevronDown size={16} aria-hidden className={`text-white/45 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
              </button>
              <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <ul className="min-h-0 overflow-hidden" data-testid="nav-children" aria-hidden={!expanded}>
                  <li className="h-1" aria-hidden />
                  {sub.map((c) => {
                    const here = current?.key === c.key;
                    const SubIcon = subIcons[c.key] ?? Dot;
                    return (
                      <li key={c.key}>
                        <Link
                          href={c.href}
                          tabIndex={expanded ? undefined : -1}
                          aria-current={here ? "page" : undefined}
                          className={`ms-4 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors ${here ? "bg-white/[0.1] font-semibold text-white" : "text-white/60 hover:bg-white/[0.05] hover:text-white"}`}
                        >
                          <SubIcon size={15} aria-hidden className={here ? "text-accent-bright" : "text-white/40"} />
                          {c.label}
                        </Link>
                      </li>
                    );
                  })}
                  <li className="h-1" aria-hidden />
                </ul>
              </div>
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
            <nav className="mb-6 -mx-1 overflow-x-auto px-1 pb-1" aria-label={activeGroup?.label} data-testid="section-tabs">
              <ul className="flex min-w-max gap-2">
                {tabs.map((c) => {
                  const here = current?.key === c.key;
                  const SubIcon = subIcons[c.key] ?? Dot;
                  return (
                    <li key={c.key}>
                      <Link
                        href={c.href}
                        aria-current={here ? "page" : undefined}
                        data-tab={c.key}
                        className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition-all ${
                          here ? "border-accent bg-accent text-accent-fg shadow-md shadow-accent/20" : "border-line bg-panel text-muted hover:border-accent/40 hover:text-fg"
                        }`}
                      >
                        <SubIcon size={16} aria-hidden className={here ? "" : "text-accent/70"} />
                        {c.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
