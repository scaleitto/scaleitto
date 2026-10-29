"use server";

import { and, eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { requireSection } from "@/server/auth/context";
import { safeAction } from "@/server/errors";
import { asLocale } from "@/i18n";
import { fieldErrorsFrom } from "@/lib/validation";
import type { ActionState } from "@/lib/action";
import { logStock } from "./movements";

const adjustSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional().or(z.literal("")),
  reason: z.enum(["restock", "adjust", "damaged"]),
  // restock = units added; damaged = units removed; adjust = the counted quantity (the stock is set to it)
  quantity: z.coerce.number({ error: "e:invalid" }).int("e:invalid").min(0, "e:invalid").max(1_000_000, "e:invalid"),
  note: z.string().trim().max(200, "e:tooLong").optional().default(""),
});

// A stock change typed in the Inventory section, written to the history with its reason
export async function adjustStock(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("inventory/adjust", async () => {
    const { shop, user } = await requireSection(asLocale(lang), "inventory");
    const parsed = adjustSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const d = parsed.data;
    const variantId = d.variantId || null;
    const done = await db.transaction(async (tx) => {
      const table = variantId ? schema.productVariants : schema.products;
      const [row] = variantId
        ? await tx.select({ stock: schema.productVariants.stock }).from(schema.productVariants).where(and(eq(schema.productVariants.shopId, shop.id), eq(schema.productVariants.productId, d.productId), eq(schema.productVariants.id, variantId))).for("update")
        : await tx.select({ stock: schema.products.stock }).from(schema.products).where(and(eq(schema.products.shopId, shop.id), eq(schema.products.id, d.productId))).for("update");
      if (!row) return false;
      const next = d.reason === "restock" ? row.stock + d.quantity : d.reason === "damaged" ? Math.max(0, row.stock - d.quantity) : d.quantity;
      await tx.update(table).set({ stock: sql`${next}` }).where(eq(table.id, variantId ?? d.productId));
      await logStock(tx, [{ shopId: shop.id, productId: d.productId, variantId, delta: next - row.stock, reason: d.reason, note: d.note || null, userId: user.id }]);
      return true;
    });
    if (!done) return { ok: false, error: "notFound" };
    refresh();
    return { ok: true };
  });
}

export async function setLowStock(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("inventory/low", async () => {
    const { shop } = await requireSection(asLocale(lang), "inventory");
    const n = z.coerce.number().int().min(0).max(10_000).safeParse(formData.get("lowStock"));
    if (!n.success) return { ok: false, error: "checkFields", fieldErrors: { lowStock: "invalid" } };
    await db.update(schema.shops).set({ lowStock: n.data }).where(eq(schema.shops.id, shop.id));
    refresh();
    return { ok: true };
  });
}
