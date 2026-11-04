"use server";

import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { safeAction } from "@/server/errors";
import type { ActionState } from "@/lib/action";
import { fieldErrorsFrom } from "@/lib/validation";
import { resolveApps } from "@/features/apps/settings";
import { withPromotions } from "@/features/promotions/apply";
import { linePrice, resolveWholesale } from "@/features/checkout/pricing";
import { checkContact, orderInputSchema } from "@/features/checkout/validators";
import { storeForm } from "@/features/order-form/resolve";
import { MAX_CART_LINES, placeCartOrder } from "@/features/checkout/place-order";
import { scheduleOrderEvents } from "@/features/pixels/server";
import { offered } from "@/features/products/variants";
import { scheduleWhatsApp } from "@/features/whatsapp/queue";
import { scheduleOrderSync } from "@/features/apps/sync";
import { getShopBySlug, storeBase } from "./queries";
import { liveMethods, startOnlinePayment } from "@/features/payments/flow";
import { clientIp } from "@/server/client-ip";

const items = z
  .array(z.object({ productId: z.string().uuid(), variantId: z.string().uuid().nullable(), quantity: z.number().int().min(1).max(1000) }))
  .max(MAX_CART_LINES);

// The cart as the store sells it now: each line priced on the server (promotion, wholesale tier, offer)
export async function priceCart(slug: string, raw: unknown) {
  const shop = await getShopBySlug(slug);
  const parsed = items.safeParse(raw);
  if (!shop || !resolveApps(shop.apps).cart || !parsed.success || !parsed.data.length) return [];
  const apps = resolveApps(shop.apps);
  const ids = [...new Set(parsed.data.map((i) => i.productId))];
  const found = await db.select().from(schema.products).where(and(eq(schema.products.shopId, shop.id), inArray(schema.products.id, ids), eq(schema.products.status, "active")));
  const variants = found.length ? await db.select().from(schema.productVariants).where(and(eq(schema.productVariants.shopId, shop.id), inArray(schema.productVariants.productId, ids))) : [];
  const priced = await withPromotions(
    shop.id,
    found.map((p) => ({ ...p, variants: offered(p.options, variants.filter((v) => v.productId === p.id)) })),
  );
  const base = await storeBase(shop.slug);
  return parsed.data.map((i) => {
    const p = priced.find((x) => x.id === i.productId);
    const v = p?.variants.find((x) => x.id === i.variantId) ?? null;
    if (!p || (p.variants.length > 0 && !v)) return { ...i, available: false as const, name: "", variantTitle: null, image: null, href: "", unitPrice: 0, total: 0 };
    const line = linePrice(v?.price ?? p.price, i.quantity, p.offers, apps.wholesale ? resolveWholesale(p.wholesale) : null);
    return { ...i, available: true as const, name: p.name, variantTitle: v?.title ?? null, image: p.images[0] ?? null, href: `${base}/p/${p.slug}`, unitPrice: line.unitPrice, total: line.total };
  });
}
export type PricedLine = Awaited<ReturnType<typeof priceCart>>[number];

// The cart's order: one order with every line (Apps → Shopping cart)
export async function submitCart(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const shop = await getShopBySlug(slug);
  if (!shop || !resolveApps(shop.apps).cart) return { ok: false, error: "unavailable" };
  const result = await safeAction("store/cart", async () => {
    let cart: unknown;
    try {
      cart = JSON.parse(String(formData.get("items") ?? "[]"));
    } catch {
      return { ok: false, error: "invalid" };
    }
    const lines = items.safeParse(cart);
    if (!lines.success || !lines.data.length) return { ok: false, error: "invalid" };
    const parsed = orderInputSchema.safeParse({ ...Object.fromEntries(formData), quantity: "1", variantId: "" });
    const form = storeForm(shop);
    const fieldErrors: Record<string, string> = parsed.success ? {} : fieldErrorsFrom(parsed.error);
    const contact = checkContact(form, { name: String(formData.get("name") ?? "").trim(), commune: String(formData.get("commune") ?? "").trim(), wilaya: Number(formData.get("wilaya")) || 0 }, fieldErrors);
    const deliveryType = String(formData.get("deliveryType") ?? "");
    if (form.delivery !== "both" && deliveryType !== form.delivery) fieldErrors.deliveryType = "deliveryType";
    if (form.address === "required" && deliveryType === "home" && !String(formData.get("address") ?? "").trim()) fieldErrors.address = "address";
    if (!parsed.success || Object.keys(fieldErrors).length) return { ok: false, error: "checkFields", fieldErrors };
    if (parsed.data.website) return { ok: false, error: "unexpected" };
    const input = { ...parsed.data, ...contact, address: form.address === "hidden" ? "" : parsed.data.address };
    // A product sold with online payment only cannot be paid on delivery
    const ids = [...new Set(lines.data.map((l) => l.productId))];
    const cardOnly = (await db.select({ id: schema.products.id }).from(schema.products).where(and(eq(schema.products.shopId, shop.id), inArray(schema.products.id, ids), eq(schema.products.cardOnly, true)))).length > 0;
    if (cardOnly && !(await liveMethods(shop.id)).includes(String(formData.get("payment") ?? "cod") as never)) return { ok: false, error: "cardOnly" };
    const h = await headers();
    const ip = clientIp(h);
    const c = await cookies();
    const placed = await placeCartOrder(shop, lines.data, input, { ip, userAgent: h.get("user-agent"), captcha: String(formData.get("cf-turnstile-response") ?? "") || null, tracking: { url: h.get("referer")?.slice(0, 500) || undefined, fbp: c.get("_fbp")?.value, fbc: c.get("_fbc")?.value } });
    if (!placed.ok) return { ok: false, error: placed.error };
    scheduleOrderEvents(shop.id, placed.orderId, "placed");
    await scheduleOrderSync(shop.id, placed.orderId, "order.created");
    // Apps → WhatsApp confirmation: the buyer is asked to confirm
    await scheduleWhatsApp(shop.id, placed.orderId, "confirm");
    return { ok: true, message: placed.orderId };
  });
  if (result.ok && result.message) {
    if (String(formData.get("payment") ?? "cod") !== "cod") {
      const url = await startOnlinePayment(shop, result.message, String(formData.get("payment")));
      if (url) redirect(url);
    }
    redirect(`${await storeBase(shop.slug)}/thanks?o=${result.message}&cart=1`);
  }
  return result;
}
