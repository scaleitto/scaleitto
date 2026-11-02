import { resolveForm, type CustomField } from "@/features/landing/types";
import { resolveApps } from "@/features/apps/settings";

// The one order form: every form (store product page, landing page) is the store's form
export const storeForm = (shop: { orderForm: unknown }) => resolveForm(shop.orderForm);

// A product's own questions (Apps → Custom fields), cleaned like the store's; ids prefixed so they never meet the store's
export const productFields = (raw: unknown): CustomField[] => resolveForm({ custom: Array.isArray(raw) ? raw.map((c) => ({ ...(c as object), id: `p-${String((c as { id?: unknown })?.id ?? "").replace(/^p-/, "")}` })) : [] }).custom;

// The form of one product: the store's form plus the product's own fields while the Custom fields app is on
export function productForm(shop: { orderForm: unknown; apps: unknown }, product: { customFields: unknown } | null) {
  const form = storeForm(shop);
  if (!product || !resolveApps(shop.apps).customFields) return form;
  const own = productFields(product.customFields);
  return own.length ? resolveForm({ ...form, custom: [...form.custom, ...own] }) : form;
}
