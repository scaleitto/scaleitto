import type { CSSProperties } from "react";

// Store themes: ready-made looks the merchant picks in the Theme Store. A theme only sets design tokens
// (font, surfaces, shapes) and a few layout switches; the storefront blocks read them, so every
// theme works with every store and with the merchant's own color.
export type ThemeFont = "cairo" | "tajawal" | "almarai" | "changa" | "el-messiri" | "plex" | "kufi" | "readex";

export type Theme = {
  key: string;
  name: { ar: string; fr: string; en: string };
  color: string; // suggested main color
  font: ThemeFont;
  surface: { bg: string; card: string; text: string; muted: string; line: string };
  radius: number; // px, cards
  buttonRadius: number; // px (999 = pill)
  card: "border" | "shadow" | "flat";
  layout: {
    header: "start" | "center";
    // split = text beside the photo, full = photo across the page, card = rounded banner, minimal = big title, photo below
    hero: "split" | "full" | "card" | "minimal";
    columns: 3 | 4;
    image: "square" | "portrait";
    // elevated = card with an order button, outline = bordered card, minimal = photo and text only
    cards: "elevated" | "outline" | "minimal";
  };
};

const light = { bg: "#f6f7f9", card: "#ffffff", text: "#0f172a", muted: "#64748b", line: "#e5e7eb" };
const white = { bg: "#ffffff", card: "#ffffff", text: "#111827", muted: "#6b7280", line: "#ececec" };
const dark = { bg: "#0b0f17", card: "#141a24", text: "#f3f4f6", muted: "#9aa3b2", line: "#232b38" };

export const themes: Theme[] = [
  { key: "classic", name: { ar: "عصري", fr: "Moderne", en: "Modern" }, color: "#16a34a", font: "cairo", surface: light, radius: 18, buttonRadius: 12, card: "shadow", layout: { header: "start", hero: "split", columns: 4, image: "square", cards: "elevated" } },
  { key: "minimal", name: { ar: "بسيط", fr: "Minimal", en: "Minimal" }, color: "#111827", font: "readex", surface: white, radius: 6, buttonRadius: 6, card: "flat", layout: { header: "center", hero: "minimal", columns: 4, image: "portrait", cards: "minimal" } },
  { key: "bold", name: { ar: "جريء", fr: "Audacieux", en: "Bold" }, color: "#e11d48", font: "changa", surface: light, radius: 22, buttonRadius: 999, card: "shadow", layout: { header: "start", hero: "full", columns: 3, image: "square", cards: "elevated" } },
  { key: "elegant", name: { ar: "أنيق", fr: "Élégant", en: "Elegant" }, color: "#a16207", font: "el-messiri", surface: { bg: "#faf6ef", card: "#fffdf9", text: "#292524", muted: "#78716c", line: "#e8dfd0" }, radius: 4, buttonRadius: 4, card: "border", layout: { header: "center", hero: "full", columns: 3, image: "portrait", cards: "minimal" } },
  { key: "night", name: { ar: "ليلي", fr: "Nuit", en: "Night" }, color: "#8b5cf6", font: "cairo", surface: dark, radius: 18, buttonRadius: 12, card: "border", layout: { header: "start", hero: "split", columns: 4, image: "square", cards: "elevated" } },
  { key: "fresh", name: { ar: "منعش", fr: "Frais", en: "Fresh" }, color: "#0d9488", font: "tajawal", surface: { bg: "#f2fbf9", card: "#ffffff", text: "#123b37", muted: "#58776f", line: "#d3ece6" }, radius: 24, buttonRadius: 999, card: "shadow", layout: { header: "start", hero: "card", columns: 4, image: "square", cards: "elevated" } },
  { key: "luxury", name: { ar: "فاخر", fr: "Luxe", en: "Luxury" }, color: "#d4a017", font: "el-messiri", surface: { bg: "#0d0c0b", card: "#171513", text: "#f5f2ec", muted: "#a8a29e", line: "#2c2824" }, radius: 2, buttonRadius: 2, card: "border", layout: { header: "center", hero: "full", columns: 3, image: "portrait", cards: "minimal" } },
  { key: "playful", name: { ar: "مرح", fr: "Ludique", en: "Playful" }, color: "#db2777", font: "changa", surface: { bg: "#fff7f0", card: "#ffffff", text: "#3f1d0f", muted: "#94695a", line: "#fbdcc5" }, radius: 28, buttonRadius: 999, card: "shadow", layout: { header: "center", hero: "card", columns: 3, image: "square", cards: "elevated" } },
  { key: "tech", name: { ar: "تقني", fr: "Tech", en: "Tech" }, color: "#2563eb", font: "plex", surface: white, radius: 12, buttonRadius: 8, card: "border", layout: { header: "start", hero: "split", columns: 4, image: "square", cards: "outline" } },
  { key: "beauty", name: { ar: "جمال", fr: "Beauté", en: "Beauty" }, color: "#e11d63", font: "almarai", surface: { bg: "#fff5f7", card: "#ffffff", text: "#4a0d22", muted: "#9b6b7a", line: "#fbd5df" }, radius: 22, buttonRadius: 999, card: "flat", layout: { header: "center", hero: "minimal", columns: 4, image: "portrait", cards: "minimal" } },
  { key: "sport", name: { ar: "رياضي", fr: "Sport", en: "Sport" }, color: "#f97316", font: "cairo", surface: { bg: "#0f1115", card: "#191c22", text: "#f9fafb", muted: "#9ca3af", line: "#2a2f38" }, radius: 6, buttonRadius: 6, card: "border", layout: { header: "start", hero: "full", columns: 4, image: "square", cards: "outline" } },
  { key: "nature", name: { ar: "طبيعي", fr: "Nature", en: "Nature" }, color: "#3f7d20", font: "tajawal", surface: { bg: "#f5f7ef", card: "#fcfdf9", text: "#1c2e0b", muted: "#5d6c4c", line: "#dfe7d0" }, radius: 16, buttonRadius: 10, card: "flat", layout: { header: "start", hero: "split", columns: 3, image: "portrait", cards: "minimal" } },
  { key: "souk", name: { ar: "سوق", fr: "Souk", en: "Souk" }, color: "#c2410c", font: "kufi", surface: { bg: "#faf4ea", card: "#fffaf3", text: "#3b2412", muted: "#8a6a50", line: "#ecdcc4" }, radius: 12, buttonRadius: 12, card: "border", layout: { header: "center", hero: "card", columns: 4, image: "square", cards: "outline" } },
];

export const defaultTheme = themes[0];
export const findTheme = (key: unknown) => themes.find((t) => t.key === key) ?? defaultTheme;

const shadows = { border: "none", shadow: "0 1px 2px rgba(0,0,0,.04), 0 8px 24px -12px rgba(0,0,0,.18)", flat: "none" };

// CSS variables read by the storefront (see globals.css: s-bg, s-surface, s-text, s-muted, s-line).
export function themeStyle(theme: Theme, color: string): CSSProperties {
  return {
    ["--brand" as string]: color,
    ["--s-bg" as string]: theme.surface.bg,
    ["--s-surface" as string]: theme.surface.card,
    ["--s-text" as string]: theme.surface.text,
    ["--s-muted" as string]: theme.surface.muted,
    ["--s-line" as string]: theme.surface.line,
    // flat cards keep a hairline only between sections, not around cards
    ["--s-card-border" as string]: theme.card === "border" ? theme.surface.line : "transparent",
    ["--s-radius" as string]: `${theme.radius}px`,
    ["--s-radius-btn" as string]: `${theme.buttonRadius}px`,
    ["--s-shadow" as string]: shadows[theme.card],
    fontFamily: `var(--font-${theme.font}), system-ui, sans-serif`,
  };
}
