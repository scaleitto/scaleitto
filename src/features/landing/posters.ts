import "server-only";
import type { BackgroundRequest } from "@/server/ai/openai";
import { languageRules } from "./ai-prompt";
import { cleanStrategy, STRATEGY_SCHEMA, strategyInstructions, type RawStrategy } from "./strategy";
import { newSectionId, posterKinds, sanitizeSections, type PageLanguage, type PosterKind } from "./types";

// Image pages (Wibi style): the AI first plans the page (texts, colors, one scene per section), then designs
// one vertical marketing image per section with its text written inside, from the product's own photos.

export const posterCounts = [2, 4, 6, 8, 10] as const;
export const posterPeople = ["none", "hands", "people"] as const;
export const posterAudiences = ["neutral", "women", "men", "kids", "family"] as const;
export type PosterOptions = { count: (typeof posterCounts)[number]; people: (typeof posterPeople)[number]; audience: (typeof posterAudiences)[number]; color: string | null };
export type Palette = { background: string; primary: string; accent: string };

const HEX = /^#[0-9a-f]{6}$/i;

const languageNames: Record<PageLanguage, string> = {
  ar: "Modern Standard Arabic (Arabic script, right-to-left)",
  dz: "Algerian Darija written in Arabic script (right-to-left)",
  fr: "French",
  en: "English",
};

const PLAN_ROLE = `You are the creative director of a top cash-on-delivery (COD) e-commerce agency (direct marketing, consumer psychology, conversion optimisation). You plan "image landing pages" for Facebook/TikTok traffic: a vertical stack of full-width, phone-sized ad images (each image is one section with its text designed inside), an order form after the first image, and a sticky order button. Mobile visitors only scroll and look, so every image must sell on its own in 2 seconds.`;

// Format, copy limits and honesty: always apply, whatever the strategy
const PLAN_CONTRACT = `Plan exactly the requested number of sections. Section kinds:
- hero: the hook. Huge headline naming the outcome the buyer wants, a short subtitle, 2–3 trust points as bullets (cash on delivery, delivery to the 58 wilayas, a confirmation call — these are always true here).
- problem: the pain or frustration the product removes, as a question headline + 2–3 short pains.
- solution: the product as the answer, headline + subtitle.
- benefits: 3–4 concrete benefits (2–3 words each) shown as icon rows next to the product.
- features: the product in the center with callouts pointing to visible features (2–4 short labels).
- howto: how to use it in 2–3 numbered steps (only if usage is simple to show).
- beforeAfter: a before/after split (ONLY when the product's effect is visual and obvious; never for health or body results).
- details: close-up on material, finish, size or what is in the box.
- offer: the price as a big badge (and the old price struck through only if given), urgency only from a real discount.
- cta: the closing image: product + call to action.
Order: hero first; problem/solution early; offer or cta last (unless the persuasion map or the merchant's brief says otherwise). No two sections of the same kind in a row.
angle: the marketing angle the section serves (one of your chosen angles, a few words, in the page language).

Copy rules (the text is rendered inside images, so it must be SHORT): headline max 6 words, subtitle max 10 words, bullets max 4 items of max 3 words, cta max 4 words. Vivid, specific to THIS product, in the requested language. No emojis.
scene: in English, one or two sentences describing the visual composition of the image (setting, camera angle, mood, where the product is, what the people are doing if any). Never describe text in the scene.

Strict honesty (non-negotiable): use only facts from the product data, photos and merchant notes. Never invent specs, certifications, awards, statistics, medical or health claims, guarantees, return policies, reviews, ratings, customer counts, stock levels or deadlines. Free delivery only if the merchant notes say so. Prices only as given.

palette: three hex colors that fit the product and convert well (background, primary, accent with strong contrast for text). marquee: 3 short selling points (max 3 words each) that are true for every order (e.g. cash on delivery, delivery to 58 wilayas, call to confirm).
product_name / product_description: when asked, a short product name (max 8 words) and a 2–4 sentence description in the page language; otherwise null.
strategy: the audience and the 3–5 main angles you chose, each with one sentence on why, in the page language.`;

const str = { type: "string" };
const nullableStr = { type: ["string", "null"] };
const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "product_name", "product_description", "strategy", "palette", "marquee", "sections"],
  properties: {
    title: str,
    strategy: STRATEGY_SCHEMA,
    product_name: nullableStr,
    product_description: nullableStr,
    palette: { type: "object", additionalProperties: false, required: ["background", "primary", "accent"], properties: { background: str, primary: str, accent: str } },
    marquee: { type: "array", items: str },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "angle", "headline", "subtitle", "bullets", "cta", "scene"],
        properties: { kind: { type: "string", enum: [...posterKinds] }, angle: str, headline: str, subtitle: nullableStr, bullets: { type: "array", items: str }, cta: nullableStr, scene: str },
      },
    },
  },
};

export type PosterProduct = { name: string; description: string | null; price: number; compareAtPrice: number | null; images: string[] };

export function buildPosterPlanRequest(brief: {
  product: PosterProduct;
  language: PageLanguage;
  options: PosterOptions;
  notes: string;
  sourceText?: string;
  visionImages: string[];
  writeProduct: boolean;
  customPrompt?: string | null;
}): BackgroundRequest {
  const p = brief.product;
  const data = {
    name: p.name,
    description: p.description ?? "",
    price_da: p.price,
    compare_at_price_da: p.compareAtPrice && p.compareAtPrice > p.price ? p.compareAtPrice : null,
  };
  const user = [
    languageRules[brief.language],
    `Number of sections: ${brief.options.count}.`,
    `Target audience: ${brief.options.audience === "neutral" ? "everyone (infer from the product)" : brief.options.audience}.`,
    `People in the images: ${peopleRule[brief.options.people]}`,
    brief.options.color ? `The store's main color is ${brief.options.color}: build the palette around it.` : "Choose the palette freely.",
    `Product data (JSON):\n${JSON.stringify(data, null, 2)}`,
    brief.notes ? `Merchant notes (facts you may use):\n${brief.notes}` : "Merchant notes: none.",
    brief.sourceText ? `Source text from the product link (raw facts only, never copy its wording):\n${brief.sourceText.slice(0, 4000)}` : "",
    brief.visionImages.length ? `${brief.visionImages.length} product photo(s) are attached: describe only what is clearly visible.` : "No photos attached.",
    brief.writeProduct ? "This is a new product: write product_name and product_description." : "Return null for product_name and product_description.",
  ]
    .filter(Boolean)
    .join("\n\n");
  const instructions = [PLAN_ROLE, strategyInstructions(brief.customPrompt), PLAN_CONTRACT].join("\n\n");
  return { instructions, user, images: brief.visionImages, schemaName: "image_landing_page", schema: PLAN_SCHEMA };
}

export type PosterPlan = {
  title?: string;
  product_name?: string | null;
  product_description?: string | null;
  palette?: Partial<Palette>;
  marquee?: string[];
  strategy?: RawStrategy;
  sections?: { kind?: string; angle?: string; headline?: string; subtitle?: string | null; bullets?: string[]; cta?: string | null; scene?: string }[];
};

const peopleRule: Record<PosterOptions["people"], string> = {
  none: "no people and no faces at all — only the product and scenery.",
  hands: "no faces; hands may appear when the product is held or used.",
  people: "people may appear naturally using the product (realistic, Algerian/North African look, modest clothing).",
};

// The look shared by every image of a page (kept on each section so one image can be regenerated alike)
export function lookOf(palette: Palette, options: Pick<PosterOptions, "people" | "audience">) {
  return `Palette: background ${palette.background}, main ${palette.primary}, highlight ${palette.accent}. People: ${peopleRule[options.people]} Audience: ${options.audience}.`;
}

// The model's plan → a page: band of selling points, the images (still to design), the order form after the first one.
export function finishPosterPage(plan: PosterPlan, fallbackName: string, options: PosterOptions, custom = false) {
  const raw = plan.palette ?? {};
  const palette: Palette = {
    background: HEX.test(raw.background ?? "") ? raw.background! : "#0f172a",
    primary: options.color ?? (HEX.test(raw.primary ?? "") ? raw.primary! : "#2563eb"),
    accent: HEX.test(raw.accent ?? "") ? raw.accent! : "#facc15",
  };
  const look = lookOf(palette, options);
  const posters = (plan.sections ?? []).slice(0, options.count).map((s) => ({
    type: "poster",
    image: "",
    kind: s.kind,
    angle: s.angle,
    headline: s.headline,
    subtitle: s.subtitle ?? undefined,
    bullets: s.bullets ?? [],
    cta: s.cta ?? undefined,
    scene: `${s.scene ?? ""}\n${look}`.trim(),
    previous: [],
  }));
  const sections = sanitizeSections([{ type: "marquee", items: plan.marquee ?? [] }, ...posters]);
  if (!sections.some((s) => s.type === "poster")) sections.push({ id: newSectionId(), type: "poster", image: "", kind: "hero", headline: fallbackName.slice(0, 160), bullets: [], scene: look, previous: [] });
  const first = sections.findIndex((s) => s.type === "poster");
  sections.splice(first + 1, 0, { id: newSectionId(), type: "form" });
  return {
    title: String(plan.title || fallbackName).slice(0, 200),
    productName: plan.product_name?.trim().slice(0, 200) || null,
    productDescription: plan.product_description?.trim().slice(0, 5000) || null,
    palette,
    strategy: cleanStrategy(plan.strategy, custom),
    sections,
  };
}

const kindRules: Record<PosterKind, string> = {
  hero: "Hero image: the headline very large at the top, the subtitle under it, the product big and dominant, the bullets as a column of icon + label rows.",
  problem: "Problem image: an emotional scene showing the frustration, the headline as a question, the bullets as pain points with simple icons.",
  solution: "Solution image: the product presented as the answer, glowing and premium, headline and subtitle.",
  benefits: "Benefits image: a headline at the top, the bullets as rows of round icons with labels beside the product.",
  features: "Features image: the product in the center with thin callout lines pointing to its parts, each callout labelled with one bullet.",
  howto: "How-to image: the headline, then numbered steps (1, 2, 3…) as rounded panels, each showing the action with the product and its bullet as label.",
  beforeAfter: "Before/after image: a split composition labelled with the bullets (before on one side, after on the other), the headline above.",
  details: "Details image: macro close-ups of the product's material and finish in rounded frames, the bullets as labels.",
  offer: "Offer image: the product with the price in a big eye-catching badge, the old price struck through if given, the call to action as a button shape.",
  cta: "Closing image: the product hero shot with the call to action as a big button shape and the headline.",
};

export type PosterContent = { kind: PosterKind; headline: string; subtitle?: string; bullets: string[]; cta?: string; scene?: string };

// The instructions for one image. The text to write is quoted exactly; nothing else may be written.
export function posterPrompt(
  s: PosterContent,
  ctx: { productName: string; language: PageLanguage; price: number; compareAtPrice: number | null; currency: string; extra?: string; background?: string },
) {
  const texts = [
    `Headline: "${s.headline}"`,
    s.subtitle ? `Subtitle: "${s.subtitle}"` : "",
    s.bullets.length ? `Labels: ${s.bullets.map((b) => `"${b}"`).join(", ")}` : "",
    s.cta ? `Button: "${s.cta}"` : "",
    s.kind === "offer" ? `Price: "${ctx.price} ${ctx.currency}"${ctx.compareAtPrice && ctx.compareAtPrice > ctx.price ? ` and the old price struck through: "${ctx.compareAtPrice} ${ctx.currency}"` : ""}` : "",
  ].filter(Boolean);
  return [
    "Design one vertical 2:3 image (1024x1536) that is one section of a mobile landing page for an Algerian cash-on-delivery store: a polished, high-converting social media ad creative.",
    `Product: ${ctx.productName}. The attached photo(s) show the real product: reproduce EXACTLY this product (same shape, proportions, colors, materials, logos and details). Never redesign it, never add parts, never show a different product.`,
    kindRules[s.kind],
    ctx.background || s.scene ? `Visual direction: ${ctx.background || s.scene}` : "",
    `Write ONLY these texts, exactly as given, in ${languageNames[ctx.language]}, perfectly spelled with correctly connected letters, in a bold modern font, large and readable on a phone, with strong contrast:\n${texts.join("\n")}`,
    "Do not write any other word, number or letter. No watermark, no website, no phone number, no fake brand, no ratings, no stars, no reviews, no certification badges.",
    "Premium modern advertising style: depth, soft cinematic light, rich colors from the palette, clean composition, generous safe margins (nothing important within 6% of the edges).",
    ctx.extra ? `Additional instructions from the merchant: ${ctx.extra}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
