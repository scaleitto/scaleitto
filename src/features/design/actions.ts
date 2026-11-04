"use server";

import { and, desc, eq, notInArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, schema } from "@/server/db";
import { newId, requireSection } from "@/server/auth/context";
import { safeAction } from "@/server/errors";
import { asLocale } from "@/i18n";
import { fieldErrorsFrom } from "@/lib/validation";
import type { ActionState } from "@/lib/action";
import { globalSchema, type GlobalInput } from "./validators";
import { resolveDesign } from "./types";
import { sanitizePages, type StorePages } from "./builder";

const guard = (lang: string) => requireSection(asLocale(lang), "storeDesign");
const MAX_HISTORY = 20;
const raw = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

// The builder saves as it goes: the global parts (checked first, they apply at once) and the pages' draft
export async function saveStoreDesign(lang: string, input: { global: GlobalInput; draft: unknown }): Promise<ActionState> {
  return safeAction("design/save", async () => {
    const { shop } = await guard(lang);
    const parsed = globalSchema.safeParse(input.global);
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const current = resolveDesign(shop.design);
    const draft = sanitizePages(input.draft, current.draft.home);
    // The theme (Theme Store) and the published pages stay as they are
    await db
      .update(schema.shops)
      .set({ primaryColor: parsed.data.primaryColor, logoUrl: parsed.data.logoUrl, design: { ...raw(shop.design), ...parsed.data.design, draft } })
      .where(eq(schema.shops.id, shop.id));
    return { ok: true };
  });
}

// Publish: visitors now see the draft; a copy goes to History
export async function publishStoreDesign(lang: string): Promise<ActionState> {
  return safeAction("design/publish", async () => {
    const { shop, user } = await guard(lang);
    const pages = resolveDesign(shop.design).draft;
    await db.update(schema.shops).set({ design: { ...raw(shop.design), pages, draft: pages } }).where(eq(schema.shops.id, shop.id));
    const v = schema.designVersions;
    await db.insert(v).values({ id: newId(), shopId: shop.id, pages, userId: user.id });
    const keep = (await db.select({ id: v.id }).from(v).where(eq(v.shopId, shop.id)).orderBy(desc(v.createdAt)).limit(MAX_HISTORY)).map((r) => r.id);
    await db.delete(v).where(and(eq(v.shopId, shop.id), notInArray(v.id, keep)));
    refresh();
    return { ok: true };
  });
}

// Discard draft: back to what visitors see
export async function discardStoreDraft(lang: string): Promise<StorePages | null> {
  const { shop } = await guard(lang);
  const pages = resolveDesign(shop.design).pages;
  await db.update(schema.shops).set({ design: { ...raw(shop.design), draft: pages } }).where(eq(schema.shops.id, shop.id));
  return pages;
}

export async function listDesignHistory(lang: string) {
  const { shop } = await guard(lang);
  const v = schema.designVersions;
  const rows = await db
    .select({ id: v.id, at: v.createdAt, pages: v.pages, by: schema.users.name })
    .from(v)
    .leftJoin(schema.users, eq(schema.users.id, v.userId))
    .where(eq(v.shopId, shop.id))
    .orderBy(desc(v.createdAt))
    .limit(MAX_HISTORY);
  return rows.map((r) => {
    const p = sanitizePages(r.pages, []);
    return { id: r.id, at: r.at.toISOString(), by: r.by, sections: p.home.length, pages: 1 + p.custom.length };
  });
}

export async function getDesignVersion(lang: string, id: string): Promise<StorePages | null> {
  const { shop } = await guard(lang);
  const v = schema.designVersions;
  const [row] = await db.select().from(v).where(and(eq(v.shopId, shop.id), eq(v.id, id)));
  return row ? sanitizePages(row.pages, []) : null;
}
