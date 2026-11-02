"use server";

import { and, eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { newId, requireSection } from "@/server/auth/context";
import { safeAction } from "@/server/errors";
import { asLocale } from "@/i18n";
import type { ActionState } from "@/lib/action";
import { fieldErrorsFrom } from "@/lib/validation";
import { fromAlgeriaLocal } from "./pricing";

const shopOf = async (lang: string) => (await requireSection(asLocale(lang), "apps")).shop;

const promotionInput = z
  .object({
    name: z.string().trim().min(1, "e:required").max(120, "e:invalid"),
    percent: z.coerce.number().int("e:invalid").min(1, "e:percent").max(90, "e:percent"),
    startsAt: z.string().transform((v, ctx) => fromAlgeriaLocal(v) ?? (ctx.addIssue({ code: "custom", message: "e:invalid" }), z.NEVER)),
    endsAt: z.string().transform((v, ctx) => fromAlgeriaLocal(v) ?? (ctx.addIssue({ code: "custom", message: "e:invalid" }), z.NEVER)),
    productIds: z.array(z.string().uuid()).min(1, "e:pickProducts").max(500),
  })
  .refine((d) => d.endsAt > d.startsAt, { path: ["endsAt"], message: "e:endBeforeStart" });

export async function createPromotion(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("promotions/create", async () => {
    const shop = await shopOf(lang);
    const parsed = promotionInput.safeParse({ name: formData.get("name") ?? "", percent: formData.get("percent") ?? "", startsAt: formData.get("startsAt") ?? "", endsAt: formData.get("endsAt") ?? "", productIds: formData.getAll("productIds") });
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const d = parsed.data;
    // Only the shop's own products
    const own = (await db.select({ id: schema.products.id }).from(schema.products).where(and(eq(schema.products.shopId, shop.id), inArray(schema.products.id, d.productIds)))).map((p) => p.id);
    if (!own.length) return { ok: false, error: "checkFields", fieldErrors: { productIds: "pickProducts" } };
    await db.insert(schema.promotions).values({ id: newId(), shopId: shop.id, name: d.name, percent: d.percent, startsAt: d.startsAt, endsAt: d.endsAt, productIds: own });
    refresh();
    return { ok: true };
  });
}

export async function deletePromotion(lang: string, id: string): Promise<ActionState> {
  return safeAction("promotions/delete", async () => {
    const shop = await shopOf(lang);
    await db.delete(schema.promotions).where(and(eq(schema.promotions.shopId, shop.id), eq(schema.promotions.id, id)));
    refresh();
    return { ok: true };
  });
}

// Ends a running campaign now (kept in the list as ended)
export async function endPromotion(lang: string, id: string): Promise<ActionState> {
  return safeAction("promotions/end", async () => {
    const shop = await shopOf(lang);
    await db.update(schema.promotions).set({ endsAt: new Date() }).where(and(eq(schema.promotions.shopId, shop.id), eq(schema.promotions.id, id)));
    refresh();
    return { ok: true };
  });
}
