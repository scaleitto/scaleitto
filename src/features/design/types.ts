import { findTheme, type Theme, type ThemeFont } from "@/features/themes/themes";

// How a shop's storefront looks. Stored as JSON in shops.design; missing keys fall back to the defaults,
// so new options can be added later without migrating old shops.
export type StoreDesign = {
  // Key of the theme chosen in the Theme Store (src/features/themes/themes.ts)
  theme: string;
  announcement: { enabled: boolean; text: string };
  hero: { enabled: boolean; image: string; title: string; subtitle: string; buttonText: string };
  productsTitle: string;
  showBadges: boolean;
  about: string;
  socials: { facebook: string; instagram: string; tiktok: string; whatsapp: string };
  // The merchant's own changes to the theme ("" / 0 = the theme's choice)
  style: StyleOverrides;
  // "How to order" steps under the products
  showOrderSteps: boolean;
  // A round WhatsApp button in the corner of every store page (the footer's WhatsApp number)
};

export const themeFonts: ThemeFont[] = ["cairo", "tajawal", "almarai", "changa", "el-messiri", "plex", "kufi", "readex"];
export const cornerStyles = ["sharp", "soft", "round"] as const;
export type StyleOverrides = {
  font: ThemeFont | "";
  header: Theme["layout"]["header"] | "";
  hero: Theme["layout"]["hero"] | "";
  columns: Theme["layout"]["columns"] | 0;
  image: Theme["layout"]["image"] | "";
  cards: Theme["layout"]["cards"] | "";
  corners: (typeof cornerStyles)[number] | "";
};
export const styleChoices = {
  font: themeFonts,
  header: ["start", "center"],
  hero: ["split", "full", "card", "minimal"],
  columns: [3, 4],
  image: ["square", "portrait"],
  cards: ["elevated", "outline", "minimal"],
  corners: cornerStyles,
} as const satisfies { [K in keyof StyleOverrides]: readonly Exclude<StyleOverrides[K], "" | 0>[] };
const noStyle: StyleOverrides = { font: "", header: "", hero: "", columns: 0, image: "", cards: "", corners: "" };
const corners = { sharp: [4, 4], soft: [14, 10], round: [24, 999] } as const;

export const defaultDesign: StoreDesign = {
  theme: "classic",
  announcement: { enabled: false, text: "" },
  hero: { enabled: false, image: "", title: "", subtitle: "", buttonText: "" },
  productsTitle: "",
  showBadges: true,
  about: "",
  socials: { facebook: "", instagram: "", tiktok: "", whatsapp: "" },
  style: noStyle,
  showOrderSteps: true,
};

const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

// Saved design (possibly old or partial) → a complete design.
export function resolveDesign(saved: unknown): StoreDesign {
  const s = obj(saved);
  return {
    theme: typeof s.theme === "string" ? s.theme : defaultDesign.theme,
    announcement: { ...defaultDesign.announcement, ...obj(s.announcement) } as StoreDesign["announcement"],
    hero: { ...defaultDesign.hero, ...obj(s.hero) } as StoreDesign["hero"],
    productsTitle: typeof s.productsTitle === "string" ? s.productsTitle : defaultDesign.productsTitle,
    showBadges: typeof s.showBadges === "boolean" ? s.showBadges : defaultDesign.showBadges,
    about: typeof s.about === "string" ? s.about : defaultDesign.about,
    socials: { ...defaultDesign.socials, ...obj(s.socials) } as StoreDesign["socials"],
    style: resolveStyle(s.style),
    showOrderSteps: typeof s.showOrderSteps === "boolean" ? s.showOrderSteps : typeof s.showBadges === "boolean" ? s.showBadges : defaultDesign.showOrderSteps,
  };
}

function resolveStyle(v: unknown): StyleOverrides {
  const o = obj(v);
  const pick = <K extends keyof StyleOverrides>(k: K): StyleOverrides[K] => ((styleChoices[k] as readonly unknown[]).includes(o[k]) ? (o[k] as StyleOverrides[K]) : noStyle[k]);
  return { font: pick("font"), header: pick("header"), hero: pick("hero"), columns: pick("columns"), image: pick("image"), cards: pick("cards"), corners: pick("corners") };
}

// The store's theme with the merchant's own changes on top (every storefront page and preview uses this)
export function storeTheme(design: Pick<StoreDesign, "theme" | "style">): Theme {
  const theme = findTheme(design.theme);
  const s = design.style;
  return {
    ...theme,
    font: s.font || theme.font,
    ...(s.corners ? { radius: corners[s.corners][0], buttonRadius: corners[s.corners][1] } : {}),
    layout: {
      header: s.header || theme.layout.header,
      hero: s.hero || theme.layout.hero,
      columns: s.columns || theme.layout.columns,
      image: s.image || theme.layout.image,
      cards: s.cards || theme.layout.cards,
    },
  };
}

// Ready-made colors offered next to the color picker
export const colorPresets = ["#10b981", "#2563eb", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#ca8a04", "#0f172a"];
