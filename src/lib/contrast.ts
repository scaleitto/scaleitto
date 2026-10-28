// Color contrast (WCAG 2): picks readable text colors for a merchant's own main color, whatever it is.

const parse = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toHex = (rgb: number[]) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

function luminance(rgb: [number, number, number]) {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string) {
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return 1;
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

// Text on a filled button of this color: white, or near-black when white would be too faint
export function textOn(background: string) {
  return contrastRatio(background, "#ffffff") >= contrastRatio(background, "#111111") ? "#ffffff" : "#111111";
}

// The color as text on a surface (prices, links): the color itself when readable (4.5:1),
// otherwise mixed step by step toward the surface's text color until it is.
export function readableOn(color: string, surface: string, text: string) {
  const c = parse(color);
  const t = parse(text);
  if (!c || !t) return color;
  for (let k = 0; k <= 10; k++) {
    const mixed = toHex(c.map((v, i) => v + ((t[i] - v) * k) / 10));
    if (contrastRatio(mixed, surface) >= 4.5) return mixed;
  }
  return text;
}
