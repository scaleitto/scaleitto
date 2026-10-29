"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Blocks,
  Building2,
  ClipboardCheck,
  ClipboardList,
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
  ScanLine,
  Settings,
  ShoppingCart,
  Truck,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { SectionKey } from "@/lib/permissions";
import { LanguageSwitcher } from "@/ui/LanguageSwitcher";
import { ActivityPing } from "./ActivityPing";
import { LogoMark } from "@/ui/Logo";

// Merchant sections and the platform admin's pages
export type ShellKey = SectionKey | "adminOverview" | "adminShops" | "adminRequests" | "adminPlans" | "adminSystem";

const icons: Record<ShellKey, LucideIcon> = {
  overview: House,
  products: Package,
  orders: ShoppingCart,
  delivery: Truck,
  storeDesign: Palette,
  themes: WandSparkles,
  callCenters: Headset,
  landingPages: LayoutTemplate,
  orderForm: ClipboardList,
  analytics: ChartColumn,
  pixels: ScanLine,
  apps: Blocks,
  plans: DollarSign,
  settings: Settings,
  profile: CircleUser,
  adminOverview: Gauge,
  adminShops: Building2,
  adminRequests: ClipboardCheck,
  adminPlans: DollarSign,
  adminSystem: ServerCog,
};

export type NavItem = { key: ShellKey; href: string; label: string };

export function DashboardShell({
  lang,
  brand,
  shopName,
  userName,
  topLink,
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
  // The link at the top (the store, or the merchant dashboard from the admin)
  topLink?: { href: string; label: string; external?: boolean };
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

  // The longest matching href wins, so /dashboard does not stay active on /dashboard/orders.
  const active = items.filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`)).sort((a, b) => b.href.length - a.href.length)[0]?.key;

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
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const Icon = icons[item.key];
          const isActive = item.key === active;
          return (
            <li key={item.key}>
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
        <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
