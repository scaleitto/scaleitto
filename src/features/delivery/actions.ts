"use server";

import { and, eq, ne, or } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { newId, requireSection } from "@/server/auth/context";
import { safeAction } from "@/server/errors";
import { encryptJson } from "@/server/crypto";
import { asLocale } from "@/i18n";
import { wilayas } from "@/lib/wilayas";
import { fieldErrorsFrom } from "@/lib/validation";
import type { ActionState } from "@/lib/action";
import { applyOrderStatus } from "@/features/orders/transition";
import { canTouchOrder, viewerOf, visibleOrders } from "@/features/orders/access";
import { carrierClient } from "./platforms";
import type { Credentials } from "./platforms/types";
import { findCarrier, normalizeEcotrackUrl, platformFields } from "./carriers";
import { parseParcelOptions } from "./parcel";
import { trackShipment } from "./tracking";
import { sendParcel } from "./send";
import { cleanManifest, resolveDelivery, resolveManifest } from "./settings";

// ─── Delivery company accounts ────────────────────────────

const connectSchema = z.object({
  carrier: z.string().max(40),
  baseUrl: z.string().trim().max(255).optional().default(""),
  originWilaya: z.coerce.number().int().refine((c) => wilayas.some((w) => w.code === c), "e:invalid"),
  apiId: z.string().trim().max(500).optional(),
  apiToken: z.string().trim().max(2000).optional(),
  token: z.string().trim().max(2000).optional(),
  key: z.string().trim().max(500).optional(),
  userGuid: z.string().trim().max(200).optional(),
  tenantId: z.string().trim().max(200).optional(),
  apiKey: z.string().trim().max(2000).optional(),
});

export async function connectCarrier(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("delivery/connect", async () => {
    const { shop } = await requireSection(asLocale(lang), "delivery");
    const parsed = connectSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const d = parsed.data;
    const info = findCarrier(d.carrier);
    if (!info?.platform) return { ok: false, error: "invalid" };

    const baseUrl = info.baseUrl ?? normalizeEcotrackUrl(d.baseUrl);
    if (!baseUrl) return { ok: false, error: "checkFields", fieldErrors: { baseUrl: "carrierUrl" } };

    const credentials: Credentials = {};
    const fieldErrors: Record<string, string> = {};
    for (const field of platformFields[info.platform]) {
      if (d[field]) credentials[field] = d[field];
      else fieldErrors[field] = "required";
    }
    if (Object.keys(fieldErrors).length) return { ok: false, error: "checkFields", fieldErrors };

    // Never save keys that the company refuses.
    try {
      if (!(await carrierClient(info.platform, baseUrl, credentials).test())) return { ok: false, error: "carrierAuth" };
    } catch (err) {
      return { ok: false, error: "carrierUnreachable", message: err instanceof Error ? err.message : String(err) };
    }

    const hasDefault = await db.$count(schema.carrierAccounts, and(eq(schema.carrierAccounts.shopId, shop.id), eq(schema.carrierAccounts.isDefault, true), ne(schema.carrierAccounts.carrier, info.key)));
    const values = { platform: info.platform, baseUrl, credentials: encryptJson(credentials), originWilaya: d.originWilaya };
    await db
      .insert(schema.carrierAccounts)
      .values({ id: newId(), shopId: shop.id, carrier: info.key, isDefault: hasDefault === 0, ...values })
      .onDuplicateKeyUpdate({ set: values });
    refresh();
    return { ok: true };
  });
}

export async function disconnectCarrier(lang: string, accountId: string): Promise<ActionState> {
  return safeAction("delivery/disconnect", async () => {
    const { shop } = await requireSection(asLocale(lang), "delivery");
    await db.delete(schema.carrierAccounts).where(and(eq(schema.carrierAccounts.shopId, shop.id), eq(schema.carrierAccounts.id, accountId)));
    refresh();
    return { ok: true };
  });
}

export async function setDefaultCarrier(lang: string, accountId: string): Promise<ActionState> {
  return safeAction("delivery/default", async () => {
    const { shop } = await requireSection(asLocale(lang), "delivery");
    await db.transaction(async (tx) => {
      await tx.update(schema.carrierAccounts).set({ isDefault: false }).where(eq(schema.carrierAccounts.shopId, shop.id));
      await tx.update(schema.carrierAccounts).set({ isDefault: true }).where(and(eq(schema.carrierAccounts.shopId, shop.id), eq(schema.carrierAccounts.id, accountId)));
    });
    refresh();
    return { ok: true };
  });
}

// ─── Shipments (from the order page) ──────────────────────

// Sends a confirmed order to a connected delivery company and marks it as shipping. Used one order at a time by the
// order page and by the bulk send (the browser sends the selected orders one by one and shows each result).
// `options` = this send's parcel options (type, fragile, weight…), over the company's saved defaults.
export async function sendToCarrier(lang: string, orderId: string, accountId: string, options?: unknown): Promise<ActionState> {
  return safeAction("delivery/send", async () => {
    const ctx = await requireSection(asLocale(lang), "orders");
    if (!(await canTouchOrder(viewerOf(ctx), orderId))) return { ok: false, error: "notFound" };
    const result = await sendParcel(ctx.shop.id, orderId, accountId, options, ctx.user.id);
    if (result.ok) refresh();
    return result;
  });
}

// The starting options of every parcel sent with this account (type, fragile, weight, note)
export async function saveCarrierDefaults(lang: string, accountId: string, options: unknown): Promise<ActionState> {
  return safeAction("delivery/defaults", async () => {
    const { shop } = await requireSection(asLocale(lang), "delivery");
    const o = parseParcelOptions(options);
    await db
      .update(schema.carrierAccounts)
      .set({ options: { kind: o.kind, fragile: o.fragile, weight: o.weight, note: o.note } })
      .where(and(eq(schema.carrierAccounts.shopId, shop.id), eq(schema.carrierAccounts.id, accountId)));
    refresh();
    return { ok: true };
  });
}


// Asks the delivery company where the parcel is; a delivered/returned parcel closes the order.
// Used one order at a time by the bulk "update stages" of the orders list.
export async function refreshTracking(lang: string, orderId: string): Promise<ActionState> {
  return safeAction("delivery/track", async () => {
    const ctx = await requireSection(asLocale(lang), "orders");
    const { shop, user } = ctx;
    if (!(await canTouchOrder(viewerOf(ctx), orderId))) return { ok: false, error: "notFound" };
    const [shipment] = await db.select().from(schema.shipments).where(and(eq(schema.shipments.shopId, shop.id), eq(schema.shipments.orderId, orderId)));
    if (!shipment?.carrierAccountId) return { ok: false, error: "notFound" };
    let status;
    try {
      status = await trackShipment(shipment, user.id);
    } catch (err) {
      return { ok: false, error: "carrierUnreachable", message: err instanceof Error ? err.message : String(err) };
    }
    if (!status) return { ok: false, error: "carrierMissing" };
    refresh();
    return { ok: true, message: status };
  });
}

// ─── Scan (dispatch / recuperate) ─────────────────────────

// One scanned label: the code is a tracking number or an order number (#1001). Dispatch = a confirmed order leaves
// with the courier (in transit); recuperate = a parcel coming back is received (returned, pieces back in stock).
export async function scanParcel(lang: string, mode: "dispatch" | "recuperate", rawCode: string): Promise<ActionState & { number?: number }> {
  return safeAction("delivery/scan", async () => {
    const ctx = await requireSection(asLocale(lang), "scan");
    const { shop, user } = ctx;
    const code = rawCode.trim().replace(/^#/, "").slice(0, 80);
    if (!code) return { ok: false, error: "notFound" };
    const o = schema.orders;
    const [found] = await db
      .select({ id: o.id, number: o.number, status: o.status, shipmentId: schema.shipments.id, received: schema.shipments.returnReceivedAt, carrier: schema.shipments.carrierName, tracking: schema.shipments.trackingNumber })
      .from(o)
      .leftJoin(schema.shipments, eq(schema.shipments.orderId, o.id))
      .where(and(visibleOrders(viewerOf(ctx)), or(eq(schema.shipments.trackingNumber, code), /^\d+$/.test(code) ? eq(o.number, Number(code)) : undefined)))
      .limit(1);
    if (!found || !(await canTouchOrder(viewerOf(ctx), found.id))) return { ok: false, error: "notFound" };
    if (mode === "dispatch") {
      if (found.status === "in_transit") return { ok: false, error: "already", number: found.number };
      if (found.status !== "confirmed") return { ok: false, error: "notConfirmed", number: found.number };
      await db.transaction((tx) => applyOrderStatus(tx, shop.id, found.id, "in_transit", user.id, "⌁"));
    } else {
      if (found.received || (found.status === "returned" && !found.shipmentId)) return { ok: false, error: "already", number: found.number };
      if (found.status !== "in_transit" && found.status !== "returned") return { ok: false, error: "notReturned", number: found.number };
      await db.transaction(async (tx) => {
        if (found.status !== "returned") await applyOrderStatus(tx, shop.id, found.id, "returned", user.id, "⌁");
        if (found.shipmentId) {
          await tx.update(schema.shipments).set({ returnReceivedAt: new Date() }).where(eq(schema.shipments.id, found.shipmentId));
          await tx.insert(schema.orderEvents).values({ id: newId(), orderId: found.id, shopId: shop.id, userId: user.id, type: "note", note: `↩ ${found.carrier} ${found.tracking}` });
        }
      });
    }
    return { ok: true, number: found.number };
  });
}

// ─── General settings (on/off, options) and the companies page's automatic send ─────

export async function saveDeliverySettings(lang: string, input: unknown): Promise<ActionState> {
  return safeAction("delivery/settings", async () => {
    const { shop } = await requireSection(asLocale(lang), "delivery");
    const [row] = await db.select({ delivery: schema.shops.delivery }).from(schema.shops).where(eq(schema.shops.id, shop.id));
    const current = resolveDelivery(row?.delivery);
    const next = resolveDelivery({ ...current, ...(input && typeof input === "object" ? input : {}) });
    if (next.options.some((o) => !o.name)) return { ok: false, error: "deliveryName" };
    if (next.options.some((o) => o.pricing === "wilaya" && o.rates && !Object.keys(o.rates).length)) return { ok: false, error: "deliveryRates" };
    await db.update(schema.shops).set({ delivery: next }).where(eq(schema.shops.id, shop.id));
    refresh();
    return { ok: true };
  });
}

// ─── Handover manifest template: saved as a draft, printed once published ─────

export async function saveManifest(lang: string, input: unknown, publish: boolean): Promise<ActionState> {
  return safeAction("delivery/manifest", async () => {
    const { shop } = await requireSection(asLocale(lang), "delivery");
    const draft = cleanManifest(input);
    const [row] = await db.select({ manifest: schema.shops.manifest }).from(schema.shops).where(eq(schema.shops.id, shop.id));
    const current = resolveManifest(row?.manifest);
    await db
      .update(schema.shops)
      .set({ manifest: { draft, published: publish ? draft : current.published } })
      .where(eq(schema.shops.id, shop.id));
    refresh();
    return { ok: true };
  });
}
