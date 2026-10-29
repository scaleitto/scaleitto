import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { resolveForm } from "@/features/landing/types";

// The order form of a product page: the product's template, else the store's form
export async function productForm(shop: { id: string; orderForm: unknown }, templateId: string | null | undefined) {
  if (templateId) {
    const [tpl] = await db.select({ form: schema.formTemplates.form }).from(schema.formTemplates).where(and(eq(schema.formTemplates.shopId, shop.id), eq(schema.formTemplates.id, templateId)));
    if (tpl) return resolveForm(tpl.form);
  }
  return resolveForm(shop.orderForm);
}
