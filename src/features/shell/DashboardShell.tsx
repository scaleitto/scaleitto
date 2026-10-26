"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Blocks,
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

const icons: Record<SectionKey, LucideIcon> = {
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
};

export type NavItem = { key: SectionKey; href: string; label: string };

export function DashboardShell({
  lang,
  brand,
  shopName,
  userName,
  storeUrl,
  items,
  labels,
  logout,
  children,
}: {
  lang: Locale;
  brand: string;
  shopName: string;
  userName: string;
  storeUrl: string;
  items: NavItem[];
  labels: { viewStore: string; logout: string; menu: string };
  logout: () => Promise<void>;
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
      <div className="mb-4 px-3 pt-2">
        <div className="text-xl font-extrabold text-accent">{brand}</div>
        <div className="mt-0.5 truncate text-xs text-muted">{shopName}</div>
      </div>
      {items.map((item) => {
        const Icon = icons[item.key];
        const isActive = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              isActive ? "border-e-2 border-accent bg-accent/10 text-accent" : "text-muted hover:bg-panel-2 hover:text-fg"
            }`}
          >
            <Icon size={18} strokeWidth={2} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-e border-line bg-panel md:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button className="absolute inset-0 bg-black/60" aria-label="close" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-64 border-e border-line bg-panel">
            <button className="absolute end-2 top-2 rounded-lg p-2 text-muted hover:text-fg" onClick={() => setOpen(false)} aria-label="close">
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <button className="rounded-lg p-2 text-muted hover:bg-panel-2 hover:text-fg md:hidden" onClick={() => setOpen(true)} aria-label={labels.menu}>
              <Menu size={20} />
            </button>
            <a href={storeUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
              <ExternalLink size={15} /> {labels.viewStore}
            </a>
          </div>
          <div className="flex items-center gap-3">
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
