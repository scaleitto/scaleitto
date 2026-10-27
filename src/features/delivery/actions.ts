"use server";

import { and, eq, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { newId, requireSection } from "@/server/auth/context";
import { safeAction } from "@/server/errors";
import { decryptJson, encryptJson } from "@/server/crypto";
import { asLocale } from "@/i18n";
import { wilayas } from "@/lib/wilayas";
import { fieldErrorsFrom } from "@/lib/validation";
import type { ActionState } from "@/lib/action";
import { applyOrderStatus } from "@/features/orders/transition";
import { canTouchOrder, viewerOf } from "@/features/orders/access";
import { carrierClient, CarrierError, type ParcelInput } from "./platforms";
import type { Credentials } from "./platforms/types";
import { findCarrier, normalizeEcotrackUrl, platformFields } from "./carriers";
import { normalizeShipmentStatus, orderStatusFor, splitName } from "./status";

const MAX_PRICE = 100_000;

// ─── Delivery prices per wilaya ───────────────────────────

export async function saveRates(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("delivery/rates", async () => {
    const { shop } = await requireSection(asLocale(lang), "delivery");
    const rows: { shopId: string; wilayaCode: number; homePrice: number | null; officePrice: number | null }[] = [];
    const fieldErrors: Record<string, string> = {};
    const read = (name: string) => {
      const raw = String(formData.get(name) ?? "").replace(/\s/g, "");
      if (raw === "") return null;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0 || n > MAX_PRICE) {
        fieldErrors[name] = "price";
        return null;
      }
      return n;
    };
    for (const w of wilayas) {
      const home = read(`home_${w.code}`);
      const office = read(`office_${w.code}`);
      if (home !== null || office !== null) rows.push({ shopId: shop.id, wilayaCode: w.code, homePrice: home, officePrice: office });
    }
    if (Object.keys(fieldErrors).length) return { ok: false, error: "checkFields", fieldErrors };
    await db.transaction(async (tx) => {
      await tx.delete(schema.shippingRates).where(eq(schema.shippingRates.shopId, shop.id));
      if (rows.length) await tx.insert(schema.shippingRates).values(rows);
    });
    refresh();
    return { ok: true };
  });
}

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

const frenchWilaya = (code: number) => wilayas.find((w) => w.code === code)?.fr ?? String(code);

// Sends a confirmed order to a connected delivery company and marks it as shipping.
export async function sendToCarrier(lang: string, orderId: string, accountId: string): Promise<ActionState> {
  return safeAction("delivery/send", async () => {
    const ctx = await requireSection(asLocale(lang), "orders");
    const { shop, user } = ctx;
    if (!(await canTouchOrder(viewerOf(ctx), orderId))) return { ok: false, error: "notFound" };
    const [order] = await db.select().from(schema.orders).where(and(eq(schema.orders.shopId, shop.id), eq(schema.orders.id, orderId)));
    if (!order) return { ok: false, error: "notFound" };
    if (order.status !== "confirmed") return { ok: false, error: "confirmFirst" };
    if (await db.$count(schema.shipments, eq(schema.shipments.orderId, orderId))) return { ok: false, error: "alreadyShipped" };
    const [account] = await db.select().from(schema.carrierAccounts).where(and(eq(schema.carrierAccounts.shopId, shop.id), eq(schema.carrierAccounts.id, accountId)));
    if (!account) return { ok: false, error: "notFound" };

    const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
    const { firstName, lastName } = splitName(order.customerName);
    const parcel: ParcelInput = {
      reference: String(order.number),
      fullName: order.customerName,
      firstName,
      lastName,
      phone: order.phone,
      wilayaCode: order.wilayaCode,
      wilayaName: frenchWilaya(order.wilayaCode),
      commune: order.commune,
      address: order.address ?? "",
      products: items.map((i) => `${i.name}${i.variantTitle ? ` (${i.variantTitle})` : ""} x${i.quantity}`).join(", "),
      codAmount: order.total,
      stopDesk: order.deliveryType === "office",
      note: order.customerNote ?? "",
      originWilayaCode: account.originWilaya,
      originWilayaName: frenchWilaya(account.originWilaya),
    };

    let created;
    try {
      created = await carrierClient(account.platform, account.baseUrl, decryptJson<Credentials>(account.credentials)).createParcel(parcel);
    } catch (err) {
      if (err instanceof CarrierError || (err instanceof Error && /fetch|timeout|abort/i.test(err.message))) return { ok: false, error: "carrierRefused", message: err.message };
      throw err;
    }

    const carrierName = findCarrier(account.carrier)?.name ?? account.carrier;
    await db.transaction(async (tx) => {
      await tx.insert(schema.shipments).values({
        id: newId(),
        shopId: shop.id,
        orderId,
        carrierAccountId: account.id,
        carrierName,
        trackingNumber: created.trackingNumber,
        labelUrl: created.labelUrl ?? null,
      });
      await applyOrderStatus(tx, shop.id, orderId, "shipped", user.id, `${carrierName}: ${created.trackingNumber}`);
    });
    refresh();
    return { ok: true };
  });
}

const manualSchema = z.object({
  carrierName: z.string().trim().min(2, "e:tooShort").max(80, "e:invalid"),
  trackingNumber: z.string().trim().min(3, "e:tooShort").max(80, "e:invalid"),
});

// For companies without an integration: the tracking number is typed by hand.
export async function addManualShipment(lang: string, orderId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("delivery/manual", async () => {
    const ctx = await requireSection(asLocale(lang), "orders");
    const { shop, user } = ctx;
    if (!(await canTouchOrder(viewerOf(ctx), orderId))) return { ok: false, error: "notFound" };
    const parsed = manualSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const found = await db.$count(schema.orders, and(eq(schema.orders.shopId, shop.id), eq(schema.orders.id, orderId)));
    if (!found) return { ok: false, error: "notFound" };
    if (await db.$count(schema.shipments, eq(schema.shipments.orderId, orderId))) return { ok: false, error: "alreadyShipped" };
    await db.transaction(async (tx) => {
      await tx.insert(schema.shipments).values({ id: newId(), shopId: shop.id, orderId, carrierName: parsed.data.carrierName, trackingNumber: parsed.data.trackingNumber });
      await applyOrderStatus(tx, shop.id, orderId, "shipped", user.id, `${parsed.data.carrierName}: ${parsed.data.trackingNumber}`);
    });
    refresh();
    return { ok: true };
  });
}

// Asks the delivery company where the parcel is; a delivered/returned parcel closes the order.
export async function refreshTracking(lang: string, orderId: string): Promise<ActionState> {
  return safeAction("delivery/track", async () => {
    const ctx = await requireSection(asLocale(lang), "orders");
    const { shop, user } = ctx;
    if (!(await canTouchOrder(viewerOf(ctx), orderId))) return { ok: false, error: "notFound" };
    const [shipment] = await db.select().from(schema.shipments).where(and(eq(schema.shipments.shopId, shop.id), eq(schema.shipments.orderId, orderId)));
    if (!shipment?.carrierAccountId) return { ok: false, error: "notFound" };
    const [account] = await db.select().from(schema.carrierAccounts).where(and(eq(schema.carrierAccounts.shopId, shop.id), eq(schema.carrierAccounts.id, shipment.carrierAccountId)));
    if (!account) return { ok: false, error: "carrierMissing" };
    let raw: string | null;
    try {
      raw = await carrierClient(account.platform, account.baseUrl, decryptJson<Credentials>(account.credentials)).trackingStatus(shipment.trackingNumber);
    } catch (err) {
      return { ok: false, error: "carrierUnreachable", message: err instanceof Error ? err.message : String(err) };
    }
    const status = normalizeShipmentStatus(raw);
    await db.transaction(async (tx) => {
      await tx.update(schema.shipments).set({ status, rawStatus: raw?.slice(0, 120) ?? null, checkedAt: new Date() }).where(eq(schema.shipments.id, shipment.id));
      const next = orderStatusFor(status);
      if (next) await applyOrderStatus(tx, shop.id, orderId, next, user.id, `${shipment.carrierName}: ${raw}`);
    });
    refresh();
    return { ok: true };
  });
}

// Removes the parcel from the order here (a mistake, or cancelled at the company); the order goes back to confirmed.
export async function removeShipment(lang: string, orderId: string): Promise<ActionState> {
  return safeAction("delivery/remove", async () => {
    const ctx = await requireSection(asLocale(lang), "orders");
    const { shop, user } = ctx;
    if (!(await canTouchOrder(viewerOf(ctx), orderId))) return { ok: false, error: "notFound" };
    await db.transaction(async (tx) => {
      await tx.delete(schema.shipments).where(and(eq(schema.shipments.shopId, shop.id), eq(schema.shipments.orderId, orderId)));
      const [order] = await tx.select({ status: schema.orders.status }).from(schema.orders).where(and(eq(schema.orders.shopId, shop.id), eq(schema.orders.id, orderId)));
      if (order?.status === "shipped") await applyOrderStatus(tx, shop.id, orderId, "confirmed", user.id);
    });
    refresh();
    return { ok: true };
  });
}
