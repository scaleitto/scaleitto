"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  ArrowRight,
  Bell,
  Blocks,
  Building2,
  ChartColumn,
  ChevronDown,
  CircleUser,
  ClipboardCheck,
  Crosshair,
  DollarSign,
  ExternalLink,
  Gauge,
  Headset,
  House,
  LayoutTemplate,
  LifeBuoy,
  ListOrdered,
  LogOut,
  Menu,
  Moon,
  MoreVertical,
  Package,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Radar,
  ScanLine,
  Search,
  Send,
  ServerCog,
  Settings,
  ShieldCheck,
  ShoppingBasket,
  Store,
  Sun,
  Truck,
  Undo2,
  Users,
  Wallet,
  Wand2,
  Share2,
  Box,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Locale } from "@/i18n/config";
import { LanguageSwitcher } from "@/ui/LanguageSwitcher";
import { ActivityPing } from "./ActivityPing";
import { LogoMark } from "@/ui/Logo";

// Every sidebar entry's icon (merchant sections, their sub-pages and the platform admin's pages)
const icons: Partial<Record<string, LucideIcon>> = {
  overview: House,
  products: Package,
  orders: Box,
  shipping: Send,
  tracking: Radar,
  returns: Undo2,
  abandoned: ShoppingBasket,
  protection: ShieldCheck,
  scan: ScanLine,
  delivery: Truck,
  channels: Share2,
  callCenters: Headset,
  landingPages: LayoutTemplate,
  analytics: ChartColumn,
  pixels: Crosshair,
  apps: Blocks,
  storeDesign: Palette,
  themes: Wand2,
  settings: Settings,
  team: Users,
  plans: DollarSign,
  balance: Wallet,
  profile: CircleUser,
  adminOverview: Gauge,
  adminShops: Building2,
  adminRequests: ClipboardCheck,
  adminPlans: DollarSign,
  adminSystem: ServerCog,
  list: ListOrdered,
};

// A sidebar entry (a page, or a page with sub-pages) and a labelled group of entries
export type NavItem = { key: string; href: string; label: string; children?: { key: string; href: string; label: string }[] };
export type NavSection = { key: string; label?: string; items: NavItem[] };

export type ShellLabels = {
  logout: string;
  menu: string;
  search: string;
  searchEmpty: string;
  visitStore: string;
  support: string;
  profile: string;
  notifications: string;
  noNotifications: string;
  dark: string;
  light: string;
  collapse: string;
  expand: string;
  storeSettings: string;
};

// Settings kept in the browser (the sidebar folded, the dark mode), read the React way so the server render and the
// first browser render agree
function usePersisted(key: string, fallback: string) {
  const value = useSyncExternalStore(
    (notify) => {
      window.addEventListener("storage", notify);
      window.addEventListener(`sc:${key}`, notify);
      return () => {
        window.removeEventListener("storage", notify);
        window.removeEventListener(`sc:${key}`, notify);
      };
    },
    () => {
      try {
        return localStorage.getItem(key) ?? fallback;
      } catch {
        return fallback;
      }
    },
    () => fallback,
  );
  const set = (next: string) => {
    try {
      localStorage.setItem(key, next);
    } catch {}
    window.dispatchEvent(new Event(`sc:${key}`));
  };
  return [value, set] as const;
}

// Run in the page before it is painted (dashboard layout): no flash of the light theme for dark-mode users
export const THEME_SCRIPT = `try{if(localStorage.getItem("sc_theme")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export function DashboardShell({
  lang,
  brand,
  store,
  user,
  sections,
  usage,
  notifications,
  supportHref,
  profileHref,
  backLink,
  adminLink,
  labels,
  logout,
  ping = true,
  children,
}: {
  lang: Locale;
  brand: string;
  // The store card at the top of the sidebar, and the "visit store" button (none for call center agents)
  store?: { name: string; host: string; href?: string; settingsHref?: string };
  user: { name: string; role: string };
  sections: NavSection[];
  // The plan's orders this month, in the top bar (limit -1 = unlimited)
  usage?: { plan: string; text: string; ratio: number | null };
  // What waits for the team (the bell)
  notifications?: { count: number; text: string; href: string } | null;
  supportHref?: string | null;
  profileHref?: string;
  // A way back (the platform admin area → the merchant dashboard)
  backLink?: { href: string; label: string };
  // Shown to the platform admin only
  adminLink?: { href: string; label: string };
  labels: ShellLabels;
  logout: () => Promise<void>;
  ping?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  // The mobile menu closes once a page is chosen
  const [drawerPath, setDrawerPath] = useState(pathname);
  if (drawerPath !== pathname) {
    setDrawerPath(pathname);
    setDrawer(false);
  }
  const [palette, setPalette] = useState(false);
  const [folded, setFolded] = usePersisted("sc_sidebar", "open");
  const [theme, setTheme] = usePersisted("sc_theme", "light");
  const collapsed = folded === "folded";

  // The theme lives on <html> (set before paint by THEME_SCRIPT); leaving the dashboard returns to the light site
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [theme]);

  // ⌘K / Ctrl+K opens the quick search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Every page of the sidebar, and the one we are on (the longest matching link)
  const pages = useMemo(
    () => sections.flatMap((s) => s.items.flatMap((i) => (i.children?.length ? i.children.map((c) => ({ ...c, entry: i.key, entryLabel: i.label })) : [{ key: i.key, href: i.href, label: i.label, entry: i.key, entryLabel: i.label }]))),
    [sections],
  );
  const current = [...pages].filter((p) => pathname === p.href || pathname.startsWith(`${p.href}/`)).sort((a, b) => b.href.length - a.href.length)[0];
  const activeEntry = sections.flatMap((s) => s.items).find((i) => i.key === current?.entry);
  const tabs = activeEntry?.children && activeEntry.children.length > 1 ? activeEntry.children : null;
  // One entry with sub-pages open at a time: the current page's by default
  const [openKey, setOpenKey] = useState<string | null>(current?.entry ?? null);
  const [seen, setSeen] = useState(current?.entry);
  if (seen !== current?.entry) {
    setSeen(current?.entry);
    setOpenKey(current?.entry ?? null);
  }

  const sidebar = (mini: boolean) => (
    <nav className="flex h-full flex-col" aria-label={labels.menu}>
      {/* Logo and fold button */}
      <div className={`flex h-[60px] shrink-0 items-center ${mini ? "justify-center" : "justify-between px-4"}`}>
        {!mini && (
          <span className="flex items-center gap-2 text-lg font-bold tracking-tight text-accent">
            <LogoMark className="size-[26px]" /> {brand}
          </span>
        )}
        <button
          type="button"
          onClick={() => setFolded(mini ? "open" : "folded")}
          className="hidden size-8 items-center justify-center rounded-lg text-muted hover:bg-panel-2 hover:text-fg md:flex"
          aria-label={mini ? labels.expand : labels.collapse}
          title={mini ? labels.expand : labels.collapse}
        >
          {mini ? <PanelLeftOpen size={17} className="rtl:rotate-180" /> : <PanelLeftClose size={17} className="rtl:rotate-180" />}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {/* The store card */}
        {store && !mini && (
          <details className="group relative mb-3" data-testid="store-card">
            <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl border border-line bg-panel-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
                <Store size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{store.name}</span>
                <span className="block truncate text-xs text-muted" dir="ltr">
                  {store.host}
                </span>
              </span>
              <ChevronDown size={16} className="shrink-0 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <div className="absolute inset-x-0 top-full z-20 mt-1 rounded-xl border border-line bg-panel p-1 shadow-lift">
              {store.href && (
                <a href={store.href} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-panel-2">
                  <ExternalLink size={15} className="text-muted" /> {labels.visitStore}
                </a>
              )}
              {store.settingsHref && (
                <Link href={store.settingsHref} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-panel-2">
                  <Settings size={15} className="text-muted" /> {labels.storeSettings}
                </Link>
              )}
            </div>
          </details>
        )}
        {backLink && (
          <Link href={backLink.href} className={`mb-3 flex items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm font-semibold hover:bg-panel-2 ${mini ? "justify-center" : ""}`} title={backLink.label} data-testid="back-to-dashboard">
            <ArrowRight size={16} className="ltr:rotate-180" /> {!mini && backLink.label}
          </Link>
        )}

        {sections.map((section) => (
          <div key={section.key} data-section={section.key}>
            {section.label && !mini && <p className="px-2.5 pt-3.5 pb-1.5 text-[10.5px] font-semibold tracking-wider text-muted uppercase">{section.label}</p>}
            {section.label && mini && <hr className="mx-2 my-2 border-line" />}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = icons[item.key] ?? Blocks;
                const here = current?.entry === item.key;
                const hasChildren = Boolean(item.children && item.children.length > 1);
                const open = hasChildren && openKey === item.key && !mini;
                const entry = `flex h-9 w-full items-center gap-3 rounded-xl px-2.5 text-start text-sm transition-colors ${mini ? "justify-center" : ""} ${
                  here ? "bg-accent-soft font-semibold text-accent-ink" : "font-medium text-fg-2 hover:bg-panel-2 hover:text-fg"
                }`;
                return (
                  <li key={item.key} data-nav={item.key} data-open={hasChildren ? String(open) : undefined}>
                    {hasChildren && !mini ? (
                      <button type="button" className={entry} aria-expanded={open} data-nav-toggle onClick={() => setOpenKey(open ? null : item.key)}>
                        <Icon size={18} aria-hidden className={here ? "" : "text-muted"} />
                        <span className="flex-1 truncate">{item.label}</span>
                        <ChevronDown size={15} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
                      </button>
                    ) : (
                      <Link href={item.href} className={entry} aria-current={here ? "page" : undefined} title={mini ? item.label : undefined} data-nav-link>
                        <Icon size={18} aria-hidden className={here ? "" : "text-muted"} />
                        {!mini && <span className="truncate">{item.label}</span>}
                      </Link>
                    )}
                    {hasChildren && (
                      <div className={`grid transition-[grid-template-rows] duration-200 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                        <ul className="min-h-0 overflow-hidden" data-testid="nav-children">
                          {item.children!.map((c) => {
                            const at = current?.key === c.key;
                            return (
                              <li key={c.key}>
                                <Link
                                  href={c.href}
                                  aria-current={at ? "page" : undefined}
                                  className={`ms-8 mt-0.5 flex h-8 items-center rounded-lg px-3 text-[13px] transition-colors ${at ? "bg-panel-2 font-semibold text-fg" : "text-fg-2 hover:bg-panel-2 hover:text-fg"}`}
                                >
                                  {c.label}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Support and the member */}
      <div className="shrink-0 space-y-1 border-t border-line p-3">
        {supportHref && (
          <a href={supportHref} target="_blank" rel="noreferrer" className={`flex h-9 items-center gap-3 rounded-xl px-2.5 text-sm font-medium text-fg-2 hover:bg-panel-2 ${mini ? "justify-center" : ""}`} title={labels.support}>
            <LifeBuoy size={18} className="text-muted" /> {!mini && labels.support}
          </a>
        )}
        <details className="group relative">
          <summary className={`flex cursor-pointer list-none items-center gap-3 rounded-xl px-1.5 py-1.5 hover:bg-panel-2 [&::-webkit-details-marker]:hidden ${mini ? "justify-center" : ""}`} data-testid="user-chip">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-soft text-xs font-semibold text-violet" aria-hidden>
              {initialsOf(user.name)}
            </span>
            {!mini && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{user.name}</span>
                  <span className="block truncate text-xs text-muted">{user.role}</span>
                </span>
                <MoreVertical size={16} className="text-muted" />
              </>
            )}
          </summary>
          <div className="absolute bottom-full start-0 z-20 mb-1 w-56 rounded-xl border border-line bg-panel p-1 shadow-lift">
            {profileHref && (
              <Link href={profileHref} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-panel-2">
                <CircleUser size={15} className="text-muted" /> {labels.profile}
              </Link>
            )}
            {adminLink && (
              <Link href={adminLink.href} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-panel-2" data-testid="admin-link">
                <Gauge size={15} className="text-muted" /> {adminLink.label}
              </Link>
            )}
            <form action={logout}>
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger-soft" data-testid="logout">
                <LogOut size={15} /> {labels.logout}
              </button>
            </form>
          </div>
        </details>
      </div>
    </nav>
  );

  const iconButton = "flex size-10 items-center justify-center rounded-full border border-line text-fg-2 transition-colors hover:bg-panel-2 hover:text-fg";

  return (
    <div className="min-h-screen bg-bg text-fg md:flex" data-shell>
      {ping && <ActivityPing />}
      {/* Desktop sidebar (folds to icons) */}
      <aside className={`sticky top-0 hidden h-screen shrink-0 border-e border-line bg-panel transition-[width] duration-200 md:block ${collapsed ? "w-[68px]" : "w-60"}`}>{sidebar(collapsed)}</aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button className="absolute inset-0 bg-black/40" aria-label="close" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 start-0 w-64 bg-panel shadow-2xl">
            <button className="absolute end-2 top-3 z-10 rounded-lg p-2 text-muted hover:text-fg" onClick={() => setDrawer(false)} aria-label="close">
              <X size={18} />
            </button>
            {sidebar(false)}
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        {/* Top bar: quick search, the plan's usage, language, the store, notifications, dark mode */}
        <header className="sticky top-0 z-30 flex h-[60px] items-center gap-3 border-b border-line bg-panel px-4 md:px-5">
          <button className="flex size-10 items-center justify-center rounded-xl text-muted hover:bg-panel-2 hover:text-fg md:hidden" onClick={() => setDrawer(true)} aria-label={labels.menu}>
            <Menu size={20} />
          </button>
          <button type="button" onClick={() => setPalette(true)} className="hidden h-10 w-72 items-center gap-2.5 rounded-xl bg-panel-2 px-3 text-sm text-muted transition-colors hover:text-fg lg:flex" data-testid="quick-search">
            <Search size={16} />
            <span className="flex-1 truncate text-start">{labels.search}</span>
            <kbd className="rounded-md border border-line bg-panel px-1.5 py-0.5 font-sans text-[11px]" dir="ltr">
              ⌘K
            </kbd>
          </button>
          <button type="button" onClick={() => setPalette(true)} className="flex size-10 items-center justify-center rounded-xl text-muted hover:bg-panel-2 lg:hidden" aria-label={labels.search}>
            <Search size={18} />
          </button>
          {backLink && (
            <Link href={backLink.href} className="hidden items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm font-medium hover:bg-panel-2 sm:flex" data-testid="top-back">
              <ArrowRight size={14} className="ltr:rotate-180" /> {backLink.label}
            </Link>
          )}
          <div className="flex flex-1 justify-center">
            {usage && (
              <div className="hidden items-center gap-3 rounded-full border border-line bg-panel px-4 py-2 text-sm xl:flex" data-testid="usage-pill">
                <span className="size-2 rounded-full bg-accent" aria-hidden />
                <span className="font-semibold">{usage.plan}</span>
                <span className="h-4 w-px bg-line" aria-hidden />
                <span className="font-medium">{usage.text}</span>
                {usage.ratio !== null && (
                  <span className="h-1.5 w-16 overflow-hidden rounded-full bg-panel-2" aria-hidden>
                    <span className={`block h-full rounded-full ${usage.ratio >= 0.9 ? "bg-danger" : usage.ratio >= 0.75 ? "bg-warning" : "bg-accent"}`} style={{ width: `${Math.min(100, Math.round(usage.ratio * 100))}%` }} />
                  </span>
                )}
              </div>
            )}
          </div>
          <LanguageSwitcher current={lang} />
          {store?.href && (
            <a href={store.href} target="_blank" rel="noreferrer" className="hidden h-10 items-center gap-2 rounded-xl bg-accent px-4 text-[13px] font-semibold text-accent-fg shadow-[0_6px_16px_-8px_rgb(5_150_105/0.9)] transition hover:brightness-110 sm:flex" data-testid="top-link">
              <ExternalLink size={15} /> {labels.visitStore}
            </a>
          )}
          {notifications !== undefined && (
            <details className="group relative">
              <summary className={`${iconButton} relative cursor-pointer list-none [&::-webkit-details-marker]:hidden`} aria-label={labels.notifications} data-testid="bell">
                <Bell size={17} />
                {notifications && notifications.count > 0 && <span className="absolute -top-0.5 -end-0.5 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{notifications.count > 99 ? "99+" : notifications.count}</span>}
              </summary>
              <div className="absolute end-0 top-12 z-40 w-72 rounded-xl border border-line bg-panel p-3 shadow-lift">
                <p className="mb-2 text-sm font-semibold">{labels.notifications}</p>
                {notifications && notifications.count > 0 ? (
                  <Link href={notifications.href} className="block rounded-lg bg-warning-soft px-3 py-2 text-sm font-medium text-warning hover:brightness-95">
                    {notifications.text}
                  </Link>
                ) : (
                  <p className="text-sm text-muted">{labels.noNotifications}</p>
                )}
              </div>
            </details>
          )}
          <button type="button" className={iconButton} onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={theme === "dark" ? labels.light : labels.dark} title={theme === "dark" ? labels.light : labels.dark} data-testid="theme-toggle">
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </header>

        <main className="px-4 pt-4 pb-8 md:px-8">
          {/* The current entry's sub-pages */}
          {tabs && (
            <nav className="mb-5 -mx-1 overflow-x-auto px-1 pb-1" aria-label={activeEntry?.label} data-testid="section-tabs">
              <ul className="flex min-w-max gap-2">
                {tabs.map((c) => {
                  const here = current?.key === c.key;
                  const SubIcon = icons[c.key] ?? icons.list!;
                  return (
                    <li key={c.key}>
                      <Link
                        href={c.href}
                        aria-current={here ? "page" : undefined}
                        data-tab={c.key}
                        className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                          here ? "border-accent/30 bg-accent-soft text-accent-ink" : "border-line bg-panel text-fg-2 hover:bg-panel-2"
                        }`}
                      >
                        <SubIcon size={16} aria-hidden />
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

      {palette && <CommandPalette pages={pages} labels={labels} onClose={() => setPalette(false)} />}
    </div>
  );
}

// "Jump to a section": every page of the sidebar, filtered as you type; Enter opens the first, arrows move
function CommandPalette({ pages, labels, onClose }: { pages: { key: string; href: string; label: string; entryLabel: string }[]; labels: ShellLabels; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const needle = q.trim().toLowerCase();
  const found = pages.filter((p) => !needle || p.label.toLowerCase().includes(needle) || p.entryLabel.toLowerCase().includes(needle));
  const go = (href: string) => {
    onClose();
    router.push(href);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label={labels.search}>
      <button className="absolute inset-0 bg-black/40" aria-label="close" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-panel shadow-lift" data-testid="command-palette">
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search size={17} className="text-muted" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") setIndex((i) => Math.min(found.length - 1, i + 1));
              if (e.key === "ArrowUp") setIndex((i) => Math.max(0, i - 1));
              if (e.key === "Enter" && found[index]) go(found[index].href);
            }}
            placeholder={labels.search}
            className="h-12 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <ul className="max-h-80 overflow-y-auto p-1.5">
          {found.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">{labels.searchEmpty}</li>}
          {found.map((p, i) => {
            const Icon = icons[p.key] ?? Blocks;
            return (
              <li key={p.key}>
                <button type="button" onMouseEnter={() => setIndex(i)} onClick={() => go(p.href)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start text-sm ${i === index ? "bg-accent-soft text-accent-ink" : "hover:bg-panel-2"}`} data-page={p.key}>
                  <Icon size={16} className="text-muted" />
                  <span className="flex-1">{p.label}</span>
                  {p.entryLabel !== p.label && <span className="text-xs text-muted">{p.entryLabel}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
