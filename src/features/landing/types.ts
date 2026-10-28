// Landing pages: a list of sections + order form settings, stored as JSON on landing_pages.
// Everything coming from the editor or the AI goes through sanitizeSections / resolveForm,
// so a page can never contain unknown section types, script URLs or broken data.
import { isBenefitIcon } from "./icons";

export const sectionTypes = ["poster", "marquee", "hero", "badges", "text", "imageText", "benefits", "image", "gallery", "features", "steps", "faq", "reviews", "video", "countdown", "cta", "form"] as const;
// What a poster section is about (the AI designs one marketing image per section)
export const posterKinds = ["hero", "problem", "solution", "benefits", "features", "howto", "beforeAfter", "details", "offer", "cta"] as const;
export type PosterKind = (typeof posterKinds)[number];
export const MAX_POSTER_HISTORY = 3;
export type SectionType = (typeof sectionTypes)[number];

type Base = { id: string; hidden?: boolean };
export type LandingSection = Base &
  (
    // A full-width marketing image with its text designed into it (AI-made or the merchant's own).
    // The texts are kept so the image can be regenerated; previous = earlier images (newest first) to restore.
    | { type: "poster"; image: string; kind: PosterKind; angle?: string; headline: string; subtitle?: string; bullets: string[]; cta?: string; scene?: string; previous: string[] }
    // A thin scrolling band of short selling points ("Cash on delivery → Fast delivery → …")
    | { type: "marquee"; items: string[] }
    | { type: "hero"; title: string; subtitle?: string; image?: string; badge?: string }
    | { type: "badges"; items: string[] }
    | { type: "text"; title?: string; body: string }
    // A photo beside a short title + paragraph (sides alternate down the page)
    | { type: "imageText"; title: string; body: string; image?: string }
    // Benefit cards: an icon name from icons.ts (older pages: an emoji), short title, one sentence
    | { type: "benefits"; title?: string; items: { icon: string; title: string; text: string }[] }
    | { type: "image"; url: string; caption?: string }
    | { type: "gallery"; title?: string; images: string[] }
    | { type: "features"; title?: string; items: string[] }
    | { type: "steps"; title?: string; items: string[] }
    | { type: "faq"; title?: string; items: { q: string; a: string }[] }
    // Real reviews only, added by the merchant (the AI never writes reviews)
    | { type: "reviews"; title?: string; items: { name: string; text: string; rating: number }[] }
    | { type: "video"; url: string }
    // Counts down to a real end date chosen by the merchant
    | { type: "countdown"; title?: string; endsAt: string }
    | { type: "cta"; title: string; subtitle?: string }
    // Where the order form goes (when absent, right after the hero)
    | { type: "form" }
  );

export type CustomField = { id: string; label: string; type: "text" | "select"; options: string[]; required: boolean };

// Customization of the order form, limited to choices that keep it clean and trustworthy.
export type FormSettings = {
  title: string;
  subtitle: string;
  buttonText: string;
  layout: "stacked" | "compact";
  address: "hidden" | "optional" | "required";
  note: boolean;
  delivery: "both" | "home" | "office";
  showSummary: boolean;
  showOffers: boolean;
  custom: CustomField[];
  thankYou: string;
  stickyButton: boolean;
};

export const defaultForm: FormSettings = {
  title: "",
  subtitle: "",
  buttonText: "",
  layout: "compact",
  address: "optional",
  note: true,
  delivery: "both",
  showSummary: true,
  showOffers: true,
  custom: [],
  thankYou: "",
  stickyButton: true,
};

export const MAX_SECTIONS = 40;
export const MAX_CUSTOM_FIELDS = 4;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const opt = (v: unknown, max: number) => str(v, max) || undefined;
const list = (v: unknown, maxItems: number, maxLen: number) => (Array.isArray(v) ? v.map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems) : []);
// Our uploads or https images only
export const isSafeImage = (v: unknown): v is string => typeof v === "string" && /^(\/uploads\/[\w-]+\/[\w.-]+|https:\/\/[^\s"'<>]+)$/.test(v) && v.length <= 500;
const image = (v: unknown) => (isSafeImage(v) ? v : undefined);

// YouTube link → embeddable URL (other video sites are not accepted)
export function youtubeEmbed(url: string): string | null {
  const m = url.match(/^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
}

let counter = 0;
export const newSectionId = () => `s${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Untrusted sections (editor, AI) → valid sections. Invalid ones are dropped.
export function sanitizeSections(input: unknown): LandingSection[] {
  if (!Array.isArray(input)) return [];
  const out: LandingSection[] = [];
  let hasForm = false;
  for (const raw of input.slice(0, MAX_SECTIONS * 2)) {
    if (!raw || typeof raw !== "object") continue;
    const s = raw as Record<string, unknown>;
    const id = typeof s.id === "string" && /^[\w-]{1,40}$/.test(s.id) ? s.id : newSectionId();
    const base = { id, ...(s.hidden === true ? { hidden: true } : {}) };
    let section: LandingSection | null = null;
    switch (s.type) {
      case "poster": {
        // An empty image is a section still being designed (or waiting for the merchant's upload)
        const img = image(s.image) ?? "";
        const headline = str(s.headline, 160);
        if (img || headline)
          section = {
            ...base,
            type: "poster",
            image: img,
            kind: oneOf(s.kind, posterKinds, "details"),
            angle: opt(s.angle, 120),
            headline,
            subtitle: opt(s.subtitle, 240),
            bullets: list(s.bullets, 5, 80),
            cta: opt(s.cta, 60),
            scene: opt(s.scene, 600),
            previous: (Array.isArray(s.previous) ? s.previous : []).filter(isSafeImage).slice(0, MAX_POSTER_HISTORY),
          };
        break;
      }
      case "marquee": {
        const items = list(s.items, 6, 50);
        if (items.length) section = { ...base, type: "marquee", items };
        break;
      }
      case "hero": {
        const title = str(s.title, 200);
        if (title || image(s.image)) section = { ...base, type: "hero", title, subtitle: opt(s.subtitle, 400), image: image(s.image), badge: opt(s.badge, 40) };
        break;
      }
      case "badges": {
        const items = list(s.items, 6, 60);
        if (items.length) section = { ...base, type: "badges", items };
        break;
      }
      case "text": {
        const body = str(s.body, 3000);
        if (body) section = { ...base, type: "text", title: opt(s.title, 200), body };
        break;
      }
      case "imageText": {
        const title = str(s.title, 200);
        const body = str(s.body, 2000);
        if (title || body) section = { ...base, type: "imageText", title, body, image: image(s.image) };
        break;
      }
      case "benefits": {
        const items = (Array.isArray(s.items) ? s.items : [])
          .map((x) => {
            const r = (x ?? {}) as Record<string, unknown>;
            // An icon name (icons.ts), or one emoji on older pages
            const icon = str(r.icon, 16);
            return { icon: isBenefitIcon(icon) ? icon : [...icon].slice(0, 2).join("") || "check", title: str(r.title, 120), text: str(r.text, 400) };
          })
          .filter((x) => x.title)
          .slice(0, 9);
        if (items.length) section = { ...base, type: "benefits", title: opt(s.title, 200), items };
        break;
      }
      case "image":
        if (image(s.url)) section = { ...base, type: "image", url: s.url as string, caption: opt(s.caption, 200) };
        break;
      case "gallery": {
        const images = (Array.isArray(s.images) ? s.images : []).filter(isSafeImage).slice(0, 12);
        if (images.length) section = { ...base, type: "gallery", title: opt(s.title, 200), images };
        break;
      }
      case "features":
      case "steps": {
        const items = list(s.items, 12, 300);
        if (items.length) section = { ...base, type: s.type, title: opt(s.title, 200), items };
        break;
      }
      case "faq": {
        const items = (Array.isArray(s.items) ? s.items : [])
          .map((x) => ({ q: str((x as Record<string, unknown>)?.q, 300), a: str((x as Record<string, unknown>)?.a, 1500) }))
          .filter((x) => x.q && x.a)
          .slice(0, 15);
        if (items.length) section = { ...base, type: "faq", title: opt(s.title, 200), items };
        break;
      }
      case "reviews": {
        const items = (Array.isArray(s.items) ? s.items : [])
          .map((x) => {
            const r = x as Record<string, unknown>;
            return { name: str(r?.name, 80), text: str(r?.text, 800), rating: Math.min(5, Math.max(1, Math.round(Number(r?.rating) || 5))) };
          })
          .filter((x) => x.name && x.text)
          .slice(0, 20);
        if (items.length) section = { ...base, type: "reviews", title: opt(s.title, 200), items };
        break;
      }
      case "video": {
        const url = typeof s.url === "string" ? s.url.trim() : "";
        if (youtubeEmbed(url)) section = { ...base, type: "video", url };
        break;
      }
      case "countdown": {
        const endsAt = typeof s.endsAt === "string" && !Number.isNaN(Date.parse(s.endsAt)) ? new Date(s.endsAt).toISOString() : "";
        if (endsAt) section = { ...base, type: "countdown", title: opt(s.title, 200), endsAt };
        break;
      }
      case "cta": {
        const title = str(s.title, 200);
        if (title) section = { ...base, type: "cta", title, subtitle: opt(s.subtitle, 400) };
        break;
      }
      case "form":
        if (!hasForm) {
          hasForm = true;
          section = { ...base, type: "form" };
        }
        break;
    }
    if (section) out.push(section);
    if (out.length >= MAX_SECTIONS) break;
  }
  return out;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

// Saved/untrusted form settings → complete, valid settings.
export function resolveForm(input: unknown): FormSettings {
  const f = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const custom = (Array.isArray(f.custom) ? f.custom : [])
    .map((x): CustomField | null => {
      const c = x as Record<string, unknown>;
      const label = str(c?.label, 60);
      if (!label) return null;
      const type = oneOf(c?.type, ["text", "select"] as const, "text");
      const options = type === "select" ? [...new Set(list(c?.options, 10, 60))] : [];
      if (type === "select" && options.length < 2) return null;
      return { id: typeof c?.id === "string" && /^[\w-]{1,40}$/.test(c.id) ? c.id : newSectionId(), label, type, options, required: c?.required === true };
    })
    .filter((x): x is CustomField => x !== null)
    .slice(0, MAX_CUSTOM_FIELDS);
  return {
    title: str(f.title, 120),
    subtitle: str(f.subtitle, 300),
    buttonText: str(f.buttonText, 60),
    layout: oneOf(f.layout, ["stacked", "compact"] as const, defaultForm.layout),
    address: oneOf(f.address, ["hidden", "optional", "required"] as const, defaultForm.address),
    note: bool(f.note, defaultForm.note),
    delivery: oneOf(f.delivery, ["both", "home", "office"] as const, defaultForm.delivery),
    showSummary: bool(f.showSummary, defaultForm.showSummary),
    showOffers: bool(f.showOffers, defaultForm.showOffers),
    custom,
    thankYou: str(f.thankYou, 500),
    stickyButton: bool(f.stickyButton, defaultForm.stickyButton),
  };
}

// Page languages: "dz" is Algerian Darija (Arabic script) — shown with the Arabic interface.
export const pageLanguages = ["ar", "dz", "fr", "en"] as const;
export type PageLanguage = (typeof pageLanguages)[number];
export const interfaceLocale = (lang: PageLanguage) => (lang === "dz" ? "ar" : lang);

// The AI writes for customers in the store's language (ar / fr / en)
export const storeLanguage = (locale: string): PageLanguage => (locale === "fr" || locale === "en" ? locale : "ar");
