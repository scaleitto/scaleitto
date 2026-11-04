// The store builder (Zimam's Design page): every store page is a list of sections the merchant adds, orders, hides and
// edits; the home page plus custom pages (`/store/<slug>/pages/<handle>`). The builder edits a draft (`design.draft`)
// that visitors see only once published (`design.pages`); every publish keeps a copy in `design_versions` (History).
// The header, announcement bar, navigation, footer and the theme panel are global: they apply at once.
// Pure: used by the server, the store and the builder. Saved JSON is always read through these functions.
import { policyKinds } from "@/lib/enums";

export const storeSectionTypes = ["hero", "products", "collections", "badges", "steps", "text", "imageText", "faq", "video", "spacer"] as const;
export type StoreSectionType = (typeof storeSectionTypes)[number];
export const heroVariants = ["split", "full", "card", "minimal"] as const;

type Base = { id: string; hidden: boolean };
export type HeroSection = Base & { type: "hero"; image: string; title: string; subtitle: string; buttonText: string; variant: "" | (typeof heroVariants)[number] };
export type ProductsSection = Base & { type: "products"; title: string; collectionId: string; limit: number; columns: 0 | 2 | 3 | 4 };
export type CollectionsSection = Base & { type: "collections"; title: string };
export type BadgesSection = Base & { type: "badges" };
export type StepsSection = Base & { type: "steps" };
export type TextSection = Base & { type: "text"; title: string; body: string; align: "start" | "center" };
export type ImageTextSection = Base & { type: "imageText"; image: string; title: string; body: string; buttonText: string; buttonHref: string; side: "start" | "end" };
export type FaqSection = Base & { type: "faq"; title: string; items: { q: string; a: string }[] };
export type VideoSection = Base & { type: "video"; title: string; url: string };
export type SpacerSection = Base & { type: "spacer"; size: "sm" | "md" | "lg" };
export type StoreSection = HeroSection | ProductsSection | CollectionsSection | BadgesSection | StepsSection | TextSection | ImageTextSection | FaqSection | VideoSection | SpacerSection;

export type CustomPage = { id: string; title: string; handle: string; sections: StoreSection[] };
export type StorePages = { home: StoreSection[]; custom: CustomPage[] };

// Navigation targets: home, the products on the home page, a custom page, a collection, a policy page or an https link
export type NavLink = { id: string; label: string; target: string };

export const MAX_SECTIONS = 30;
export const MAX_PAGES = 20;
export const MAX_LINKS = 8;
export const MAX_FAQ = 12;

const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => ((list as readonly unknown[]).includes(v) ? (v as T) : fallback);
// Our uploads, or an https link
export const safeImage = (v: unknown) => {
  const s = str(v, 500);
  return /^\/uploads\/[\w-]+\/[\w.-]+$/.test(s) || /^https:\/\/\S+$/.test(s) ? s : "";
};
// A link a button may open: a store path or an https address
export const safeHref = (v: unknown) => {
  const s = str(v, 300);
  return /^\/[\w\-./?=&#%]*$/.test(s) || /^#[\w-]*$/.test(s) || /^https:\/\/\S+$/.test(s) ? s : "";
};
export const pageHandle = (v: string) =>
  v
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

let counter = 0;
export const newId = (prefix = "s") => `${prefix}-${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// A new section with sensible defaults (texts in the store's language come from the builder)
export function newSection(type: StoreSectionType, texts: Partial<Record<"title" | "subtitle" | "button" | "body", string>> = {}): StoreSection {
  const base = { id: newId(), hidden: false };
  switch (type) {
    case "hero":
      return { ...base, type, image: "", title: texts.title ?? "", subtitle: texts.subtitle ?? "", buttonText: texts.button ?? "", variant: "" };
    case "products":
      return { ...base, type, title: texts.title ?? "", collectionId: "", limit: 0, columns: 0 };
    case "collections":
      return { ...base, type, title: "" };
    case "text":
      return { ...base, type, title: texts.title ?? "", body: texts.body ?? "", align: "center" };
    case "imageText":
      return { ...base, type, image: "", title: texts.title ?? "", body: texts.body ?? "", buttonText: "", buttonHref: "", side: "start" };
    case "faq":
      return { ...base, type, title: texts.title ?? "", items: [{ q: "", a: "" }] };
    case "video":
      return { ...base, type, title: "", url: "" };
    case "spacer":
      return { ...base, type, size: "md" };
    default:
      return { ...base, type };
  }
}

export function sanitizeSection(raw: unknown): StoreSection | null {
  const s = obj(raw);
  const type = s.type as StoreSectionType;
  if (!(storeSectionTypes as readonly string[]).includes(type)) return null;
  const base = { id: str(s.id, 40) || newId(), hidden: s.hidden === true };
  switch (type) {
    case "hero":
      return { ...base, type, image: safeImage(s.image), title: str(s.title, 120), subtitle: str(s.subtitle, 300), buttonText: str(s.buttonText, 40), variant: oneOf(["", ...heroVariants], s.variant, "") };
    case "products": {
      const limit = Number(s.limit);
      const columns = Number(s.columns);
      return { ...base, type, title: str(s.title, 80), collectionId: str(s.collectionId, 40), limit: Number.isInteger(limit) && limit > 0 ? Math.min(limit, 48) : 0, columns: ([2, 3, 4] as const).find((c) => c === columns) ?? 0 };
    }
    case "collections":
      return { ...base, type, title: str(s.title, 80) };
    case "text":
      return { ...base, type, title: str(s.title, 120), body: str(s.body, 2000), align: oneOf(["start", "center"], s.align, "center") };
    case "imageText":
      return { ...base, type, image: safeImage(s.image), title: str(s.title, 120), body: str(s.body, 1000), buttonText: str(s.buttonText, 40), buttonHref: safeHref(s.buttonHref), side: oneOf(["start", "end"], s.side, "start") };
    case "faq":
      return { ...base, type, title: str(s.title, 120), items: (Array.isArray(s.items) ? s.items : []).slice(0, MAX_FAQ).map((i) => ({ q: str(obj(i).q, 200), a: str(obj(i).a, 1000) })) };
    case "video":
      return { ...base, type, title: str(s.title, 120), url: /^https:\/\/\S+$/.test(str(s.url, 300)) ? str(s.url, 300) : "" };
    case "spacer":
      return { ...base, type, size: oneOf(["sm", "md", "lg"], s.size, "md") };
    default:
      return { ...base, type };
  }
}

export function sanitizeSections(raw: unknown): StoreSection[] {
  const ids = new Set<string>();
  return (Array.isArray(raw) ? raw : [])
    .slice(0, MAX_SECTIONS)
    .map(sanitizeSection)
    .filter((s): s is StoreSection => {
      if (!s || ids.has(s.id)) return false;
      ids.add(s.id);
      return true;
    });
}

export function sanitizePages(raw: unknown, legacy: StoreSection[]): StorePages {
  const r = obj(raw);
  const handles = new Set<string>();
  const custom = (Array.isArray(r.custom) ? r.custom : []).slice(0, MAX_PAGES).flatMap((p): CustomPage[] => {
    const x = obj(p);
    const title = str(x.title, 80);
    let handle = pageHandle(str(x.handle, 60)) || pageHandle(title) || "page";
    while (handles.has(handle)) handle = `${handle}-2`;
    handles.add(handle);
    return [{ id: str(x.id, 40) || newId("p"), title: title || handle, handle, sections: sanitizeSections(x.sections) }];
  });
  return { home: Array.isArray(r.home) ? sanitizeSections(r.home) : legacy, custom };
}

// Stores designed before the builder: their fixed home page as sections (banner, perks, collections, products, steps)
export function legacyHome(d: { hero?: unknown; productsTitle?: unknown; showBadges?: unknown; showOrderSteps?: unknown }): StoreSection[] {
  const hero = obj(d.hero);
  const out: StoreSection[] = [];
  if (hero.enabled === true || str(hero.title, 120) || safeImage(hero.image))
    out.push({ id: "hero", hidden: hero.enabled !== true, type: "hero", image: safeImage(hero.image), title: str(hero.title, 120), subtitle: str(hero.subtitle, 300), buttonText: str(hero.buttonText, 40), variant: "" });
  out.push({ id: "badges", hidden: d.showBadges === false, type: "badges" });
  out.push({ id: "collections", hidden: false, type: "collections", title: "" });
  out.push({ id: "products", hidden: false, type: "products", title: str(d.productsTitle, 80), collectionId: "", limit: 0, columns: 0 });
  const steps = typeof d.showOrderSteps === "boolean" ? d.showOrderSteps : d.showBadges !== false;
  out.push({ id: "steps", hidden: !steps, type: "steps" });
  return out;
}

export function sanitizeLinks(raw: unknown): NavLink[] {
  return (Array.isArray(raw) ? raw : []).slice(0, MAX_LINKS).flatMap((l) => {
    const x = obj(l);
    const target = navTarget(x.target);
    const label = str(x.label, 40);
    return target && label ? [{ id: str(x.id, 40) || newId("l"), label, target }] : [];
  });
}

export function navTarget(v: unknown): string {
  const s = str(v, 300);
  if (s === "home" || s === "products") return s;
  if (/^page:[a-z0-9-]{1,60}$/.test(s) || /^collection:[\w-]{1,120}$/.test(s)) return s;
  if (/^policy:/.test(s) && (policyKinds as readonly string[]).includes(s.slice(7))) return s;
  if (/^url:https:\/\/\S+$/.test(s)) return s;
  return "";
}

// Where a navigation link goes on the store (base = "/store/<slug>" or "" on a custom domain)
export function navHref(target: string, base: string) {
  const home = base || "/";
  if (target === "home") return home;
  if (target === "products") return `${base}/#products`;
  if (target.startsWith("page:")) return `${base}/pages/${target.slice(5)}`;
  if (target.startsWith("collection:")) return `${base}/collections/${target.slice(11)}`;
  if (target.startsWith("policy:")) return `${base}/policies/${target.slice(7)}`;
  if (target.startsWith("url:")) return target.slice(4);
  return home;
}

export const samePages = (a: StorePages, b: StorePages) => JSON.stringify(a) === JSON.stringify(b);
