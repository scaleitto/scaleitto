import type { MemberRole } from "@/server/db/schema";

// The dashboard sections, in sidebar order, and who may open them.
// Single source of truth for both the sidebar and the server-side page guards.
export const sections = [
  { key: "overview", path: "", roles: ["owner", "manager"] },
  { key: "products", path: "products", roles: ["owner", "manager"] },
  { key: "orders", path: "orders", roles: ["owner", "manager", "agent"] },
  { key: "delivery", path: "delivery", roles: ["owner", "manager"] },
  { key: "storeDesign", path: "store-design", roles: ["owner", "manager"] },
  { key: "themes", path: "themes", roles: ["owner", "manager"] },
  { key: "callCenters", path: "call-centers", roles: ["owner", "manager", "agent"] },
  { key: "landingPages", path: "landing-pages", roles: ["owner", "manager"] },
  { key: "orderForm", path: "order-form", roles: ["owner", "manager"] },
  { key: "analytics", path: "analytics", roles: ["owner", "manager"] },
  { key: "pixels", path: "pixels", roles: ["owner", "manager"] },
  { key: "apps", path: "apps", roles: ["owner", "manager"] },
  { key: "plans", path: "plans", roles: ["owner"] },
  { key: "settings", path: "settings", roles: ["owner", "manager"] },
  { key: "profile", path: "profile", roles: ["owner", "manager", "agent"] },
] as const satisfies readonly { key: string; path: string; roles: readonly MemberRole[] }[];

export type SectionKey = (typeof sections)[number]["key"];

export function canAccess(role: MemberRole, key: SectionKey) {
  return (sections.find((s) => s.key === key)?.roles as readonly MemberRole[] | undefined)?.includes(role) ?? false;
}

export function sectionsFor(role: MemberRole) {
  return sections.filter((s) => (s.roles as readonly MemberRole[]).includes(role));
}

// Where a member lands after signing in.
export function homeSection(role: MemberRole) {
  return sectionsFor(role)[0];
}

export function sectionHref(locale: string, key: SectionKey) {
  const path = sections.find((s) => s.key === key)!.path;
  return `/${locale}/dashboard${path ? `/${path}` : ""}`;
}
