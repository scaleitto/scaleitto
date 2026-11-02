import "server-only";
import type { BackgroundRequest } from "@/server/ai/openai";
import { aiLanguageRules as languageRules, type AiLanguage as PageLanguage } from "./languages";

// Prompt and output schema of the small AI task (product description).
// Same honesty rules as the landing pages: only the facts given, nothing invented.

const HONESTY = `Strict honesty rules: use ONLY the facts given (product data, merchant notes, delivery prices). Never invent guarantees, return policies, certifications, health claims, stock levels, delivery times or discounts. When a fact is unknown, the right answer is to say the agent will check and call back.`;

const str = { type: "string" };
const object = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// ─── Product description ────────────────────────────────

export function descriptionRequest(p: { name: string; price: number | null; notes: string }, language: PageLanguage, visionImages: string[]): BackgroundRequest {
  const instructions = `You write product descriptions for an Algerian cash-on-delivery online store.
Write a clear, attractive description for the product page: 1 short paragraph on the main benefit, then 4–6 short lines starting with "• " for the concrete features, then one line on what is included if known. Plain text only (no markdown, no headings), max 900 characters.
Describe only what is in the notes or clearly visible in the photos. ${HONESTY}
${languageRules[language]}`;
  const user = [`Product name: ${p.name}`, p.price ? `Price: ${p.price} DA` : "", p.notes ? `Merchant notes / current description:\n${p.notes}` : "No notes.", visionImages.length ? `${visionImages.length} photo(s) attached.` : "No photos."].filter(Boolean).join("\n\n");
  return { instructions, user, images: visionImages, schemaName: "product_description", schema: object({ description: str }), maxOutputTokens: 3000 };
}

export const cleanDescription = (data: unknown) => clip((data as { description?: unknown } | null)?.description, 5000) || null;
