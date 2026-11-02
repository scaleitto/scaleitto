"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { requireSection, requireShop } from "@/server/auth/context";
import { visionImages } from "@/server/ai/vision";
import { asLocale } from "@/i18n";
import { isSafeImage, pageLanguage } from "@/features/landing/types";
import { posterPrompt } from "@/features/landing/posters";
import { aiLanguages } from "./languages";
import { descriptionRequest } from "./prompts";
import { pollTask, startPosterTask, startTask, type TaskStart, type TaskState } from "./tasks";

const language = z.enum(aiLanguages);

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

// The page's product (and language) for the landing page image tools
async function pageProduct(shopId: string, pageId: string) {
  const [row] = await db
    .select({ language: schema.landingPages.language, product: schema.products })
    .from(schema.landingPages)
    .innerJoin(schema.products, eq(schema.products.id, schema.landingPages.productId))
    .where(and(eq(schema.landingPages.shopId, shopId), eq(schema.landingPages.id, pageId)));
  return row ?? null;
}

const posterInput = z.object({
  pageId: z.string().uuid(),
  headline: z.string().trim().min(1).max(160),
  subtitle: z.string().trim().max(240).optional(),
  bullets: z.array(z.string().trim().max(80)).max(5),
  scene: z.string().trim().max(600).optional(),
});

// "Draw again" in an AI image's settings: the same image with its (possibly corrected) texts, from the product
// photos. One use of the monthly AI quota.
export async function startPosterImage(lang: string, input: z.input<typeof posterInput>): Promise<TaskStart> {
  const { shop, user } = await requireSection(asLocale(lang), "landingPages");
  const parsed = posterInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "checkFields" };
  const d = parsed.data;
  const row = await pageProduct(shop.id, d.pageId);
  if (!row) return { ok: false, error: "notFound" };
  const prompt = posterPrompt({ headline: d.headline, subtitle: d.subtitle || undefined, bullets: d.bullets.filter(Boolean), scene: d.scene ?? "" }, { productName: row.product.name, language: pageLanguage(row.language) });
  return startPosterTask(shop.id, user.id, prompt, row.product.images.slice(0, 3));
}

const editInput = z.object({ pageId: z.string().uuid(), current: z.string().max(500), instruction: z.string().trim().min(3).max(600), poster: z.boolean() });

// "AI image edit prompt": the current image changed as asked, keeping its layout, size and style
export async function startImageEdit(lang: string, input: z.input<typeof editInput>): Promise<TaskStart> {
  const { shop, user } = await requireSection(asLocale(lang), "landingPages");
  const parsed = editInput.safeParse(input);
  if (!parsed.success || !isSafeImage(parsed.data.current) || !parsed.data.current.startsWith(`/uploads/${shop.id}/`)) return { ok: false, error: "checkFields" };
  const d = parsed.data;
  const row = await pageProduct(shop.id, d.pageId);
  if (!row) return { ok: false, error: "notFound" };
  const prompt = [
    "Edit the first attached image. Keep the same layout, framing, size, style, colors and every text that the instruction does not change. The other attached photos show the real product: it must stay exactly this product.",
    `Change asked by the merchant: ${d.instruction}`,
    "Any text you write must be perfectly spelled with correctly connected letters. No watermark, no fake reviews, ratings or certification badges, no buttons.",
  ].join("\n\n");
  return startPosterTask(shop.id, user.id, prompt, [d.current, ...row.product.images].slice(0, 4), d.poster ? "1024x1536" : "1024x1024");
}
