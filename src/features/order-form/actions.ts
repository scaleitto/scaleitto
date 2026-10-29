"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, schema } from "@/server/db";
import { requireSection } from "@/server/auth/context";
import { safeAction } from "@/server/errors";
import { asLocale } from "@/i18n";
import type { ActionState } from "@/lib/action";
import { resolveForm } from "@/features/landing/types";

// The store's order form (product pages; new landing pages start from it)
export async function saveOrderForm(lang: string, form: unknown): Promise<ActionState> {
  return safeAction("order-form/save", async () => {
    const { shop } = await requireSection(asLocale(lang), "orderForm");
    await db.update(schema.shops).set({ orderForm: resolveForm(form) }).where(eq(schema.shops.id, shop.id));
    refresh();
    return { ok: true };
  });
}
