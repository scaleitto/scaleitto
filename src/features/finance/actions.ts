"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { newId, requireSection } from "@/server/auth/context";
import { safeAction } from "@/server/errors";
import { asLocale } from "@/i18n";
import { fieldErrorsFrom } from "@/lib/validation";
import type { ActionState } from "@/lib/action";
import { algeriaParts } from "@/lib/time";
import { expenseCategories } from "@/server/db/schema";

// The courier paid the cash of this delivered order (Finance → money to collect), one order per request
export async function markPaid(lang: string, orderId: string): Promise<ActionState> {
  return safeAction("finance/paid", async () => {
    const { shop } = await requireSection(asLocale(lang), "finance");
    const o = schema.orders;
    const [res] = await db
      .update(o)
      .set({ paidAt: new Date() })
      .where(and(eq(o.shopId, shop.id), eq(o.id, orderId), eq(o.status, "delivered"), isNull(o.paidAt)));
    if (!res.affectedRows) return { ok: false, error: "notFound" };
    refresh();
    return { ok: true };
  });
}

const expenseSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "e:invalid"),
  category: z.enum(expenseCategories, { error: "e:invalid" }),
  amount: z.coerce.number({ error: "e:price" }).int("e:price").min(1, "e:price").max(100_000_000, "e:price"),
  note: z.string().trim().max(200, "e:tooLong").optional().default(""),
});

export async function addExpense(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("finance/expense", async () => {
    const { shop, user } = await requireSection(asLocale(lang), "finance");
    const raw = Object.fromEntries(formData);
    const parsed = expenseSchema.safeParse({ ...raw, amount: String(raw.amount ?? "").replace(/\s/g, ""), day: raw.day || algeriaParts(new Date()).day });
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    await db.insert(schema.expenses).values({ id: newId(), shopId: shop.id, ...parsed.data, note: parsed.data.note || null, createdBy: user.id });
    refresh();
    return { ok: true };
  });
}

export async function deleteExpense(lang: string, id: string): Promise<ActionState> {
  return safeAction("finance/expense-delete", async () => {
    const { shop } = await requireSection(asLocale(lang), "finance");
    await db.delete(schema.expenses).where(and(eq(schema.expenses.shopId, shop.id), eq(schema.expenses.id, id)));
    refresh();
    return { ok: true };
  });
}
