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
import { carrierClient, CarrierError } from "./platforms";
import type { Credentials } from "./platforms/types";
import { findCarrier, normalizeEcotrackUrl, platformFields } from "./carriers";
import { buildParcel, parseParcelOptions } from "./parcel";
import { trackShipment } from "./tracking";

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
    const { shop, user } = ctx;
    if (!(await canTouchOrder(viewerOf(ctx), orderId))) return { ok: false, error: "notFound" };
    const [order] = await db.select().from(schema.orders).where(and(eq(schema.orders.shopId, shop.id), eq(schema.orders.id, orderId)));
    if (!order) return { ok: false, error: "notFound" };
    if (order.status !== "confirmed") return { ok: false, error: "confirmFirst" };
    if (await db.$count(schema.shipments, eq(schema.shipments.orderId, orderId))) return { ok: false, error: "alreadyShipped" };
    const [account] = await db.select().from(schema.carrierAccounts).where(and(eq(schema.carrierAccounts.shopId, shop.id), eq(schema.carrierAccounts.id, accountId)));
    if (!account) return { ok: false, error: "notFound" };

    const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
    const parcel = buildParcel(order, items, account.originWilaya, parseParcelOptions(options, account.options));

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
    return { ok: true, message: created.trackingNumber };
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

const manualSchema = z.object({
  accountId: z.string().optional().default(""),
  carrierName: z.string().trim().max(80, "e:invalid").optional().default(""),
  trackingNumber: z.string().trim().min(3, "e:tooShort").max(80, "e:invalid"),
});

// A tracking number typed by hand: with a connected company the parcel is then followed automatically (like a parcel
// sent from here); with another company only the name and number are kept.
export async function addManualShipment(lang: string, orderId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("delivery/manual", async () => {
    const ctx = await requireSection(asLocale(lang), "orders");
    const { shop, user } = ctx;
    if (!(await canTouchOrder(viewerOf(ctx), orderId))) return { ok: false, error: "notFound" };
    const parsed = manualSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const d = parsed.data;
    const [account] = d.accountId ? await db.select().from(schema.carrierAccounts).where(and(eq(schema.carrierAccounts.shopId, shop.id), eq(schema.carrierAccounts.id, d.accountId))) : [];
    if (d.accountId && !account) return { ok: false, error: "notFound" };
    const carrierName = account ? (findCarrier(account.carrier)?.name ?? account.carrier) : d.carrierName;
    if (carrierName.length < 2) return { ok: false, error: "checkFields", fieldErrors: { carrierName: "tooShort" } };
    const found = await db.$count(schema.orders, and(eq(schema.orders.shopId, shop.id), eq(schema.orders.id, orderId)));
    if (!found) return { ok: false, error: "notFound" };
    if (await db.$count(schema.shipments, eq(schema.shipments.orderId, orderId))) return { ok: false, error: "alreadyShipped" };
    const id = newId();
    await db.transaction(async (tx) => {
      await tx.insert(schema.shipments).values({ id, shopId: shop.id, orderId, carrierAccountId: account?.id ?? null, carrierName, trackingNumber: d.trackingNumber });
      await applyOrderStatus(tx, shop.id, orderId, "shipped", user.id, `${carrierName}: ${d.trackingNumber}`);
    });
    // First look at the company right away (its answer may already close the order); a silent failure waits for the cron
    if (account) {
      const [shipment] = await db.select().from(schema.shipments).where(eq(schema.shipments.id, id));
      await trackShipment(shipment, user.id).catch(() => null);
    }
    refresh();
    return { ok: true };
  });
}

// Asks the delivery company where the parcel is; a delivered/returned parcel closes the order.
// Used by the order page and, one order at a time, by the bulk "update stages" of the orders list.
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

// ─── Returns ──────────────────────────────────────────────

// One action on a returned parcel (the Returns sub-section runs it order by order on the selection):
// receive = the merchant has the parcel back; resend = the order goes back to "confirmed" to be sent again (the old
// parcel is noted in the history); cancel = the order is closed as cancelled.
export async function handleReturn(lang: string, orderId: string, kind: "receive" | "resend" | "cancel"): Promise<ActionState> {
  return safeAction("delivery/return", async () => {
    const ctx = await requireSection(asLocale(lang), "returns");
    const { shop, user } = ctx;
    if (!(await canTouchOrder(viewerOf(ctx), orderId))) return { ok: false, error: "notFound" };
    const [order] = await db.select({ status: schema.orders.status }).from(schema.orders).where(and(eq(schema.orders.shopId, shop.id), eq(schema.orders.id, orderId)));
    if (!order) return { ok: false, error: "notFound" };
    if (order.status !== "returned") return { ok: false, error: "notReturned" };
    const [shipment] = await db.select().from(schema.shipments).where(and(eq(schema.shipments.shopId, shop.id), eq(schema.shipments.orderId, orderId)));
    await db.transaction(async (tx) => {
      if (kind === "receive") {
        if (shipment && !shipment.returnReceivedAt) {
          await tx.update(schema.shipments).set({ returnReceivedAt: new Date() }).where(eq(schema.shipments.id, shipment.id));
          await tx.insert(schema.orderEvents).values({ id: newId(), orderId, shopId: shop.id, userId: user.id, type: "note", note: `↩ ${shipment.carrierName} ${shipment.trackingNumber}` });
        }
      } else if (kind === "resend") {
        if (shipment) await tx.delete(schema.shipments).where(eq(schema.shipments.id, shipment.id));
        await applyOrderStatus(tx, shop.id, orderId, "confirmed", user.id, shipment ? `↩ ${shipment.carrierName}: ${shipment.trackingNumber}` : undefined);
      } else {
        await applyOrderStatus(tx, shop.id, orderId, "cancelled", user.id);
      }
    });
    refresh();
    return { ok: true };
  });
}
