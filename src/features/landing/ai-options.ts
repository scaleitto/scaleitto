// The choices of "Generate with AI" (shared by the builder page and the server): image count, writing framework and
// style family. Labels live in the dictionaries (landingPages.ai.frameworks / styles).

export const posterSizes = [2, 4, 6] as const;
export const sizeNames = { 2: "small", 4: "medium", 6: "large" } as const;

export const frameworks = ["auto", "aida", "pas", "storybrand", "proof", "objection", "bab"] as const;
export type Framework = (typeof frameworks)[number];
// The short code shown under each framework's name
export const frameworkCodes: Record<Framework, string> = { auto: "", aida: "AIDA", pas: "PAS", storybrand: "STORYBRAND", proof: "PROOF STACK", objection: "OBJECTION CRUSHER", bab: "BAB" };

// How each framework orders the images (for the AI)
export const frameworkGuides: Record<Framework, string> = {
  auto: "Pick the best of these for this product: AIDA for impulse products, PAS when the product fixes a clear problem, Before/After when the change is visible. Say nothing about the choice, just apply it.",
  aida: "AIDA — Attention (the strongest promise, product big), Interest (what makes it special), Desire (concrete gains in daily life), Action (the offer: product + price).",
  pas: "PAS — Problem (the frustration the shopper lives, as a question), Agitation (what it costs them day after day, no exaggeration), Solution (the product as the fix, then its gains and the offer).",
  storybrand: "StoryBrand — the shopper is the hero with a goal, the problem in the way, the store as the guide with a simple plan (order, we call to confirm, pay on delivery), and the success after.",
  proof: "Proof stack — lead with what the shopper can check: what is visible in the photos, materials, what is in the box, the confirmation call and cash on delivery. Only facts given; no invented reviews or numbers.",
  objection: "Objection crusher — name the main hesitations (does it really work, is the size right, is it worth the price, what if…) and answer each one with the facts given, then the offer.",
  bab: "Before–After–Bridge — life now without the product, life after with it (only real, visible effects), and the product as the bridge, then the offer.",
};

export const styleKeys = ["auto", "tech", "outdoors", "blackGold", "clinical", "warmHome", "softBeauty", "street", "family", "workshop", "boldOffer", "elegance", "fitness"] as const;
export type StyleFamily = (typeof styleKeys)[number];
// Four colors shown as a strip on each style card (the second one becomes the page's main color)
export const styleFamilies: { key: StyleFamily; colors: [string, string, string, string] }[] = [
  { key: "auto", colors: ["#10b981", "#0ea5e9", "#f8fafc", "#f8fafc"] },
  { key: "tech", colors: ["#0b1020", "#22d3ee", "#6366f1", "#f8fafc"] },
  { key: "outdoors", colors: ["#f5efe6", "#ea580c", "#f5efe6", "#16a34a"] },
  { key: "blackGold", colors: ["#0a0a0a", "#d4a72c", "#f5f5f4", "#991b1b"] },
  { key: "clinical", colors: ["#f8fafc", "#0d9488", "#0f766e", "#bae6fd"] },
  { key: "warmHome", colors: ["#f8fafc", "#64748b", "#84cc16", "#f59e0b"] },
  { key: "softBeauty", colors: ["#fdf2f8", "#f472b6", "#c4b5fd", "#ffffff"] },
  { key: "street", colors: ["#0a0a0a", "#ef4444", "#22c55e", "#ffffff"] },
  { key: "family", colors: ["#fef9c3", "#38bdf8", "#f97316", "#22c55e"] },
  { key: "workshop", colors: ["#f8fafc", "#94a3b8", "#0ea5e9", "#facc15"] },
  { key: "boldOffer", colors: ["#ffffff", "#ef4444", "#f97316", "#ffffff"] },
  { key: "elegance", colors: ["#faf5f0", "#b08968", "#9d6b6b", "#3f2e2e"] },
  { key: "fitness", colors: ["#111827", "#84cc16", "#1d4ed8", "#ffffff"] },
];

// The look of every image of a page in this style (for the AI)
export const styleLooks: Record<StyleFamily, string> = {
  auto: "Choose the look that best fits the product and its buyers: premium modern advertising, depth, soft cinematic light, rich harmonious colors.",
  tech: "High-energy tech: dark navy background, neon cyan and violet glows, sleek reflections, futuristic light lines.",
  outdoors: "Rugged outdoors: natural landscapes, earthy tones with orange and green accents, strong daylight, durable and active feel.",
  blackGold: "Black & gold: deep black backgrounds, gold accents and typography, dramatic spotlight, luxury premium mood.",
  clinical: "Clinical clean: bright white and teal, soft clean light, lab-fresh minimal surfaces, trustworthy and hygienic.",
  warmHome: "Warm home: cozy domestic interiors, soft daylight, natural wood and linen, slate grey with fresh green and warm amber accents.",
  softBeauty: "Soft beauty: pastel pink and lavender, glowing soft light, silky textures, gentle and aspirational.",
  street: "Street fashion: urban streets, bold contrast, black with red and green pops, energetic youth culture.",
  family: "Bright family: cheerful bright colors (sky blue, orange, green, sunny yellow), playful, safe and warm.",
  workshop: "Pro workshop: tools and workbench, steel greys with blue and yellow accents, precise technical lighting.",
  boldOffer: "Bold offer: loud commercial ad, red and orange bursts, big price badges, high contrast, promotional energy.",
  elegance: "Soft elegance: refined neutral tones (cream, taupe, dusty rose, deep brown), gentle light, graceful and calm.",
  fitness: "Fitness energy: dark gym backgrounds, lime green and electric blue accents, motion and power.",
};
