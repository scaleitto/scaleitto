"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, schema } from "@/server/db";
import { requireSection } from "@/server/auth/context";
import { safeAction } from "@/server/errors";
import { asLocale } from "@/i18n";
import { fieldErrorsFrom } from "@/lib/validation";
import type { ActionState } from "@/lib/action";
import { designSchema } from "./validators";
import { resolveDesign } from "./types";

export async function saveDesign(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("design/save", async () => {
    const { shop } = await requireSection(asLocale(lang), "storeDesign");
    const parsed = designSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    // The theme is chosen in the Theme Store: keep it
    const theme = resolveDesign(shop.design).theme;
    await db
      .update(schema.shops)
      .set({ ...parsed.data, design: { ...parsed.data.design, theme } })
      .where(eq(schema.shops.id, shop.id));
    refresh();
    return { ok: true };
  });
}
