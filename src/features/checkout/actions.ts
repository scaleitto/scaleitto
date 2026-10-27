"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gte, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { newId } from "@/server/auth/context";
import { logError, safeAction } from "@/server/errors";
import { fieldErrorsFrom } from "@/lib/validation";
import { isValidDzPhone, normalizePhone } from "@/lib/phone";
import { wilayas } from "@/lib/wilayas";
import type { ActionState } from "@/lib/action";
import { getShopBySlug, storeBase } from "@/features/storefront/queries";
import { orderInputSchema } from "./validators";
import { MAX_QUANTITY } from "./pricing";
import { defaultForm, resolveForm } from "@/features/landing/types";
import { placeOrder } from "./place-order";
import { MAX_LEADS_PER_IP_PER_HOUR, leadsFromIpLastHour } from "./protection";

async function requestMeta() {
  const h = await headers();
  return { ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null, userAgent: h.get("user-agent") };
}

// The settings of a published landing page form, or null.
async function landingForm(shopId: string, landingPageId: string, productId: string) {
  const [page] = await db
    .select({ form: schema.landingPages.form })
    .from(schema.landingPages)
    .where(and(eq(schema.landingPages.shopId, shopId), eq(schema.landingPages.id, landingPageId), eq(schema.landingPages.productId, productId), eq(schema.landingPages.status, "published")));
  return page ? resolveForm(page.form) : null;
}

// The customer's order form (store product page, landing page or embedded form).
// Errors are keys of the storefront strings.
export async function submitOrder(slug: string, productId: string, landingPageId: string | null, embedded: boolean, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const shop = await getShopBySlug(slug);
  if (!shop) return { ok: false, error: "unavailable" };
  const result = await safeAction("store/order", async () => {
    const parsed = orderInputSchema.safeParse(Object.fromEntries(formData));
    const settings = landingPageId ? await landingForm(shop.id, landingPageId, productId) : defaultForm;
    if (!settings) return { ok: false, error: "unavailable" };

    // What the landing page's form asks on top of the standard fields
    const fieldErrors: Record<string, string> = parsed.success ? {} : fieldErrorsFrom(parsed.error);
    const deliveryType = String(formData.get("deliveryType") ?? "");
    if (settings.delivery !== "both" && deliveryType !== settings.delivery) fieldErrors.deliveryType = "deliveryType";
    if (settings.address === "required" && deliveryType === "home" && !String(formData.get("address") ?? "").trim()) fieldErrors.address = "address";
    const extra: { label: string; value: string }[] = [];
    for (const c of settings.custom) {
      const value = String(formData.get(`custom_${c.id}`) ?? "").trim().slice(0, 200);
      if (c.type === "select" && value && !c.options.includes(value)) fieldErrors[`custom_${c.id}`] = "invalid";
      else if (c.required && !value) fieldErrors[`custom_${c.id}`] = "custom";
      else if (value) extra.push({ label: c.label, value });
    }
    if (!parsed.success || Object.keys(fieldErrors).length) return { ok: false, error: "checkFields", fieldErrors };
    const input = { ...parsed.data, address: settings.address === "hidden" ? "" : parsed.data.address, note: settings.note ? parsed.data.note : "" };
    // A bot filled the hidden field: pretend nothing happened.
    if (input.website) return { ok: false, error: "unexpected" };
    const placed = await placeOrder(shop, productId, input, { ...(await requestMeta()), landingPageId, extra });
    return placed.ok ? { ok: true, message: placed.orderId } : { ok: false, error: placed.error };
  });
  if (result.ok && result.message) redirect(embedded ? `/embed/${shop.slug}/thanks?o=${result.message}` : `${await storeBase(shop.slug)}/thanks?o=${result.message}`);
  return result;
}

// Saves the visitor as an abandoned cart once a valid phone is typed (updated as they fill the form).
export async function saveLead(slug: string, productId: string, input: { name?: string; phone?: string; wilaya?: number | null; variantId?: string; quantity?: number }) {
  try {
    const shop = await getShopBySlug(slug);
    const phone = normalizePhone(String(input.phone ?? ""));
    if (!shop || !isValidDzPhone(phone)) return;
    const { ip } = await requestMeta();
    const [product] = await db.select({ id: schema.products.id }).from(schema.products).where(and(eq(schema.products.shopId, shop.id), eq(schema.products.id, productId)));
    if (!product) return;
    const values = {
      name: String(input.name ?? "").trim().slice(0, 120) || null,
      wilayaCode: wilayas.some((w) => w.code === input.wilaya) ? input.wilaya! : null,
      variantId: typeof input.variantId === "string" && input.variantId.length <= 36 ? input.variantId || null : null,
      quantity: Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(Number(input.quantity) || 1))),
    };
    const [existing] = await db
      .select({ id: schema.leads.id })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.shopId, shop.id),
          eq(schema.leads.phone, phone),
          eq(schema.leads.productId, product.id),
          inArray(schema.leads.status, ["abandoned", "contacted"]),
          gte(schema.leads.createdAt, new Date(Date.now() - 86400_000)),
        ),
      );
    if (existing) {
      await db.update(schema.leads).set(values).where(eq(schema.leads.id, existing.id));
    } else if ((await leadsFromIpLastHour(shop.id, ip)) < MAX_LEADS_PER_IP_PER_HOUR) {
      await db.insert(schema.leads).values({ id: newId(), shopId: shop.id, productId: product.id, phone, ip, ...values });
    }
  } catch (err) {
    // Never bother the customer with this: it only feeds the abandoned-cart list.
    await logError("store/lead", err);
  }
}
