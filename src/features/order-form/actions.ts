"use server";

import { and, eq, inArray, notInArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, schema } from "@/server/db";
import { newId, requireSection } from "@/server/auth/context";
import { safeAction } from "@/server/errors";
import { asLocale } from "@/i18n";
import type { ActionState } from "@/lib/action";
import { resolveForm } from "@/features/landing/types";

const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && /^[\w-]{36}$/.test(x)).slice(0, 500) : []);

// The store's order form (templateId null) or one template's
export async function saveOrderForm(lang: string, templateId: string | null, form: unknown): Promise<ActionState> {
  return safeAction("order-form/save", async () => {
    const { shop } = await requireSection(asLocale(lang), "orderForm");
    if (templateId) {
      const [res] = await db.update(schema.formTemplates).set({ form: resolveForm(form) }).where(and(eq(schema.formTemplates.shopId, shop.id), eq(schema.formTemplates.id, templateId)));
      if (!res.affectedRows) return { ok: false, error: "notFound" };
    } else {
      await db.update(schema.shops).set({ orderForm: resolveForm(form) }).where(eq(schema.shops.id, shop.id));
    }
    refresh();
    return { ok: true };
  });
}

// A new template (starting from the form being edited) and the products that use it
export async function createTemplate(lang: string, name: string, productIds: unknown, form: unknown): Promise<ActionState> {
  return safeAction("order-form/template-create", async () => {
    const { shop } = await requireSection(asLocale(lang), "orderForm");
    const clean = name.trim().slice(0, 80);
    if (clean.length < 2) return { ok: false, error: "checkFields", fieldErrors: { name: "tooShort" } };
    if ((await db.$count(schema.formTemplates, eq(schema.formTemplates.shopId, shop.id))) >= 30) return { ok: false, error: "tooMany" };
    const id = newId();
    await db.transaction(async (tx) => {
      await tx.insert(schema.formTemplates).values({ id, shopId: shop.id, name: clean, form: resolveForm(form) });
      const list = ids(productIds);
      if (list.length) await tx.update(schema.products).set({ formTemplateId: id }).where(and(eq(schema.products.shopId, shop.id), inArray(schema.products.id, list)));
    });
    refresh();
    return { ok: true, message: id };
  });
}

// Which products use a template (the others go back to the store's form) and its name
export async function updateTemplate(lang: string, templateId: string, name: string, productIds: unknown): Promise<ActionState> {
  return safeAction("order-form/template-assign", async () => {
    const { shop } = await requireSection(asLocale(lang), "orderForm");
    const clean = name.trim().slice(0, 80);
    if (clean.length < 2) return { ok: false, error: "checkFields", fieldErrors: { name: "tooShort" } };
    const found = await db.$count(schema.formTemplates, and(eq(schema.formTemplates.shopId, shop.id), eq(schema.formTemplates.id, templateId)));
    if (!found) return { ok: false, error: "notFound" };
    const list = ids(productIds);
    const p = schema.products;
    await db.transaction(async (tx) => {
      await tx.update(schema.formTemplates).set({ name: clean }).where(eq(schema.formTemplates.id, templateId));
      await tx.update(p).set({ formTemplateId: null }).where(and(eq(p.shopId, shop.id), eq(p.formTemplateId, templateId), list.length ? notInArray(p.id, list) : undefined));
      if (list.length) await tx.update(p).set({ formTemplateId: templateId }).where(and(eq(p.shopId, shop.id), inArray(p.id, list)));
    });
    refresh();
    return { ok: true };
  });
}

export async function deleteTemplate(lang: string, templateId: string): Promise<ActionState> {
  return safeAction("order-form/template-delete", async () => {
    const { shop } = await requireSection(asLocale(lang), "orderForm");
    await db.transaction(async (tx) => {
      await tx.update(schema.products).set({ formTemplateId: null }).where(and(eq(schema.products.shopId, shop.id), eq(schema.products.formTemplateId, templateId)));
      await tx.update(schema.landingPages).set({ formTemplateId: null }).where(and(eq(schema.landingPages.shopId, shop.id), eq(schema.landingPages.formTemplateId, templateId)));
      await tx.delete(schema.formTemplates).where(and(eq(schema.formTemplates.shopId, shop.id), eq(schema.formTemplates.id, templateId)));
    });
    refresh();
    return { ok: true };
  });
}
