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
};

export const defaultDesign: StoreDesign = {
  theme: "classic",
  announcement: { enabled: false, text: "" },
  hero: { enabled: false, image: "", title: "", subtitle: "", buttonText: "" },
  productsTitle: "",
  showBadges: true,
  about: "",
  socials: { facebook: "", instagram: "", tiktok: "", whatsapp: "" },
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
  };
}

// Ready-made colors offered next to the color picker
export const colorPresets = ["#10b981", "#2563eb", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#ca8a04", "#0f172a"];
