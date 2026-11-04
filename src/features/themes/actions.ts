"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, schema } from "@/server/db";
import { requireSection } from "@/server/auth/context";
import { safeAction } from "@/server/errors";
import { asLocale } from "@/i18n";
import type { ActionState } from "@/lib/action";
import { themes } from "./themes";

// Activates a theme. The merchant can keep their own main color or take the theme's.
export async function applyTheme(lang: string, key: string, keepColor: boolean): Promise<ActionState> {
  return safeAction("themes/apply", async () => {
    const { shop } = await requireSection(asLocale(lang), "themes");
    const theme = themes.find((t) => t.key === key);
    if (!theme) return { ok: false, error: "invalid" };
    await db
      .update(schema.shops)
      .set({ design: { ...(shop.design && typeof shop.design === "object" ? (shop.design as Record<string, unknown>) : {}), theme: theme.key }, ...(keepColor ? {} : { primaryColor: theme.color }) })
      .where(eq(schema.shops.id, shop.id));
    refresh();
    return { ok: true };
  });
}
