import "server-only";
import { z } from "zod";
import { defaultParcelOptions, parcelKinds, stopDeskModes, type ParcelDefaults, type ParcelOptions } from "@/lib/enums";
import { normalizePhone } from "@/lib/phone";
import { carrierWilaya } from "@/lib/wilayas";
import type { ParcelInput } from "./platforms";
import { splitName } from "./status";

// The options of one send, checked (anything missing or wrong falls back to the default)
const optionsSchema = z.object({
  kind: z.enum(parcelKinds).catch("delivery"),
  stopDesk: z.enum(stopDeskModes).catch("order"),
  fragile: z.coerce.boolean().catch(false),
  weight: z.coerce.number().min(0).max(1000).nullable().catch(null),
  phone2: z.string().trim().max(20).catch(""),
  note: z.string().trim().max(255).catch(""),
  productLabel: z.string().trim().max(255).catch(""),
  itemToCollect: z.string().trim().max(255).catch(""),
  mapLink: z.string().trim().max(500).catch(""),
});

export function parseParcelOptions(raw: unknown, defaults?: Partial<ParcelDefaults> | null): ParcelOptions {
  const base = { ...defaultParcelOptions, ...(defaults ?? {}) };
  const parsed = optionsSchema.partial().safeParse(raw ?? {});
  const given = parsed.success ? Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined)) : {};
  const o = { ...base, ...given } as ParcelOptions;
  const phone2 = normalizePhone(o.phone2);
  return {
    ...o,
    weight: o.weight && o.weight > 0 ? o.weight : null,
    phone2: /^0\d{8,9}$/.test(phone2) ? phone2 : "",
    mapLink: /^https?:\/\//i.test(o.mapLink) ? o.mapLink : "",
  };
}

// Couriers still work with the 58 older wilayas: a new wilaya (59–69) is sent as the one it was taken from
export const frenchWilaya = (code: number) => carrierWilaya(code).fr;

type OrderForParcel = { number: number; customerName: string; phone: string; wilayaCode: number; commune: string; address: string | null; total: number; deliveryType: string; customerNote: string | null };
type ItemForParcel = { name: string; variantTitle: string | null; quantity: number };

// One order in the shape every courier (and the Packers sheet) needs, with this send's options.
export function buildParcel(order: OrderForParcel, items: ItemForParcel[], originWilaya: number, options: ParcelOptions): ParcelInput {
  const { firstName, lastName } = splitName(order.customerName);
  const products = items.map((i) => `${i.name}${i.variantTitle ? ` (${i.variantTitle})` : ""} x${i.quantity}`).join(", ");
  const note = [options.note || order.customerNote || "", options.fragile ? "FRAGILE" : ""].filter(Boolean).join(" — ");
  return {
    reference: String(order.number),
    fullName: order.customerName,
    firstName,
    lastName,
    phone: order.phone,
    phone2: options.phone2,
    wilayaCode: carrierWilaya(order.wilayaCode).code,
    wilayaName: frenchWilaya(order.wilayaCode),
    commune: order.commune,
    address: order.address ?? "",
    products: options.productLabel || products,
    codAmount: order.total,
    stopDesk: options.stopDesk === "order" ? order.deliveryType === "office" : options.stopDesk === "yes",
    note,
    originWilayaCode: carrierWilaya(originWilaya).code,
    originWilayaName: frenchWilaya(originWilaya),
    kind: options.kind,
    fragile: options.fragile,
    weight: options.weight,
    itemToCollect: options.itemToCollect,
    mapLink: options.mapLink,
  };
}
