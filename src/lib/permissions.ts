import type { MemberRole } from "@/server/db/schema";

const all = ["owner", "manager", "agent"] as const;
const managers = ["owner", "manager"] as const;

// The dashboard pages and who may open them. Single source of truth for the sidebar, the sub-section tabs and the
// server-side page guards (requireSection). The sidebar groups some of them (navGroups below).
export const sections = [
  { key: "overview", path: "", roles: managers },
  { key: "products", path: "products", roles: managers },
  { key: "inventory", path: "inventory", roles: managers },
  // Orders: the list, then the parcel's life (ship → track → returns), abandoned carts, protection, analysis
  { key: "orders", path: "orders", roles: all },
  { key: "shipping", path: "orders/shipping", roles: all },
  { key: "tracking", path: "orders/tracking", roles: all },
  { key: "returns", path: "orders/returns", roles: all },
  { key: "abandoned", path: "orders/abandoned", roles: all },
  { key: "protection", path: "orders/protection", roles: managers },
  { key: "orderInsights", path: "orders/insights", roles: managers },
  { key: "delivery", path: "delivery", roles: managers },
  { key: "finance", path: "finance", roles: ["owner"] },
  // Store design: the look, the themes, the order form
  { key: "storeDesign", path: "store-design", roles: managers },
  { key: "themes", path: "store-design/themes", roles: managers },
  { key: "orderForm", path: "store-design/order-form", roles: managers },
  { key: "callCenters", path: "call-centers", roles: all },
  { key: "landingPages", path: "landing-pages", roles: managers },
  { key: "analytics", path: "analytics", roles: managers },
  // Integrations: tracking pixels and connected apps
  { key: "pixels", path: "integrations/pixels", roles: managers },
  { key: "apps", path: "integrations/apps", roles: managers },
  { key: "plans", path: "plans", roles: ["owner"] },
  { key: "settings", path: "settings", roles: managers },
  { key: "profile", path: "profile", roles: all },
] as const satisfies readonly { key: string; path: string; roles: readonly MemberRole[] }[];

export type SectionKey = (typeof sections)[number]["key"];

// The sidebar, in the owner's order: a group is one entry whose pages show as sub-sections (under it in the
// sidebar and as tabs on its pages). A single-page entry has the page's own key.
export const navGroups = [
  { key: "overview", children: ["overview"] },
  { key: "products", children: ["products"] },
  { key: "inventory", children: ["inventory"] },
  { key: "orders", children: ["orders", "shipping", "tracking", "returns", "abandoned", "protection", "orderInsights"] },
  { key: "delivery", children: ["delivery"] },
  { key: "finance", children: ["finance"] },
  { key: "storeDesign", children: ["storeDesign", "themes", "orderForm"] },
  { key: "callCenters", children: ["callCenters"] },
  { key: "landingPages", children: ["landingPages"] },
  { key: "analytics", children: ["analytics"] },
  { key: "integrations", children: ["pixels", "apps"] },
  { key: "plans", children: ["plans"] },
  { key: "settings", children: ["settings"] },
  { key: "profile", children: ["profile"] },
] as const satisfies readonly { key: string; children: readonly SectionKey[] }[];

export type NavGroupKey = (typeof navGroups)[number]["key"];

export function canAccess(role: MemberRole, key: SectionKey) {
  return (sections.find((s) => s.key === key)?.roles as readonly MemberRole[] | undefined)?.includes(role) ?? false;
}

export function sectionsFor(role: MemberRole) {
  return sections.filter((s) => (s.roles as readonly MemberRole[]).includes(role));
}

// The sidebar of a member: groups with at least one page they may open, and those pages
export function navFor(role: MemberRole) {
  return navGroups
    .map((g) => ({ key: g.key as NavGroupKey, children: (g.children as readonly SectionKey[]).filter((k) => canAccess(role, k)) }))
    .filter((g) => g.children.length > 0);
}

// The sidebar group a page belongs to
export const groupOf = (key: SectionKey) => navGroups.find((g) => (g.children as readonly SectionKey[]).includes(key))!.key as NavGroupKey;

// Where a member lands after signing in.
export function homeSection(role: MemberRole) {
  return sectionsFor(role)[0];
}

export function sectionHref(locale: string, key: SectionKey) {
  const path = sections.find((s) => s.key === key)!.path;
  return `/${locale}/dashboard${path ? `/${path}` : ""}`;
}
