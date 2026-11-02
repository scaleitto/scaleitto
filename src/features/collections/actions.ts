"use server";

import { and, eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { newId, requireSection } from "@/server/auth/context";
import { safeAction } from "@/server/errors";
import { asLocale } from "@/i18n";
import type { ActionState } from "@/lib/action";
import { fieldErrorsFrom } from "@/lib/validation";
import { HANDLE } from "./types";

const shopOf = async (lang: string) => (await requireSection(asLocale(lang), "apps")).shop;
const text = (max: number) => z.string().trim().max(max, "e:invalid");
const input = z
  .object({
    handle: z.string().trim().toLowerCase().min(1, "e:required").max(80, "e:invalid").regex(HANDLE, "e:handle"),
    titleAr: text(120),
    titleFr: text(120),
    titleEn: text(120),
    descriptionAr: text(1000),
    descriptionFr: text(1000),
    descriptionEn: text(1000),
    parentId: z.string().optional().default(""),
    image: z.union([z.literal(""), z.string().regex(/^\/uploads\/[\w-]+\/[\w.-]+$/)]).optional().default(""),
    active: z.preprocess((v) => v === "on", z.boolean()),
  })
  .refine((d) => d.titleAr || d.titleFr || d.titleEn, { path: ["titleAr"], message: "e:collectionTitle" });

export async function saveCollection(lang: string, id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("collections/save", async () => {
    const shop = await shopOf(lang);
    const parsed = input.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const d = parsed.data;
    const c = schema.collections;
    if (id) {
      const [own] = await db.select({ id: c.id }).from(c).where(and(eq(c.shopId, shop.id), eq(c.id, id)));
      if (!own) return { ok: false, error: "notFound" };
    }
    // Two levels at most: the parent is a top-level collection, and a collection with sub-collections stays on top
    let parentId: string | null = null;
    if (d.parentId) {
      const [parent] = await db.select({ id: c.id, parentId: c.parentId }).from(c).where(and(eq(c.shopId, shop.id), eq(c.id, d.parentId)));
      if (!parent || parent.id === id || parent.parentId) return { ok: false, error: "checkFields", fieldErrors: { parentId: "collectionParent" } };
      if (id) {
        const [child] = await db.select({ id: c.id }).from(c).where(and(eq(c.shopId, shop.id), eq(c.parentId, id))).limit(1);
        if (child) return { ok: false, error: "checkFields", fieldErrors: { parentId: "collectionParent" } };
      }
      parentId = parent.id;
    }
    const [taken] = await db.select({ id: c.id }).from(c).where(and(eq(c.shopId, shop.id), eq(c.handle, d.handle)));
    if (taken && taken.id !== id) return { ok: false, error: "checkFields", fieldErrors: { handle: "handleTaken" } };
    const values = {
      handle: d.handle,
      titles: { ar: d.titleAr, fr: d.titleFr, en: d.titleEn },
      descriptions: { ar: d.descriptionAr, fr: d.descriptionFr, en: d.descriptionEn },
      parentId,
      image: d.image || null,
      active: d.active,
    };
    if (id) await db.update(c).set(values).where(and(eq(c.shopId, shop.id), eq(c.id, id)));
    else await db.insert(c).values({ id: newId(), shopId: shop.id, ...values });
    refresh();
    return { ok: true };
  });
}

// Deleting a collection takes it off its products; its sub-collections move to the top level
export async function deleteCollection(lang: string, id: string): Promise<ActionState> {
  return safeAction("collections/delete", async () => {
    const shop = await shopOf(lang);
    const c = schema.collections;
    const [own] = await db.select({ id: c.id }).from(c).where(and(eq(c.shopId, shop.id), eq(c.id, id)));
    if (!own) return { ok: false, error: "notFound" };
    const p = schema.products;
    const holders = await db.select({ id: p.id, ids: p.collectionIds }).from(p).where(and(eq(p.shopId, shop.id), sql`json_contains(${p.collectionIds}, json_quote(${id}))`));
    await db.transaction(async (tx) => {
      for (const h of holders) await tx.update(p).set({ collectionIds: (h.ids ?? []).filter((x) => x !== id) }).where(eq(p.id, h.id));
      await tx.update(c).set({ parentId: null }).where(and(eq(c.shopId, shop.id), eq(c.parentId, id)));
      await tx.delete(c).where(and(eq(c.shopId, shop.id), eq(c.id, id)));
    });
    refresh();
    return { ok: true };
  });
}
