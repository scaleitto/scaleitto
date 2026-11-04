import { apiJson, preflight, withStore } from "@/features/storefront/api";
import { checkContact, orderInputSchema } from "@/features/checkout/validators";
import { placeOrder } from "@/features/checkout/place-order";
import { storeForm } from "@/features/order-form/resolve";
import { fieldErrorsFrom } from "@/lib/validation";
import { logError } from "@/server/errors";
import { scheduleOrderEvents } from "@/features/pixels/server";
import { scheduleOrderSync } from "@/features/apps/sync";
import { scheduleWhatsApp } from "@/features/whatsapp/queue";

// POST /api/storefront/v1/<store>/orders — a cash-on-delivery order from the merchant's own storefront. JSON body:
// { productId, variantId?, quantity, name, phone, wilaya, commune, address?, deliveryType: "home" | "office", note?, captcha?,
// userAgent? (the buyer's browser, when the order is sent from the merchant's server) }
// The same checks as the store's form: checkout fields, fake-order protection, stock, plan quota.
export async function POST(req: Request, { params }: RouteContext<"/api/storefront/v1/[store]/orders">) {
  const { store } = await params;
  return withStore(req, store, async (shop, headers) => {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return apiJson({ error: "invalid_json" }, 400, headers);
    }
    const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));
    const parsed = orderInputSchema.safeParse({ ...Object.fromEntries(Object.entries(body).map(([k, v]) => [k, str(v)])), quantity: str(body.quantity ?? 1) });
    const form = storeForm(shop);
    const fields: Record<string, string> = parsed.success ? {} : fieldErrorsFrom(parsed.error);
    const contact = checkContact(form, { name: str(body.name).trim(), commune: str(body.commune).trim(), wilaya: Number(body.wilaya) || 0 }, fields);
    if (form.delivery !== "both" && str(body.deliveryType) !== form.delivery) fields.deliveryType = "deliveryType";
    if (!parsed.success || Object.keys(fields).length) return apiJson({ error: "invalid_fields", fields }, 422, headers);
    const productId = str(body.productId);
    if (!/^[\w-]{1,36}$/.test(productId)) return apiJson({ error: "invalid_fields", fields: { productId: "invalid" } }, 422, headers);
    try {
      const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || null;
      const input = { ...parsed.data, ...contact, address: form.address === "hidden" ? "" : parsed.data.address, note: form.note ? parsed.data.note : "", fill: parsed.data.fill ?? 30 };
      const placed = await placeOrder(shop, productId, input, { ip, userAgent: str(body.userAgent).slice(0, 300) || req.headers.get("user-agent"), captcha: str(body.captcha) || null, extra: [{ label: "API", value: req.headers.get("origin") ?? "server" }] });
      if (!placed.ok) return apiJson({ error: placed.error }, 422, headers);
      scheduleOrderEvents(shop.id, placed.orderId, "placed");
      await scheduleOrderSync(shop.id, placed.orderId, "order.created");
      await scheduleWhatsApp(shop.id, placed.orderId, "confirm");
      return apiJson({ order: { id: placed.orderId, number: placed.number } }, 201, headers);
    } catch (err) {
      await logError("storefront-api/order", err);
      return apiJson({ error: "unexpected" }, 500, headers);
    }
  });
}

export async function OPTIONS(req: Request, { params }: RouteContext<"/api/storefront/v1/[store]/orders">) {
  return preflight(req, (await params).store);
}
