"use server";

import { liveMethods, startOnlinePayment } from "@/features/payments/flow";
import { resolveApps } from "@/features/apps/settings";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, count, eq, gte } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { logError, safeAction } from "@/server/errors";
import { fieldErrorsFrom } from "@/lib/validation";
import { isValidDzPhone, normalizePhone } from "@/lib/phone";
import { wilayas } from "@/lib/wilayas";
import type { ActionState } from "@/lib/action";
import { getShopBySlug, storeBase } from "@/features/storefront/queries";
import { orderInputSchema } from "./validators";
import { WHOLESALE_MAX_QUANTITY } from "./pricing";
import { customFieldValid, liveVersions, readPublished, versionSections, type VersionKey } from "@/features/landing/types";
import { productForm } from "@/features/order-form/resolve";
import { optionalChoices } from "@/features/products/variants";
import { placeOrder, saveAbandoned } from "./place-order";
import { MAX_LEADS_PER_IP_PER_HOUR } from "./protection";
import { scheduleOrderEvents } from "@/features/pixels/server";
import { scheduleWhatsApp } from "@/features/whatsapp/queue";
import { scheduleOrderSync } from "@/features/apps/sync";
import type { OrderTracking } from "@/server/db/schema";

// The product's own checkout questions (Apps → Custom fields)
async function productQuestions(shopId: string, productId: string) {
  const [row] = await db.select({ customFields: schema.products.customFields, cardOnly: schema.products.cardOnly }).from(schema.products).where(and(eq(schema.products.shopId, shopId), eq(schema.products.id, productId)));
  return row ?? null;
}

// The buyer's choices for the product's optional options (written on the order like the form's extra questions)
async function chosenOptions(shopId: string, productId: string, raw: FormDataEntryValue | null) {
  let picked: Record<string, string> = {};
  try {
    const parsed = JSON.parse(String(raw ?? "{}"));
    if (parsed && typeof parsed === "object") picked = Object.fromEntries(Object.entries(parsed).filter(([k, v]) => typeof v === "string" && k.length <= 40).map(([k, v]) => [k, String(v).slice(0, 40)]));
  } catch {
    return [];
  }
  if (!Object.keys(picked).length) return [];
  const [row] = await db.select({ options: schema.products.options }).from(schema.products).where(and(eq(schema.products.shopId, shopId), eq(schema.products.id, productId)));
  return row ? optionalChoices(row.options, picked) : [];
}

async function requestMeta() {
  const h = await headers();
  return { ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null, userAgent: h.get("user-agent") };
}

// Ad-click cookies set by the pixels on the store's domain (sent again from the server with the purchase)
async function adTracking(): Promise<OrderTracking> {
  const c = await cookies();
  const get = (name: string) => c.get(name)?.value?.slice(0, 500) || undefined;
  const ga = get("_ga")?.match(/^GA\d\.\d\.(\d+\.\d+)$/)?.[1];
  return { url: (await headers()).get("referer")?.slice(0, 500) || undefined, fbp: get("_fbp"), fbc: get("_fbc"), ttp: get("_ttp"), ttclid: get("sc_ttclid"), scClickId: get("sc_sccid"), scCookie: get("_scid"), gaClientId: ga };
}

// A published landing page: its form (the store's) and whether the version
// the visitor saw ends with a thank-you window (then the visitor comes back to the page instead of the thanks page)
async function landingOf(shop: { id: string; orderForm: unknown; apps: unknown }, landing: { id: string; version: string }, productId: string) {
  const [page] = await db
    .select({ slug: schema.landingPages.slug, published: schema.landingPages.published })
    .from(schema.landingPages)
    .where(and(eq(schema.landingPages.shopId, shop.id), eq(schema.landingPages.id, landing.id), eq(schema.landingPages.productId, productId), eq(schema.landingPages.status, "published")));
  if (!page) return null;
  const published = readPublished(page.published);
  const version = published && liveVersions(published).includes(landing.version as VersionKey) ? (landing.version as VersionKey) : "A";
  const popup = published ? versionSections(published, version).some((s) => s.type === "thankYou" && !s.hidden) : false;
  return { settings: productForm(shop, await productQuestions(shop.id, productId)), slug: page.slug, version, popup };
}

// The customer's order form (store product page, landing page or embedded form).
// Errors are keys of the storefront strings.
// landing: the landing page and the version the visitor saw (A, B, C)
export async function submitOrder(slug: string, productId: string, landing: { id: string; version: string } | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const shop = await getShopBySlug(slug);
  if (!shop) return { ok: false, error: "unavailable" };
  let page: Awaited<ReturnType<typeof landingOf>> = null;
  const result = await safeAction("store/order", async () => {
    const parsed = orderInputSchema.safeParse(Object.fromEntries(formData));
    page = landing ? await landingOf(shop, landing, productId) : null;
    const settings = landing ? page?.settings : productForm(shop, await productQuestions(shop.id, productId));
    if (!settings) return { ok: false, error: "unavailable" };

    // What the landing page's form asks on top of the standard fields
    const fieldErrors: Record<string, string> = parsed.success ? {} : fieldErrorsFrom(parsed.error);
    const deliveryType = String(formData.get("deliveryType") ?? "");
    if (settings.delivery !== "both" && deliveryType !== settings.delivery) fieldErrors.deliveryType = "deliveryType";
    if (settings.address === "required" && deliveryType === "home" && !String(formData.get("address") ?? "").trim()) fieldErrors.address = "address";
    const extra: { label: string; value: string }[] = [];
    for (const c of settings.custom) {
      const raw = String(formData.get(`custom_${c.id}`) ?? "").trim();
      // A ticked box is saved as ✓
      const value = c.type === "checkbox" ? (raw ? "✓" : "") : raw.slice(0, c.type === "textarea" ? 500 : 200);
      const valid = !value || customFieldValid(c, value);
      if (!valid) fieldErrors[`custom_${c.id}`] = "invalid";
      else if (c.required && !value) fieldErrors[`custom_${c.id}`] = "custom";
      else if (value) extra.push({ label: c.label, value });
    }
    if (!parsed.success || Object.keys(fieldErrors).length) return { ok: false, error: "checkFields", fieldErrors };
    extra.unshift(...(await chosenOptions(shop.id, productId, formData.get("choices"))));
    // Online payment only: no cash on delivery, and the store must take cards
    // Online payment only: no cash on delivery, and the chosen method must be one the store really takes
    const payment = String(formData.get("payment") ?? "cod");
    if ((await productQuestions(shop.id, productId))?.cardOnly && !(await liveMethods(shop.id)).includes(payment as never)) return { ok: false, error: "cardOnly" };
    const input = { ...parsed.data, address: settings.address === "hidden" ? "" : parsed.data.address, note: settings.note ? parsed.data.note : "" };
    // A bot filled the hidden field: pretend nothing happened.
    if (input.website) return { ok: false, error: "unexpected" };
    const placed = await placeOrder(shop, productId, input, { ...(await requestMeta()), captcha: String(formData.get("cf-turnstile-response") ?? "") || null, landingPageId: landing?.id ?? null, landingVersion: page?.version ?? null, extra, tracking: await adTracking() });
    if (!placed.ok) return { ok: false, error: placed.error };
    scheduleOrderEvents(shop.id, placed.orderId, "placed");
    await scheduleOrderSync(shop.id, placed.orderId, "order.created");
    // Apps → WhatsApp confirmation: the buyer is asked to confirm
    await scheduleWhatsApp(shop.id, placed.orderId, "confirm");
    return { ok: true, message: placed.orderId };
  });
  const shown = page as Awaited<ReturnType<typeof landingOf>>;
  if (result.ok && result.message) {
    // Pay by card (Apps → Online payments): to the gateway's page; it sends the buyer back to the thank-you page
    if (String(formData.get("payment") ?? "cod") !== "cod") {
      const url = await startOnlinePayment(shop, result.message, String(formData.get("payment")));
      if (url) redirect(url);
    }
    // The page's thank-you window: back to the same page, which shows it
    if (shown?.popup) redirect(`${await storeBase(shop.slug)}/lp/${encodeURIComponent(shown.slug)}?thanks=${result.message}`);
    redirect(`${await storeBase(shop.slug)}/thanks?o=${result.message}`);
  }
  return result;
}

// Saves the visitor as an abandoned cart once a valid phone is typed (updated as they fill the form).
export async function saveLead(slug: string, productId: string, input: { name?: string; phone?: string; wilaya?: number | null; variantId?: string; quantity?: number }) {
  try {
    const shop = await getShopBySlug(slug);
    const phone = normalizePhone(String(input.phone ?? ""));
    // Apps → Abandoned orders switched off: no drafts
    if (!shop || !isValidDzPhone(phone) || !resolveApps(shop.apps).abandoned) return;
    const { ip } = await requestMeta();
    const [product] = await db.select({ id: schema.products.id }).from(schema.products).where(and(eq(schema.products.shopId, shop.id), eq(schema.products.id, productId)));
    if (!product) return;
    // A few drafts per connection and hour at most (robots typing phones)
    const o = schema.orders;
    const [recent] = ip ? await db.select({ n: count() }).from(o).where(and(eq(o.shopId, shop.id), eq(o.ip, ip), eq(o.status, "abandoned"), gte(o.createdAt, new Date(Date.now() - 3600_000)))) : [{ n: 0 }];
    if (recent.n >= MAX_LEADS_PER_IP_PER_HOUR) return;
    await saveAbandoned(
      shop.id,
      product.id,
      {
        name: String(input.name ?? "").trim().slice(0, 120),
        phone,
        wilaya: wilayas.some((w) => w.code === input.wilaya) ? input.wilaya! : null,
        variantId: typeof input.variantId === "string" && input.variantId.length <= 36 ? input.variantId || null : null,
        quantity: Math.min(WHOLESALE_MAX_QUANTITY, Math.max(1, Math.trunc(Number(input.quantity) || 1))),
      },
      ip,
    );
  } catch (err) {
    // Never bother the customer with this: it only feeds the abandoned-cart list.
    await logError("store/lead", err);
  }
}
