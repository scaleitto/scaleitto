"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Blocks,
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

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-3" aria-label={labels.menu}>
      <div className="mb-5 flex items-center gap-3 px-2 pt-2">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4ade80] to-[#16a34a] text-lg font-extrabold text-white shadow-lg shadow-black/20">{brand.charAt(0)}</span>
        <span className="min-w-0">
          <span className="block text-lg leading-tight font-extrabold text-white">{brand}</span>
          <span className="block truncate text-xs text-white/55">{shopName}</span>
        </span>
      </div>
      {items.map((item) => {
        const Icon = icons[item.key];
        const isActive = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
              isActive ? "bg-white/12 text-white shadow-inner shadow-black/10 ring-1 ring-white/10" : "text-white/65 hover:bg-white/6 hover:text-white"
            }`}
          >
            <Icon size={18} strokeWidth={2} aria-hidden className={isActive ? "text-[#4ade80]" : ""} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen md:flex">
      {ping && <ActivityPing />}
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 bg-gradient-to-b from-[#0d2e22] to-[#0a1f18] md:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button className="absolute inset-0 bg-black/60" aria-label="close" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-64 bg-gradient-to-b from-[#0d2e22] to-[#0a1f18]">
            <button className="absolute end-2 top-2 rounded-lg p-2 text-white/60 hover:text-white" onClick={() => setOpen(false)} aria-label="close">
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-panel/95 px-4 py-3 shadow-sm shadow-black/[0.03] backdrop-blur">
          <div className="flex items-center gap-2">
            <button className="rounded-lg p-2 text-muted hover:bg-panel-2 hover:text-fg md:hidden" onClick={() => setOpen(true)} aria-label={labels.menu}>
              <Menu size={20} />
            </button>
            {topLink && (
              <a href={topLink.href} target={topLink.external ? "_blank" : undefined} rel={topLink.external ? "noreferrer" : undefined} className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg" data-testid="top-link">
                <ExternalLink size={15} /> {topLink.label}
              </a>
            )}
          </div>
          <div className="flex items-center gap-3">
            {adminLink && (
              <Link href={adminLink.href} className="hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-accent hover:bg-panel-2 sm:flex" data-testid="admin-link">
                <Gauge size={15} /> {adminLink.label}
              </Link>
            )}
            <LanguageSwitcher current={lang} />
            <span className="hidden text-sm text-muted sm:inline">{userName}</span>
            <form action={logout}>
              <button className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-panel-2 hover:text-danger" title={labels.logout}>
                <LogOut size={16} />
                <span className="hidden sm:inline">{labels.logout}</span>
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto max-w-6xl p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
