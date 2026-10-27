import "server-only";
import type { BackgroundRequest } from "@/server/ai/openai";
import type { ProductOption, QuantityOffer } from "@/server/db/schema";
import { languageRules } from "@/features/landing/ai-prompt";
import type { PageLanguage } from "@/features/landing/types";
import { MAX_MESSAGE, messageKinds, placeholders } from "@/features/messages/templates";

// Prompts and output schemas of the small AI tasks (call guide, customer messages, product description).
// Same honesty rules as the landing pages: only the facts given, nothing invented.

const HONESTY = `Strict honesty rules: use ONLY the facts given (product data, merchant notes, delivery prices). Never invent guarantees, return policies, certifications, health claims, stock levels, delivery times or discounts. When a fact is unknown, the right answer is to say the agent will check and call back.`;

const str = { type: "string" };
const strList = { type: "array", items: str };
const object = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });

export type ProductFacts = { name: string; description: string | null; price: number; compareAtPrice: number | null; options: ProductOption[]; offers: QuantityOffer[] };

// ─── Call guide ─────────────────────────────────────────

export type CallGuide = { language: PageLanguage; pitch: string; keyPoints: string[]; questions: string[]; objections: { q: string; a: string }[]; closing: string };
const CALL_GUIDE_SCHEMA = object({ pitch: str, keyPoints: strList, questions: strList, objections: { type: "array", items: object({ q: str, a: str }) }, closing: str });

export function callGuideRequest(p: ProductFacts, language: PageLanguage, extra: { shopName: string; delivery: string; notes: string }): BackgroundRequest {
  const instructions = `You coach call-center agents of an Algerian cash-on-delivery online store. Agents phone each customer who ordered to confirm the order before shipping.
Write a short, practical call guide for ONE product, to read during the call:
- pitch: 2–3 sentences to open the call warmly (greet, store name, the product ordered, check it is a good time).
- keyPoints: 4–6 short selling points to reassure the customer (benefit first).
- questions: 2–4 questions to confirm the order details (variant/size/color if the product has options, delivery address details, best time for delivery).
- objections: 5–8 real objections of Algerian COD customers with a short, polite answer each (price too high, "is it really cash on delivery?", delivery delay, delivery cost, quality doubts, "I'll think about it", "I didn't order"…). Answers must be honest and must not pressure the customer.
- closing: how to end the call: restate product, quantity, total and delivery wilaya, thank the customer.
${HONESTY}
${languageRules[language]}`;
  const user = [
    `Store: ${extra.shopName}`,
    `Product (JSON): ${JSON.stringify({ name: p.name, description: p.description ?? "", price_da: p.price, compare_at_price_da: p.compareAtPrice, options: p.options, quantity_offers: p.offers.map((o) => ({ quantity: o.quantity, total_price_da: o.price })) })}`,
    `Delivery prices: ${extra.delivery}`,
    extra.notes ? `Merchant notes (facts you may use): ${extra.notes}` : "Merchant notes: none.",
  ].join("\n\n");
  return { instructions, user, schemaName: "call_guide", schema: CALL_GUIDE_SCHEMA, maxOutputTokens: 6000 };
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown, n: number, max: number) => (Array.isArray(v) ? v.map((x) => clip(x, max)).filter(Boolean).slice(0, n) : []);

export function cleanCallGuide(data: unknown, language: PageLanguage): CallGuide | null {
  const d = (data ?? {}) as Record<string, unknown>;
  const guide: CallGuide = {
    language,
    pitch: clip(d.pitch, 800),
    keyPoints: list(d.keyPoints, 8, 300),
    questions: list(d.questions, 6, 300),
    objections: (Array.isArray(d.objections) ? d.objections : [])
      .map((o: { q?: unknown; a?: unknown }) => ({ q: clip(o?.q, 300), a: clip(o?.a, 800) }))
      .filter((o) => o.q && o.a)
      .slice(0, 10),
    closing: clip(d.closing, 800),
  };
  return guide.pitch && guide.objections.length ? guide : null;
}

// ─── Customer messages ──────────────────────────────────

const MESSAGES_SCHEMA = object(Object.fromEntries(messageKinds.map((k) => [k, str])));

export function messagesRequest(language: PageLanguage, extra: { shopName: string; tone: string; current: Record<string, string> }): BackgroundRequest {
  const instructions = `You write short WhatsApp/SMS messages that an Algerian cash-on-delivery store sends to its customers.
Rewrite the six messages below so they sound natural, warm and professional for this store, and make customers reply to confirm their order.
Purpose of each message:
- confirm: right after the order, ask the customer to confirm by replying "yes".
- noAnswer: the agent called and the customer did not answer; ask to confirm by message or say when to call back.
- unreachable: the phone was switched off / out of coverage; ask to confirm when they see the message.
- postponed: the customer asked to be called later; remind them, offer to confirm now.
- shipped: the order has shipped; give the tracking number and the amount to prepare.
- delivery: the courier will call today; ask to keep the phone on.
Rules: keep EXACTLY these placeholders where useful, with braces, never invent others: ${placeholders.map((p) => `{${p}}`).join(" ")}. Max 450 characters each, 1–2 emojis at most, no links, no promises not given. ${HONESTY}
${languageRules[language]}
Tone wanted by the merchant: ${extra.tone || "friendly and professional"}.`;
  const user = `Store: ${extra.shopName}\nCurrent messages (JSON):\n${JSON.stringify(extra.current, null, 2)}`;
  return { instructions, user, schemaName: "customer_messages", schema: MESSAGES_SCHEMA, maxOutputTokens: 4000 };
}

export function cleanMessages(data: unknown) {
  const d = (data ?? {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const k of messageKinds) {
    const text = clip(d[k], MAX_MESSAGE).replace(/\{(\w+)\}/g, (m, key: string) => ((placeholders as readonly string[]).includes(key) ? m : ""));
    if (text) out[k] = text;
  }
  return Object.keys(out).length === messageKinds.length ? out : null;
}

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
