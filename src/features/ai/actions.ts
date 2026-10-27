"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { requireSection, requireShop } from "@/server/auth/context";
import { visionImages } from "@/server/ai/vision";
import { asLocale } from "@/i18n";
import { pageLanguages } from "@/features/landing/types";
import { resolveMessages } from "@/features/messages/templates";
import { callGuideRequest, descriptionRequest, messagesRequest } from "./prompts";
import { pollTask, startTask, type TaskStart, type TaskState } from "./tasks";

const language = z.enum(pageLanguages);

// Delivery prices as one line for the prompts (the real ones of this shop)
async function deliverySummary(shopId: string) {
  const rates = await db.select().from(schema.shippingRates).where(eq(schema.shippingRates.shopId, shopId));
  const range = (values: (number | null)[]) => {
    const v = values.filter((x): x is number => x != null);
    return v.length ? (Math.min(...v) === Math.max(...v) ? `${v[0]} DA` : `${Math.min(...v)}–${Math.max(...v)} DA depending on the wilaya`) : null;
  };
  if (!rates.length) return "free delivery (no delivery prices set)";
  const home = range(rates.map((r) => r.homePrice));
  const office = range(rates.map((r) => r.officePrice));
  return [home && `home delivery ${home}`, office && `delivery office ${office}`].filter(Boolean).join("; ");
}

// A call guide for one product (every member: agents use it during calls)
export async function startCallGuide(lang: string, productId: string, lng: string): Promise<TaskStart> {
  const { shop, user } = await requireShop(asLocale(lang));
  const parsed = language.safeParse(lng);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const [p] = await db.select().from(schema.products).where(and(eq(schema.products.shopId, shop.id), eq(schema.products.id, productId)));
  if (!p) return { ok: false, error: "notFound" };
  const request = callGuideRequest(p, parsed.data, { shopName: shop.name, delivery: await deliverySummary(shop.id), notes: "" });
  return startTask(shop.id, user.id, "call_guide", request, { language: parsed.data, productId: p.id });
}

// The shop's customer messages rewritten by the AI (returned to the editor, saved by the merchant)
export async function startMessagesAi(lang: string, lng: string, tone: string): Promise<TaskStart> {
  const { shop, user, role } = await requireSection(asLocale(lang), "callCenters");
  if (role === "agent") return { ok: false, error: "forbidden" };
  const parsed = language.safeParse(lng);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const current = resolveMessages({ ...(shop.messages as object | null), language: parsed.data }).texts;
  return startTask(shop.id, user.id, "messages", messagesRequest(parsed.data, { shopName: shop.name, tone: tone.slice(0, 200), current }), { language: parsed.data });
}

const descriptionInput = z.object({ name: z.string().trim().min(1).max(200), price: z.number().int().min(0).nullable(), notes: z.string().max(5000), images: z.array(z.string()).max(10), language });

// A product description from its name, notes and photos (filled in the form, saved with the product)
export async function startDescriptionAi(lang: string, input: z.input<typeof descriptionInput>): Promise<TaskStart> {
  const { shop, user } = await requireSection(asLocale(lang), "products");
  const parsed = descriptionInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "checkFields" };
  const d = parsed.data;
  const photos = await visionImages(d.images.filter((src) => src.startsWith(`/uploads/${shop.id}/`)), 4);
  return startTask(shop.id, user.id, "description", descriptionRequest(d, d.language, photos), { language: d.language });
}

export async function checkAiTask(lang: string, taskId: string): Promise<TaskState> {
  const { shop } = await requireShop(asLocale(lang));
  return pollTask(shop.id, taskId);
}
