import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { resolveForm } from "@/features/landing/types";

// The one order form system: every form (store product page, landing page, embedded form) is the store's form or one of
// its templates. The first template given that exists wins (landing page's choice, then the product's), else the store's.
export async function formFor(shop: { id: string; orderForm: unknown }, ...templateIds: (string | null | undefined)[]) {
  for (const id of templateIds) {
    if (!id) continue;
    const [tpl] = await db.select({ form: schema.formTemplates.form }).from(schema.formTemplates).where(and(eq(schema.formTemplates.shopId, shop.id), eq(schema.formTemplates.id, id)));
    if (tpl) return resolveForm(tpl.form);
  }
  return resolveForm(shop.orderForm);
}

// The order form of a product page: the product's template, else the store's form
export const productForm = (shop: { id: string; orderForm: unknown }, templateId: string | null | undefined) => formFor(shop, templateId);
