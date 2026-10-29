// Ready-made colors for product color options (names in the dashboard's language; the merchant can rename them).
export const colorPalette: { hex: string; ar: string; fr: string; en: string }[] = [
  { hex: "#111111", ar: "أسود", fr: "Noir", en: "Black" },
  { hex: "#ffffff", ar: "أبيض", fr: "Blanc", en: "White" },
  { hex: "#8a8f98", ar: "رمادي", fr: "Gris", en: "Grey" },
  { hex: "#1f2a44", ar: "كحلي", fr: "Bleu marine", en: "Navy" },
  { hex: "#2563eb", ar: "أزرق", fr: "Bleu", en: "Blue" },
  { hex: "#7dd3fc", ar: "أزرق فاتح", fr: "Bleu ciel", en: "Sky blue" },
  { hex: "#16a34a", ar: "أخضر", fr: "Vert", en: "Green" },
  { hex: "#4d5b2a", ar: "زيتي", fr: "Kaki", en: "Olive" },
  { hex: "#facc15", ar: "أصفر", fr: "Jaune", en: "Yellow" },
  { hex: "#f97316", ar: "برتقالي", fr: "Orange", en: "Orange" },
  { hex: "#dc2626", ar: "أحمر", fr: "Rouge", en: "Red" },
  { hex: "#7f1d1d", ar: "عنابي", fr: "Bordeaux", en: "Burgundy" },
  { hex: "#f9a8d4", ar: "وردي", fr: "Rose", en: "Pink" },
  { hex: "#7c3aed", ar: "بنفسجي", fr: "Violet", en: "Purple" },
  { hex: "#7c4a2d", ar: "بني", fr: "Marron", en: "Brown" },
  { hex: "#e8d8bd", ar: "بيج", fr: "Beige", en: "Beige" },
  { hex: "#d4af37", ar: "ذهبي", fr: "Doré", en: "Gold" },
  { hex: "#c0c0c0", ar: "فضي", fr: "Argenté", en: "Silver" },
];

export const isHexColor = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

// The color of a value typed by name ("أحمر", "Rouge", "red"), or null
export function colorByName(name: string): string | null {
  const n = name.trim().toLowerCase();
  return colorPalette.find((c) => [c.ar, c.fr.toLowerCase(), c.en.toLowerCase()].includes(n))?.hex ?? null;
}
