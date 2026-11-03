import type { MemberRole } from "@/server/db/schema";

const all = ["owner", "manager", "agent"] as const;
const managers = ["owner", "manager"] as const;

// The dashboard pages and who may open them. Single source of truth for the sidebar, the sub-section tabs and the
// server-side page guards (requireSection). The sidebar groups some of them (navGroups below).
export const sections = [
  { key: "overview", path: "", roles: managers },
  { key: "products", path: "products", roles: managers },
  // Orders: one page with a tab per status; Scan sends and receives parcels by their label
  { key: "orders", path: "orders", roles: all },
  { key: "scan", path: "scan", roles: managers },
  // Delivery (Zimam): the companies, the handover manifest template, the general settings (options, prices)
  { key: "delivery", path: "delivery", roles: managers },
  { key: "manifest", path: "delivery/manifest", roles: managers },
  { key: "deliverySettings", path: "delivery/settings", roles: managers },
  // Store design: the look and the themes
  { key: "storeDesign", path: "store-design", roles: managers },
  { key: "themes", path: "store-design/themes", roles: managers },
  { key: "channels", path: "channels", roles: managers },
  { key: "callCenters", path: "call-centers", roles: managers },
  { key: "team", path: "team", roles: managers },
  { key: "landingPages", path: "landing-pages", roles: managers },
  { key: "analytics", path: "analytics", roles: managers },
  // Integrations: tracking pixels and connected apps
  { key: "pixels", path: "integrations/pixels", roles: managers },
  { key: "apps", path: "integrations/apps", roles: managers },
  { key: "plans", path: "plans", roles: ["owner"] },
  // Balance: the store's credits (paid services such as WhatsApp messages)
  { key: "balance", path: "balance", roles: ["owner"] },
  { key: "settings", path: "settings", roles: managers },
  { key: "profile", path: "profile", roles: managers },
] as const satisfies readonly { key: string; path: string; roles: readonly MemberRole[] }[];

export type SectionKey = (typeof sections)[number]["key"];

// The sidebar (Zimam's layout): the overview, then four labelled groups — selling, growing, the storefront, the account.
// An entry is one page, or a page with sub-pages (shown under it in the sidebar and as tabs above its pages).
type NavEntry = { key: SectionKey; children?: readonly SectionKey[] };
export const navGroups = [
  { key: "main", items: [{ key: "overview" }] },
  {
    key: "sell",
    items: [{ key: "products" }, { key: "orders" }, { key: "scan" }, { key: "delivery", children: ["delivery", "manifest", "deliverySettings"] }, { key: "channels" }, { key: "callCenters" }],
  },
  { key: "grow", items: [{ key: "landingPages" }, { key: "analytics" }, { key: "pixels" }, { key: "apps" }] },
  { key: "storefront", items: [{ key: "storeDesign" }, { key: "themes" }, { key: "settings" }] },
  { key: "account", items: [{ key: "team" }, { key: "plans" }, { key: "balance" }, { key: "profile" }] },
] as const satisfies readonly { key: string; items: readonly NavEntry[] }[];

export type NavGroupKey = (typeof navGroups)[number]["key"];

// Tabs above an entry's pages when their order differs from the sidebar's (Zimam's Delivery: General settings first)
export const tabOrder: Partial<Record<string, readonly SectionKey[]>> = { delivery: ["deliverySettings", "delivery", "manifest"] };

export function canAccess(role: MemberRole, key: SectionKey) {
  return (sections.find((s) => s.key === key)?.roles as readonly MemberRole[] | undefined)?.includes(role) ?? false;
}

export function sectionsFor(role: MemberRole) {
  return sections.filter((s) => (s.roles as readonly MemberRole[]).includes(role));
}

// The sidebar of a member: the groups and entries with at least one page they may open
// `scanner` false (Apps → Parcel scanner off) hides Scan
export function navFor(role: MemberRole, apps: { scanner: boolean } = { scanner: true }) {
  return navGroups
    .map((g) => ({
      key: g.key as NavGroupKey,
      items: (g.items as readonly NavEntry[])
        .filter((e) => apps.scanner || e.key !== "scan")
        .map((e) => ({ key: e.key, children: (e.children ?? []).filter((k) => canAccess(role, k)) }))
        .filter((e) => canAccess(role, e.key) || e.children.length > 0),
    }))
    .filter((g) => g.items.length > 0);
}

// The sidebar entry a page belongs to (an entry's own page, or one of its sub-pages)
export const entryOf = (key: SectionKey) =>
  navGroups.flatMap((g) => g.items as readonly NavEntry[]).find((e) => e.key === key || e.children?.includes(key))?.key ?? null;

// Where a member lands after signing in.
export function homeSection(role: MemberRole) {
  return sectionsFor(role)[0];
}

export function sectionHref(locale: string, key: SectionKey) {
  const path = sections.find((s) => s.key === key)!.path;
  return `/${locale}/dashboard${path ? `/${path}` : ""}`;
}
