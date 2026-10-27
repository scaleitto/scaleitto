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
  layout: { header: "start" | "center"; hero: "card" | "full"; columns: 3 | 4; image: "square" | "portrait" };
};

const light = { bg: "#f8fafc", card: "#ffffff", text: "#0f172a", muted: "#64748b", line: "#e2e8f0" };
const white = { bg: "#ffffff", card: "#ffffff", text: "#111827", muted: "#6b7280", line: "#e5e7eb" };
const dark = { bg: "#0b1120", card: "#151d2e", text: "#f1f5f9", muted: "#94a3b8", line: "#26324a" };

export const themes: Theme[] = [
  { key: "classic", name: { ar: "كلاسيك", fr: "Classique", en: "Classic" }, color: "#10b981", font: "cairo", surface: light, radius: 16, buttonRadius: 12, card: "border", layout: { header: "start", hero: "card", columns: 4, image: "square" } },
  { key: "minimal", name: { ar: "بسيط", fr: "Minimal", en: "Minimal" }, color: "#111827", font: "readex", surface: white, radius: 0, buttonRadius: 0, card: "flat", layout: { header: "center", hero: "full", columns: 4, image: "portrait" } },
  { key: "bold", name: { ar: "جريء", fr: "Audacieux", en: "Bold" }, color: "#dc2626", font: "changa", surface: light, radius: 20, buttonRadius: 999, card: "shadow", layout: { header: "start", hero: "card", columns: 3, image: "square" } },
  { key: "elegant", name: { ar: "أنيق", fr: "Élégant", en: "Elegant" }, color: "#b45309", font: "el-messiri", surface: { bg: "#fbf7f0", card: "#fffdf8", text: "#292524", muted: "#78716c", line: "#e7dfd2" }, radius: 6, buttonRadius: 6, card: "border", layout: { header: "center", hero: "full", columns: 3, image: "portrait" } },
  { key: "night", name: { ar: "ليلي", fr: "Nuit", en: "Night" }, color: "#8b5cf6", font: "cairo", surface: dark, radius: 18, buttonRadius: 12, card: "shadow", layout: { header: "start", hero: "card", columns: 4, image: "square" } },
  { key: "fresh", name: { ar: "منعش", fr: "Frais", en: "Fresh" }, color: "#0d9488", font: "tajawal", surface: { bg: "#f0fdfa", card: "#ffffff", text: "#134e4a", muted: "#5f7f7b", line: "#ccece6" }, radius: 24, buttonRadius: 999, card: "shadow", layout: { header: "start", hero: "card", columns: 4, image: "square" } },
  { key: "luxury", name: { ar: "فاخر", fr: "Luxe", en: "Luxury" }, color: "#ca8a04", font: "el-messiri", surface: { bg: "#0c0a09", card: "#1c1917", text: "#f5f5f4", muted: "#a8a29e", line: "#2e2a27" }, radius: 2, buttonRadius: 2, card: "border", layout: { header: "center", hero: "full", columns: 3, image: "portrait" } },
  { key: "playful", name: { ar: "مرح", fr: "Ludique", en: "Playful" }, color: "#db2777", font: "changa", surface: { bg: "#fff7ed", card: "#ffffff", text: "#431407", muted: "#9a6b55", line: "#fed7aa" }, radius: 28, buttonRadius: 999, card: "shadow", layout: { header: "center", hero: "card", columns: 3, image: "square" } },
  { key: "tech", name: { ar: "تقني", fr: "Tech", en: "Tech" }, color: "#2563eb", font: "plex", surface: white, radius: 10, buttonRadius: 8, card: "border", layout: { header: "start", hero: "full", columns: 4, image: "square" } },
  { key: "beauty", name: { ar: "جمال", fr: "Beauté", en: "Beauty" }, color: "#e11d48", font: "almarai", surface: { bg: "#fff1f2", card: "#ffffff", text: "#4c0519", muted: "#9f6b78", line: "#fecdd3" }, radius: 22, buttonRadius: 999, card: "flat", layout: { header: "center", hero: "card", columns: 4, image: "portrait" } },
  { key: "sport", name: { ar: "رياضي", fr: "Sport", en: "Sport" }, color: "#ea580c", font: "cairo", surface: { bg: "#111827", card: "#1f2937", text: "#f9fafb", muted: "#9ca3af", line: "#374151" }, radius: 4, buttonRadius: 4, card: "flat", layout: { header: "start", hero: "full", columns: 4, image: "square" } },
  { key: "nature", name: { ar: "طبيعي", fr: "Nature", en: "Nature" }, color: "#15803d", font: "tajawal", surface: { bg: "#f4f7ee", card: "#fbfcf8", text: "#1a2e05", muted: "#5b6b4a", line: "#dbe5cc" }, radius: 14, buttonRadius: 10, card: "flat", layout: { header: "start", hero: "card", columns: 3, image: "portrait" } },
  { key: "souk", name: { ar: "سوق", fr: "Souk", en: "Souk" }, color: "#c2410c", font: "kufi", surface: { bg: "#faf3e8", card: "#fffaf2", text: "#3b2412", muted: "#8a6a50", line: "#ecdcc4" }, radius: 12, buttonRadius: 12, card: "border", layout: { header: "center", hero: "card", columns: 4, image: "square" } },
];

export const defaultTheme = themes[0];
export const findTheme = (key: unknown) => themes.find((t) => t.key === key) ?? defaultTheme;

const shadows = { border: "none", shadow: "0 6px 24px -10px rgba(0,0,0,.25)", flat: "none" };

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
