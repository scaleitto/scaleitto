import "server-only";
import { richTextToPlain } from "@/lib/rich-text";
import type { BackgroundRequest } from "@/server/ai/openai";
import { newImage, newSectionId, sanitizeSections, type LandingSection, type PageLanguage, type PosterInfo } from "./types";
import { frameworkGuides, posterSizes, styleFamilies, styleLooks, type Framework, type StyleFamily } from "./ai-options";

// "Generate with AI" (Zimam): the AI first plans the page (one short text and scene per image, following the chosen
// writing framework), then draws each image with its text inside, from the product's own photos, in the chosen
// style family. The page = the images, then the order form, a sticky order button and a thank-you window.

export type PosterOptions = { count: (typeof posterSizes)[number]; framework: Framework; style: StyleFamily; brief: string; priceText: string };

export const languageNames: Record<PageLanguage, string> = {
  ar: "Modern Standard Arabic (Arabic script, right-to-left)",
  fr: "French",
  en: "English",
};

export const languageRules: Record<PageLanguage, string> = {
  ar: "Write in clear, modern Standard Arabic that Algerian shoppers read easily. Short sentences.",
  fr: "Write in natural French as used in Algerian e-commerce. Short sentences.",
  en: "Write in simple, natural English. Short sentences.",
};

const PLAN_ROLE = `You are the creative director of a top cash-on-delivery (COD) e-commerce agency (direct marketing, consumer psychology, conversion optimisation). You plan image landing pages for Facebook/TikTok traffic: a vertical stack of full-width, phone-sized ad images, each with its text designed inside, then the order form with a sticky order button; tapping any image opens the form. Visitors only scroll and look, so every image must sell on its own in 2 seconds.`;

// Format, copy limits and honesty: always apply, whatever the framework
const PLAN_CONTRACT = `Plan exactly the requested number of images, in the order the framework needs (the order form comes after them automatically). The first image is always the strongest hook with the product big and clear.

Copy rules (the text is drawn inside images, so it must be SHORT): headline max 6 words, subtitle max 10 words, bullets max 4 items of max 3 words. Vivid, specific to THIS product, in the requested language. No emojis. Never write buttons or "click here": the page has real buttons.
scene: in English, one or two sentences describing the visual composition (setting, camera angle, mood, where the product is, what people do if any). Never describe text in the scene.

Strict honesty (non-negotiable): use only facts from the product data, photos and the merchant's brief. Never invent specs, certifications, awards, statistics, medical or health claims, guarantees, return policies, reviews, ratings, customer counts, stock levels or deadlines. Free delivery only if the brief says so. Prices only as given.
product_name / product_description: when asked, a short product name (max 8 words) and a 2–4 sentence description in the page language; otherwise null.`;

const str = { type: "string" };
const nullableStr = { type: ["string", "null"] };
const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "product_name", "product_description", "images"],
  properties: {
    title: str,
    product_name: nullableStr,
    product_description: nullableStr,
    images: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["headline", "subtitle", "bullets", "scene"],
        properties: { headline: str, subtitle: nullableStr, bullets: { type: "array", items: str }, scene: str },
      },
    },
  },
};

export type PosterProduct = { name: string; description: string | null; price: number; compareAtPrice: number | null; images: string[] };

export function buildPosterPlanRequest(brief: { product: PosterProduct; language: PageLanguage; options: PosterOptions; visionImages: string[]; writeProduct?: boolean }): BackgroundRequest {
  const p = brief.product;
  const o = brief.options;
  const data = {
    name: p.name,
    description: richTextToPlain(p.description ?? ""),
    price_da: p.price,
    compare_at_price_da: p.compareAtPrice && p.compareAtPrice > p.price ? p.compareAtPrice : null,
  };
  const user = [
    languageRules[brief.language],
    `Number of images: ${o.count}.`,
    `Writing framework: ${frameworkGuides[o.framework]}`,
    `Visual style family: ${styleLooks[o.style]}`,
    `Product data (JSON):\n${JSON.stringify(data, null, 2)}`,
    o.brief ? `Merchant's offer and visual brief (facts and wishes you may use):\n${o.brief}` : "Merchant's brief: none.",
    o.priceText ? `Price text to show on the offer image, exactly: "${o.priceText}"` : "",
    brief.visionImages.length ? `${brief.visionImages.length} product photo(s) are attached: describe only what is clearly visible.` : "No photos attached.",
    brief.writeProduct ? "Write product_name and product_description." : "Return null for product_name and product_description.",
  ]
    .filter(Boolean)
    .join("\n\n");
  return { instructions: [PLAN_ROLE, PLAN_CONTRACT].join("\n\n"), user, images: brief.visionImages, schemaName: "image_landing_page", schema: PLAN_SCHEMA };
}

export type PosterPlan = {
  title?: string;
  product_name?: string | null;
  product_description?: string | null;
  images?: { headline?: string; subtitle?: string | null; bullets?: string[]; scene?: string }[];
};

// The model's plan → the page's components: the images (still to draw), the order form, a sticky order button and
// a thank-you window. The style's look is kept in each image's scene so one image can be drawn again alike.
export function finishPosterPage(plan: PosterPlan, fallbackName: string, options: PosterOptions) {
  const look = styleLooks[options.style];
  const images = (plan.images ?? [])
    .slice(0, options.count)
    .map((s): LandingSection | null => {
      const headline = String(s.headline ?? "").trim().slice(0, 160);
      if (!headline) return null;
      const poster: PosterInfo = { headline, subtitle: s.subtitle?.trim().slice(0, 240) || undefined, bullets: (s.bullets ?? []).map((b) => String(b).trim().slice(0, 80)).filter(Boolean).slice(0, 5), scene: `${String(s.scene ?? "").slice(0, 400)}\n${look}`.trim().slice(0, 600), previous: [] };
      return { ...newImage(), poster };
    })
    .filter((x): x is LandingSection => x !== null);
  if (!images.length) images.push({ ...newImage(), poster: { headline: fallbackName.slice(0, 160), bullets: [], scene: look, previous: [] } });
  const sections = sanitizeSections([...images, { id: newSectionId(), type: "form" }, { id: newSectionId(), type: "sticky", label: "" }, { id: newSectionId(), type: "thankYou", title: "", message: "" }]);
  return {
    title: String(plan.title || fallbackName).slice(0, 200),
    productName: plan.product_name?.trim().slice(0, 200) || null,
    productDescription: plan.product_description?.trim().slice(0, 5000) || null,
    color: styleFamilies.find((x) => x.key === options.style)?.colors[1] ?? null,
    sections,
  };
}

// The instructions to draw one image. The texts are quoted exactly; nothing else may be written.
export function posterPrompt(
  s: Pick<PosterInfo, "headline" | "subtitle" | "bullets" | "scene"> & { first?: boolean },
  ctx: { productName: string; language: PageLanguage; priceText?: string; extra?: string },
) {
  const texts = [`Headline: "${s.headline}"`, s.subtitle ? `Subtitle: "${s.subtitle}"` : "", s.bullets.length ? `Labels: ${s.bullets.map((b) => `"${b}"`).join(", ")}` : "", ctx.priceText ? `Price badge (only if it fits this image's purpose): "${ctx.priceText}"` : ""].filter(Boolean);
  return [
    "Design one vertical 2:3 image (1024x1536) that is one section of a mobile landing page for an Algerian cash-on-delivery store: a polished, high-converting social media ad creative.",
    `Product: ${ctx.productName}. The attached photo(s) show the real product: reproduce EXACTLY this product (same shape, proportions, colors, materials, logos and details). Never redesign it, never add parts, never show a different product.`,
    s.first ? "This is the first image of the page: the product big and dominant, the headline very large." : "",
    s.scene ? `Visual direction: ${s.scene}` : "",
    `Write ONLY these texts, exactly as given, in ${languageNames[ctx.language]}, perfectly spelled with correctly connected letters, in a bold modern font, large and readable on a phone, with strong contrast:\n${texts.join("\n")}`,
    "Do not write any other word, number or letter. No watermark, no website, no phone number, no fake brand, no ratings, no stars, no reviews, no certification badges.",
    "Never draw buttons, button-like shapes, arrows saying to click, form fields or anything that looks tappable: the page has real buttons.",
    "Generous safe margins (nothing important within 6% of the edges).",
    ctx.extra ? `Instructions from the merchant: ${ctx.extra}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
