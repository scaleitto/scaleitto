// Landing pages (Zimam's builder): a page is a list of components, in up to three versions (A, B, C) shown to
// visitors in turn. Everything coming from the editor or the AI goes through sanitizeSections / resolveForm, so a
// page can never contain unknown components, script URLs or broken data.

// The builder's components, in the palette's order
export const sectionTypes = ["image", "text", "form", "sticky", "thankYou", "countdown", "reviews", "badges", "faq", "spacer", "bullets", "video", "announcement"] as const;
export type SectionType = (typeof sectionTypes)[number];
export const imageFits = ["natural", "cover", "contain"] as const;
export const textAligns = ["start", "center"] as const;
export const textSizes = ["sm", "md", "lg"] as const;
export const bulletStyles = ["check", "dot", "number"] as const;
// Trust badge icons (lucide names drawn by blocks.tsx)
export const badgeIcons = ["truck", "banknote", "phone", "shield", "refresh", "clock", "star", "check"] as const;
export type BadgeIcon = (typeof badgeIcons)[number];
export const MAX_POSTER_HISTORY = 3;

// What an AI-designed image says, kept so it can be drawn again ("draw again" in the image's settings).
// previous = earlier images (newest first) to restore.
export type PosterInfo = { headline: string; subtitle?: string; bullets: string[]; scene: string; previous: string[] };

type Base = { id: string; hidden?: boolean };
export type LandingSection = Base &
  (
    // A full-width image (the merchant's or one designed by the AI with its text inside); no url = placeholder
    | { type: "image"; url: string; fit: (typeof imageFits)[number]; margin: number; borderWidth: number; radius: number; borderColor: string; poster?: PosterInfo }
    | { type: "text"; title?: string; body: string; align: (typeof textAligns)[number]; size: (typeof textSizes)[number] }
    // Where the order form goes
    | { type: "form" }
    // A button fixed at the bottom of the screen that leads to the form
    | { type: "sticky"; label: string }
    // A window shown after ordering, instead of leaving the page
    | { type: "thankYou"; title: string; message: string }
    // Counts down to a real end date chosen by the merchant
    | { type: "countdown"; title?: string; endsAt: string }
    // Real reviews only, added by the merchant (the AI never writes reviews)
    | { type: "reviews"; title?: string; items: { name: string; text: string; rating: number }[] }
    | { type: "badges"; items: { icon: BadgeIcon; text: string }[] }
    | { type: "faq"; title?: string; items: { q: string; a: string }[] }
    // Empty space (pixels) with or without a thin line
    | { type: "spacer"; size: number; line: boolean }
    | { type: "bullets"; title?: string; items: string[]; style: (typeof bulletStyles)[number] }
    | { type: "video"; url: string }
    // A colored band with a short message, still or scrolling
    | { type: "announcement"; text: string; scrolling: boolean }
  );

// A page's versions: A is the page itself, B and C are alternatives (paused ones are not shown to visitors)
export const versionKeys = ["A", "B", "C"] as const;
export type VersionKey = (typeof versionKeys)[number];
export type PageVariant = { key: Exclude<VersionKey, "A">; sections: LandingSection[]; paused: boolean };

// Extra questions of the order form (answers saved in orders.extra). checkbox = one box to tick (e.g. accept the terms).
export const customFieldTypes = ["text", "textarea", "number", "email", "date", "select", "radio", "checkbox"] as const;
export type CustomFieldType = (typeof customFieldTypes)[number];
export const choiceTypes: readonly CustomFieldType[] = ["select", "radio"];
export type CustomField = { id: string; label: string; type: CustomFieldType; options: string[]; required: boolean };

// Decorative blocks between the fields ("el:<id>" in the order): a heading, a short text, an image, a separator,
// the store's trust badges, or a highlighted notice
export const formBlockKinds = ["heading", "text", "image", "divider", "badges", "notice"] as const;
export type FormBlock = { id: string; kind: (typeof formBlockKinds)[number]; text: string; image: string };
export const MAX_FORM_BLOCKS = 6;

// An answer the field accepts (checked again on the server for every order)
export function customFieldValid(c: Pick<CustomField, "type" | "options">, value: string) {
  switch (c.type) {
    case "select":
    case "radio":
      return c.options.includes(value);
    case "number":
      return /^-?\d+([.,]\d+)?$/.test(value);
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(value);
    default:
      return true;
  }
}

// The order form's elements, in their default order. Custom fields are "custom:<id>" entries in `order`.
export const formElements = ["variants", "quantity", "name", "phone", "wilaya", "commune", "delivery", "address", "note", "summary"] as const;
export type FormElement = (typeof formElements)[number];
// Fields whose label and placeholder the merchant can rewrite
export const textFields = ["name", "phone", "wilaya", "commune", "address", "note"] as const;
export type TextField = (typeof textFields)[number];
export const formAppearances = ["direct", "popup", "drawer"] as const;
export const buttonEffects = ["none", "pulse", "shake"] as const;

// Customization of the order form (the store's default form on shops.order_form, and each landing page's own),
// limited to choices that keep it clean and trustworthy.
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
  // Element order (every built-in element once + "custom:<id>")
  order: string[];
  // Rewritten labels / placeholders ("" = the default text)
  labels: Partial<Record<TextField, { label: string; placeholder: string }>>;
  // An icon at the start of each field
  icons: boolean;
  showQuantity: boolean;
  // Shown in the page, or behind an order button in a popup / a side drawer
  appearance: (typeof formAppearances)[number];
  buttonEffect: (typeof buttonEffects)[number];
  // Delivery choice labels ("" = default) and which one is chosen first
  homeLabel: string;
  officeLabel: string;
  preferDelivery: "home" | "office";
  // A second button that sends the order to the store's WhatsApp
  whatsapp: boolean;
  blocks: FormBlock[];
  // Two steps: the name and phone first, then the rest
  stepper: boolean;
  // Store settings → Checkout (Zimam): the buyer's name and commune can be hidden, optional or required
  name: FieldRule;
  commune: FieldRule;
  // Zimam: the wilaya can be optional, never hidden (an order without one is priced later by the team)
  wilaya: "optional" | "required";
  // Store settings → Product page: options always as buttons (else long lists become a dropdown)
  optionButtons: boolean;
};
export type FieldRule = "hidden" | "optional" | "required";
export const fieldRules = ["hidden", "optional", "required"] as const;

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
  order: [...formElements],
  labels: {},
  icons: true,
  showQuantity: true,
  appearance: "direct",
  buttonEffect: "none",
  homeLabel: "",
  officeLabel: "",
  preferDelivery: "home",
  whatsapp: false,
  blocks: [],
  stepper: false,
  name: "required",
  commune: "required",
  wilaya: "required",
  optionButtons: false,
};

// Every built-in element exactly once and every custom field once (new ones before the summary), in the saved order
function resolveOrder(input: unknown, custom: CustomField[], blocks: FormBlock[]): string[] {
  const wanted = [...formElements, ...custom.map((c) => `custom:${c.id}`), ...blocks.map((b) => `el:${b.id}`)];
  const out = [...new Set(Array.isArray(input) ? input.filter((k): k is string => typeof k === "string" && wanted.includes(k)) : [])];
  for (const k of wanted) {
    if (out.includes(k)) continue;
    const summary = out.indexOf("summary");
    if ((k.startsWith("custom:") || k.startsWith("el:")) && summary >= 0) out.splice(summary, 0, k);
    else out.push(k);
  }
  return out;
}

export const MAX_SECTIONS = 40;
export const MAX_CUSTOM_FIELDS = 8;

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

const num = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const hexColor = (v: unknown) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : "");

export function newImage(url = ""): Extract<LandingSection, { type: "image" }> {
  return { id: newSectionId(), type: "image", url, fit: "natural", margin: 0, borderWidth: 0, radius: 0, borderColor: "" };
}

function poster(v: unknown): PosterInfo | undefined {
  if (!v || typeof v !== "object") return undefined;
  const p = v as Record<string, unknown>;
  const headline = str(p.headline, 160);
  if (!headline) return undefined;
  return { headline, subtitle: opt(p.subtitle, 240), bullets: list(p.bullets, 5, 80), scene: str(p.scene, 600), previous: (Array.isArray(p.previous) ? p.previous : []).filter(isSafeImage).slice(0, MAX_POSTER_HISTORY) };
}

// Pages made before the Zimam builder used other blocks: each becomes the closest component(s)
function legacy(s: Record<string, unknown>, base: Base): LandingSection[] {
  const img = (url: unknown, info?: PosterInfo) => (isSafeImage(url) ? [{ ...newImage(url), ...base, ...(info ? { poster: info } : {}) }] : []);
  const text = (title: unknown, body: unknown): LandingSection[] => {
    const b = str(body, 3000);
    const t = opt(title, 200);
    return b || t ? [{ ...base, id: `${base.id}t`, type: "text", title: t, body: b, align: "center", size: "md" }] : [];
  };
  switch (s.type) {
    case "poster": {
      const info = poster({ ...s, previous: s.previous }) ?? undefined;
      return isSafeImage(s.image) ? img(s.image, info) : info ? [{ ...newImage(), ...base, poster: info }] : [];
    }
    case "marquee": {
      const items = list(s.items, 6, 50);
      return items.length ? [{ ...base, type: "announcement", text: items.join(" • "), scrolling: true }] : [];
    }
    case "hero":
      return [...img(s.image), ...text(s.title, s.subtitle)];
    case "imageText":
      return [...img(s.image), ...text(s.title, s.body)];
    case "gallery":
      return (Array.isArray(s.images) ? s.images : []).filter(isSafeImage).slice(0, 12).map((u, i) => ({ ...newImage(u), ...base, id: `${base.id}${i}` }));
    case "benefits":
    case "features":
    case "steps": {
      const items = s.type === "benefits" ? (Array.isArray(s.items) ? s.items : []).map((x) => str((x as Record<string, unknown>)?.title, 300)).filter(Boolean) : list(s.items, 12, 300);
      return items.length ? [{ ...base, type: "bullets", title: opt(s.title, 200), items: items.slice(0, 12), style: s.type === "steps" ? "number" : "check" }] : [];
    }
    default:
      return [];
  }
}

// Untrusted sections (editor, AI, older pages) → valid components. Invalid ones are dropped; one form, one sticky
// button and one thank-you window at most.
export function sanitizeSections(input: unknown): LandingSection[] {
  if (!Array.isArray(input)) return [];
  const out: LandingSection[] = [];
  const once = new Set<string>();
  for (const raw of input.slice(0, MAX_SECTIONS * 2)) {
    if (!raw || typeof raw !== "object") continue;
    const s = raw as Record<string, unknown>;
    const id = typeof s.id === "string" && /^[\w-]{1,40}$/.test(s.id) ? s.id : newSectionId();
    const base: Base = { id, ...(s.hidden === true ? { hidden: true } : {}) };
    const add: LandingSection[] = [];
    switch (s.type) {
      case "image": {
        // An empty image is a placeholder (or an AI image still being drawn): hidden on the public page
        const url = isSafeImage(s.url) ? s.url : "";
        add.push({
          ...base,
          type: "image",
          url,
          fit: oneOf(s.fit, imageFits, "natural"),
          margin: num(s.margin, 0, 120, 0),
          borderWidth: num(s.borderWidth, 0, 20, 0),
          radius: num(s.radius, 0, 60, 0),
          borderColor: hexColor(s.borderColor),
          ...(poster(s.poster) ? { poster: poster(s.poster) } : {}),
        });
        break;
      }
      case "text": {
        const body = str(s.body, 3000);
        const title = opt(s.title, 200);
        // Kept even empty while being written in the builder (an empty text shows nothing on the page)
        add.push({ ...base, type: "text", title, body, align: oneOf(s.align, textAligns, "center"), size: oneOf(s.size, textSizes, "md") });
        break;
      }
      case "form":
      case "sticky":
      case "thankYou": {
        if (once.has(s.type)) break;
        once.add(s.type);
        if (s.type === "form") add.push({ ...base, type: "form" });
        else if (s.type === "sticky") add.push({ ...base, type: "sticky", label: str(s.label, 60) });
        else add.push({ ...base, type: "thankYou", title: str(s.title, 120), message: str(s.message, 600) });
        break;
      }
      case "countdown": {
        const endsAt = typeof s.endsAt === "string" && !Number.isNaN(Date.parse(s.endsAt)) ? new Date(s.endsAt).toISOString() : "";
        if (endsAt) add.push({ ...base, type: "countdown", title: opt(s.title, 200), endsAt });
        break;
      }
      case "reviews": {
        const items = (Array.isArray(s.items) ? s.items : [])
          .map((x) => {
            const r = (x ?? {}) as Record<string, unknown>;
            return { name: str(r.name, 80), text: str(r.text, 800), rating: num(r.rating, 1, 5, 5) };
          })
          .filter((x) => x.name || x.text)
          .slice(0, 20);
        add.push({ ...base, type: "reviews", title: opt(s.title, 200), items });
        break;
      }
      case "badges": {
        // Older pages: a list of texts
        const items = (Array.isArray(s.items) ? s.items : [])
          .map((x) => (typeof x === "string" ? { icon: "check" as BadgeIcon, text: str(x, 60) } : { icon: oneOf((x as Record<string, unknown>)?.icon, badgeIcons, "check"), text: str((x as Record<string, unknown>)?.text, 60) }))
          .filter((x) => x.text)
          .slice(0, 6);
        add.push({ ...base, type: "badges", items });
        break;
      }
      case "faq": {
        const items = (Array.isArray(s.items) ? s.items : [])
          .map((x) => ({ q: str((x as Record<string, unknown>)?.q, 300), a: str((x as Record<string, unknown>)?.a, 1500) }))
          .filter((x) => x.q || x.a)
          .slice(0, 15);
        add.push({ ...base, type: "faq", title: opt(s.title, 200), items });
        break;
      }
      case "spacer": {
        // Older pages: sm / md / lg
        const size = s.size === "sm" ? 16 : s.size === "md" ? 40 : s.size === "lg" ? 80 : num(s.size, 4, 200, 32);
        add.push({ ...base, type: "spacer", size, line: s.line === true });
        break;
      }
      case "bullets": {
        add.push({ ...base, type: "bullets", title: opt(s.title, 200), items: list(s.items, 12, 300), style: oneOf(s.style, bulletStyles, "check") });
        break;
      }
      case "video": {
        const url = typeof s.url === "string" ? s.url.trim().slice(0, 300) : "";
        add.push({ ...base, type: "video", url: youtubeEmbed(url) ? url : "" });
        break;
      }
      case "announcement": {
        add.push({ ...base, type: "announcement", text: str(s.text, 160), scrolling: s.scrolling === true });
        break;
      }
      default:
        add.push(...legacy(s, base));
    }
    for (const x of add) if (out.length < MAX_SECTIONS && !out.some((o) => o.id === x.id)) out.push(x);
    if (out.length >= MAX_SECTIONS) break;
  }
  return out;
}

// The page's other versions (B, C) from untrusted data
export function sanitizeVariants(input: unknown): PageVariant[] {
  if (!Array.isArray(input)) return [];
  const out: PageVariant[] = [];
  for (const raw of input) {
    const v = (raw ?? {}) as Record<string, unknown>;
    const key = v.key === "B" || v.key === "C" ? v.key : null;
    if (!key || out.some((o) => o.key === key)) continue;
    out.push({ key, sections: sanitizeSections(v.sections), paused: v.paused !== false });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

// What visitors see: the published copy (A's components and the other versions)
export type Published = { sections: LandingSection[]; variants: PageVariant[] };
export function readPublished(input: unknown): Published | null {
  if (!input || typeof input !== "object") return null;
  const p = input as Record<string, unknown>;
  return { sections: sanitizeSections(p.sections), variants: sanitizeVariants(p.variants) };
}

// The versions a visitor can be shown (A and every running alternative)
export const liveVersions = (p: Published): VersionKey[] => ["A", ...p.variants.filter((v) => !v.paused).map((v) => v.key)];
export const versionSections = (p: Published, key: VersionKey) => (key === "A" ? p.sections : (p.variants.find((v) => v.key === key)?.sections ?? p.sections));

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
      const type = oneOf(c?.type, customFieldTypes, "text");
      const options = choiceTypes.includes(type) ? [...new Set(list(c?.options, 10, 60))] : [];
      if (choiceTypes.includes(type) && options.length < 2) return null;
      return { id: typeof c?.id === "string" && /^[\w-]{1,40}$/.test(c.id) ? c.id : newSectionId(), label, type, options, required: c?.required === true };
    })
    .filter((x): x is CustomField => x !== null)
    .slice(0, MAX_CUSTOM_FIELDS);
  const blocks = (Array.isArray(f.blocks) ? f.blocks : [])
    .map((x): FormBlock | null => {
      const b = x as Record<string, unknown>;
      const kind = oneOf(b?.kind, formBlockKinds, "text");
      const text = str(b?.text, kind === "heading" ? 120 : 400);
      const img = image(b?.image) ?? "";
      if ((kind === "heading" || kind === "text" || kind === "notice") && !text) return null;
      if (kind === "image" && !img) return null;
      return { id: typeof b?.id === "string" && /^[\w-]{1,40}$/.test(b.id) ? b.id : newSectionId(), kind, text, image: img };
    })
    .filter((x): x is FormBlock => x !== null)
    .slice(0, MAX_FORM_BLOCKS);
  return {
    title: str(f.title, 120),
    subtitle: str(f.subtitle, 300),
    buttonText: str(f.buttonText, 60),
    layout: oneOf(f.layout, ["stacked", "compact"] as const, defaultForm.layout),
    address: oneOf(f.address, ["hidden", "optional", "required"] as const, defaultForm.address),
    name: oneOf(f.name, fieldRules, defaultForm.name),
    commune: oneOf(f.commune, fieldRules, defaultForm.commune),
    wilaya: oneOf(f.wilaya, ["optional", "required"] as const, defaultForm.wilaya),
    optionButtons: bool(f.optionButtons, defaultForm.optionButtons),
    note: bool(f.note, defaultForm.note),
    delivery: oneOf(f.delivery, ["both", "home", "office"] as const, defaultForm.delivery),
    showSummary: bool(f.showSummary, defaultForm.showSummary),
    showOffers: bool(f.showOffers, defaultForm.showOffers),
    custom,
    thankYou: str(f.thankYou, 500),
    stickyButton: bool(f.stickyButton, defaultForm.stickyButton),
    order: resolveOrder(f.order, custom, blocks),
    labels: Object.fromEntries(
      textFields
        .map((k) => {
          const l = (f.labels as Record<string, Record<string, unknown>> | undefined)?.[k];
          return [k, { label: str(l?.label, 60), placeholder: str(l?.placeholder, 80) }] as const;
        })
        .filter(([, l]) => l.label || l.placeholder),
    ),
    icons: bool(f.icons, defaultForm.icons),
    showQuantity: bool(f.showQuantity, defaultForm.showQuantity),
    appearance: oneOf(f.appearance, formAppearances, defaultForm.appearance),
    buttonEffect: oneOf(f.buttonEffect, buttonEffects, defaultForm.buttonEffect),
    homeLabel: str(f.homeLabel, 40),
    officeLabel: str(f.officeLabel, 40),
    preferDelivery: oneOf(f.preferDelivery, ["home", "office"] as const, defaultForm.preferDelivery),
    whatsapp: bool(f.whatsapp, defaultForm.whatsapp),
    blocks,
    stepper: bool(f.stepper, defaultForm.stepper),
  };
}

// Page languages (the language of the texts in the images and of the order form)
export const pageLanguages = ["ar", "fr", "en"] as const;
export type PageLanguage = (typeof pageLanguages)[number];
export const interfaceLocale = (lang: PageLanguage) => lang;
// Older pages may say "dz" (Darija): read as Arabic
export const pageLanguage = (v: string): PageLanguage => (pageLanguages.includes(v as PageLanguage) ? (v as PageLanguage) : "ar");

// The AI writes for customers in the store's language (ar / fr / en)
export const storeLanguage = (locale: string): PageLanguage => (locale === "fr" || locale === "en" ? locale : "ar");
