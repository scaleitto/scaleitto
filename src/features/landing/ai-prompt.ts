import "server-only";
import type { AnglePlan } from "@/lib/enums";
import { offerFacts } from "@/features/checkout/pricing";
import type { QuantityOffer, ProductOption } from "@/server/db/schema";
import type { BackgroundRequest } from "@/server/ai/openai";
import { newSectionId, sanitizeSections, type LandingSection, type PageLanguage } from "./types";
import { benefitIconNames } from "./icons";
import { cleanStrategy, STRATEGY_SCHEMA, strategyInstructions, type RawStrategy } from "./strategy";

// The prompt and output schema of the AI landing page writer (honesty rules included).
export type AiLanguage = PageLanguage;
export const aiTones = ["persuasive", "premium", "friendly", "urgent"] as const;
export type AiTone = (typeof aiTones)[number];

export type LandingBrief = {
  product: {
    name: string;
    description: string | null;
    price: number;
    compareAtPrice: number | null;
    images: string[];
    options: ProductOption[];
    offers: QuantityOffer[];
  };
  language: AiLanguage;
  tone: AiTone;
  audience: string;
  notes: string;
  /** Same images as product.images, as data: URLs, so the model can look at them. */
  visionImages?: string[];
  /** Text imported from a product page link (supplier or other store). */
  sourceText?: string;
  /** The product does not exist yet: also write its name and description. */
  writeProduct?: boolean;
  /** The merchant's own prompt, in place of the platform's marketing method */
  customPrompt?: string | null;
  /** Automatic angles (5 + 1–2) or the merchant's chosen ones */
  angles?: AnglePlan;
};

export const languageRules: Record<AiLanguage, string> = {
  ar: "Write in clear, modern Standard Arabic that Algerian shoppers read easily. Short sentences.",
  dz: "Write in Algerian Darija using Arabic script, the way Algerians write in Facebook/TikTok ads (natural, warm, everyday words; French loanwords are fine when Algerians commonly use them). Keep it easy to read.",
  fr: "Write in natural French as used in Algerian e-commerce. Short sentences.",
  en: "Write in simple, natural English. Short sentences.",
};

const toneRules: Record<AiTone, string> = {
  persuasive: "Tone: persuasive and direct, focused on concrete benefits.",
  premium: "Tone: premium and elegant, emphasise quality and status without exaggeration.",
  friendly: "Tone: friendly and simple, like a trusted friend recommending the product.",
  urgent: "Tone: energetic with a sense of urgency, but only around real facts (real discount, real offers).",
};

const ROLE = `You are a senior direct-response marketer and copywriter (consumer psychology, product analysis, conversion optimisation, landing page UX) specialised in cash-on-delivery (COD) e-commerce landing pages for Facebook and TikTok traffic. You write landing pages that convert cold mobile visitors into orders.`;

// The technical contract: section kinds, honesty, photos (always applies, whatever the strategy)
const CONTRACT = `Page format: the sections you write follow the persuasion sequence; the order form (with price, quantity offers and delivery fees per wilaya) is added automatically after them as the last step, and a sticky order button follows the visitor, so you never write delivery prices and never ask for payment online.

Section types for each step of the sequence (choose at least 5 steps that suit the product; skip the others). 80% of visitors are on a phone: short lines, short paragraphs (max 3 lines), one idea per block, scannable.
1. hero: a strong product photo (the most attractive full-product image) and a headline (max ~8 words) with the main benefit, a subtitle (max ~18 words) that removes the main doubt. Never payment or delivery here. Optional short badge only when true (e.g. the real discount percentage).
2. problem: imageText (or text) — the pain in the customer's words, with a photo that shows it when one fits.
3. solution: imageText — the product as the fitting answer.
4. benefits: 3–6 cards, each: the best-fitting icon name from the allowed list, a 2–5 word title, one concrete sentence (benefit first, then the feature that delivers it).
5. features: a checklist of the real properties that support the benefits (only facts given).
6. usage: steps — how and when the product is used, in 2–4 steps (not how ordering works).
7. visual proof: imageText, image or gallery — close-ups of details, material, size, what is in the box (before/after only when honest and visible).
8. objections: faq — 3–6 real questions and fears, answered only with the facts given (returns/warranty ONLY if the merchant described them).
9. trust: badges — 3–4 short points TRUE for every order here: cash on delivery, delivery to the 58 wilayas, a confirmation call (and "check before paying" ONLY if the merchant notes allow it).
10. offer: cta — the price and the real discount or confirmed extra value, restating the main benefit.
Alternate text-heavy and photo-heavy blocks so the page breathes.

Creativity: write like a top Algerian e-commerce copywriter — vivid, sensory and specific to THIS product (what it looks like, how it feels to use it, the moment of life it improves). Vary sentence rhythm, use the customer's words, no generic filler ("high quality product", "best choice"). No emojis anywhere.

Strict honesty rules (non-negotiable):
- Use ONLY facts from the product data and merchant notes. Never invent statistics, certifications, awards, medical or health claims, guarantees, return policies, stock levels, customer counts, or deadlines.
- Never write customer testimonials or reviews (the merchant adds real ones).
- Never promise free delivery unless the merchant notes say so.
- Mention discounts only if a compare-at price or quantity offers exist, using the exact numbers given.
- Images: only use URLs from the provided image list; never invent URLs. Use null when no image fits.
- Prices are in Algerian dinars (DA / د.ج).

When product photos are attached:
- Look at them carefully and describe only what is clearly visible (type of product, color, material, finish, size cues, what is included). Do not guess technical specs.
- Use the photos to make the copy concrete and vivid (e.g. "stainless steel bracelet", "padded interior").
- Image i in the attached photos is the i-th URL of the product "images" list. Use EVERY image exactly once, where it fits best: the most attractive full-product photo in the hero; close-ups and detail shots in imageText blocks about that detail; photos of the product in use in the problem/desire block; extra photos in image sections. Never use the same image twice, never put two photo blocks in a row.

When source text from a product link is provided, treat it as raw supplier information: reuse the facts, never copy its wording, never mention the source site, ignore its prices/shipping/return terms (this store sells in Algeria with its own terms).

product_name / product_description: when asked to write them, give a short, clear product name (max ~8 words, no brand you cannot see) and a 2–4 sentence product description in the page language. Otherwise return null.
strategy: the audience and the 3–5 main angles you chose, each with one sentence on why, in the page language.`;

// Strict Structured Outputs schema: every property is required, optional ones are nullable.
const str = { type: "string" };
const nullableStr = { type: ["string", "null"] };
const strList = { type: "array", items: str };
const section = (type: string, properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: ["type", ...Object.keys(properties)],
  properties: { type: { type: "string", enum: [type] }, ...properties },
});

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "product_name", "product_description", "strategy", "sections"],
  properties: {
    title: { type: "string", description: "Short internal name of the page" },
    strategy: STRATEGY_SCHEMA,
    product_name: { type: ["string", "null"] },
    product_description: { type: ["string", "null"] },
    sections: {
      type: "array",
      items: {
        anyOf: [
          section("hero", { title: str, subtitle: nullableStr, image: nullableStr, badge: nullableStr }),
          section("badges", { items: strList }),
          section("text", { title: nullableStr, body: str }),
          section("imageText", { title: str, body: str, image: nullableStr }),
          section("benefits", { title: nullableStr, items: { type: "array", items: { type: "object", additionalProperties: false, required: ["icon", "title", "text"], properties: { icon: { type: "string", enum: benefitIconNames }, title: str, text: str } } } }),
          section("image", { url: str }),
          section("features", { title: nullableStr, items: strList }),
          section("steps", { title: nullableStr, items: strList }),
          section("faq", {
            title: nullableStr,
            items: {
              type: "array",
              items: { type: "object", additionalProperties: false, required: ["q", "a"], properties: { q: str, a: str } },
            },
          }),
          section("cta", { title: str, subtitle: nullableStr }),
        ],
      },
    },
  },
};

type RawSection = Record<string, unknown> & { type: string };

// Drops nulls, unknown image URLs and anything that fails validation, so a
// slightly-off model answer still yields a usable page.
function clean(raw: RawSection[], allowedImages: Set<string>): LandingSection[] {
  const copies: Record<string, unknown>[] = [];
  for (const s of raw) {
    const copy: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s)) if (v !== null && v !== "") copy[k] = v;
    if (copy.type === "image" && !allowedImages.has(String(copy.url))) continue;
    if ((copy.type === "hero" || copy.type === "imageText") && copy.image && !allowedImages.has(String(copy.image))) delete copy.image;
    // The model never places the form, writes reviews or countdowns: those are the merchant's
    if (copy.type === "form" || copy.type === "reviews" || copy.type === "countdown") continue;
    copies.push(copy);
  }
  return sanitizeSections(copies).slice(0, 30);
}

// Builds the background request for a landing page (see openai.ts startBackgroundJson).
export function buildLandingRequest(brief: LandingBrief): BackgroundRequest {
  const p = brief.product;
  const productData = {
    name: p.name,
    description: p.description ?? "",
    price_da: p.price,
    compare_at_price_da: p.compareAtPrice,
    discount_percent: p.compareAtPrice && p.compareAtPrice > p.price ? Math.round((1 - p.price / p.compareAtPrice) * 100) : null,
    quantity_offers: p.offers.map(offerFacts),
    options: p.options,
    images: p.images,
  };

  const user = [
    languageRules[brief.language],
    toneRules[brief.tone],
    brief.audience ? `Target audience: ${brief.audience}` : "Target audience: infer it from the product.",
    `Product data (JSON):\n${JSON.stringify(productData, null, 2)}`,
    brief.notes ? `Merchant notes (facts you may use):\n${brief.notes}` : "Merchant notes: none. Stay generic where facts are missing.",
    brief.sourceText ? `Source text from the product link (raw facts only):\n${brief.sourceText.slice(0, 4000)}` : "",
    brief.visionImages?.length ? `${brief.visionImages.length} product photo(s) are attached, in the same order as the images list.` : "No photos attached.",
    brief.writeProduct ? "This is a new product: write product_name and product_description." : "The product already exists: return null for product_name and product_description.",
    "Return the landing page as JSON.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const instructions = [ROLE, strategyInstructions(brief.customPrompt, brief.angles), CONTRACT].join("\n\n");
  return { instructions, user, images: brief.visionImages ?? [], schemaName: "landing_page", schema: RESPONSE_SCHEMA };
}

export type LandingAiOutput = { title?: string; product_name?: string | null; product_description?: string | null; strategy?: RawStrategy; sections?: RawSection[] };

// Turns the model's JSON into a safe, valid page (unknown images dropped, texts trimmed),
// with the order form as the last step of the persuasion sequence.
export function finishLandingPage(data: LandingAiOutput, fallbackName: string, images: string[], custom = false, angles?: AnglePlan) {
  const sections = clean(Array.isArray(data.sections) ? data.sections : [], new Set(images));
  if (!sections.some((s) => s.type === "hero")) sections.unshift({ id: newSectionId(), type: "hero", title: fallbackName.slice(0, 200), image: images[0] });
  sections.push({ id: newSectionId(), type: "form" });
  return {
    title: String(data.title || fallbackName).slice(0, 200),
    productName: data.product_name?.trim().slice(0, 200) || null,
    productDescription: data.product_description?.trim().slice(0, 5000) || null,
    strategy: cleanStrategy(data.strategy, custom, angles),
    sections,
  };
}
