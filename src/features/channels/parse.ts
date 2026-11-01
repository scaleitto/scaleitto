// Orders arriving from connected platforms, turned into one shape (pure, unit-tested). Formats from the platforms'
// public webhook docs: Shopify "orders/create" and WooCommerce "order.created" (both JSON).
import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizePhone } from "@/lib/phone";
import { wilayas } from "@/lib/wilayas";
import type { ChannelKind } from "@/server/db/schema";

export type ExternalLine = { name: string; variant: string | null; sku: string | null; quantity: number; unitPrice: number };
export type ExternalOrder = {
  ref: string;
  label: string;
  name: string;
  phone: string;
  wilayaCode: number;
  commune: string;
  address: string | null;
  note: string | null;
  lines: ExternalLine[];
  shipping: number;
  total: number;
};

const text = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "");
const money = (v: unknown) => {
  const n = Math.round(Number(typeof v === "string" ? v.replace(/,/g, "") : v));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]/g, "");

// "16", "DZ-16", "Alger", "Algiers", "الجزائر" → 16; unknown → 0 (the team corrects it)
export function wilayaFrom(...values: unknown[]): number {
  for (const raw of values) {
    const v = text(raw, 80);
    if (!v) continue;
    const digits = v.match(/(\d{1,2})\s*$/)?.[1] ?? v.match(/^(\d{1,2})\b/)?.[1];
    if (digits && wilayas.some((w) => w.code === Number(digits))) return Number(digits);
    const key = plain(v);
    const found = wilayas.find((w) => plain(w.fr) === key || plain(w.ar) === key || (key === "algiers" && w.code === 16));
    if (found) return found.code;
  }
  return 0;
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const list = (v: unknown): Obj[] => (Array.isArray(v) ? v.map(obj) : []);
const fullName = (o: Obj) => [text(o.first_name, 60), text(o.last_name, 60)].filter(Boolean).join(" ") || text(o.name, 120);

export function parseShopify(body: unknown): ExternalOrder | null {
  const o = obj(body);
  const id = text(o.id, 40);
  if (!id) return null;
  const ship = obj(o.shipping_address);
  const bill = obj(o.billing_address);
  const customer = obj(o.customer);
  const lines = list(o.line_items).map((l) => ({
    name: text(l.title) || text(l.name) || "?",
    variant: text(l.variant_title, 120) || null,
    sku: text(l.sku, 80) || null,
    quantity: Math.max(1, Math.round(Number(l.quantity) || 1)),
    unitPrice: money(l.price),
  }));
  const shipping = list(o.shipping_lines).reduce((s, l) => s + money(l.price), 0);
  return {
    ref: `shopify:${id}`,
    label: text(o.name, 40) || `#${id}`,
    name: fullName(ship) || fullName(bill) || fullName(customer),
    phone: normalizePhone(text(ship.phone, 30) || text(o.phone, 30) || text(customer.phone, 30) || text(bill.phone, 30)),
    wilayaCode: wilayaFrom(ship.province_code, ship.province, bill.province, ship.city),
    commune: text(ship.city, 120) || text(bill.city, 120),
    address: [text(ship.address1), text(ship.address2)].filter(Boolean).join(", ") || null,
    note: text(o.note, 500) || null,
    lines,
    shipping,
    total: money(o.total_price) || lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0) + shipping,
  };
}

export function parseWoo(body: unknown): ExternalOrder | null {
  const o = obj(body);
  const id = text(o.id, 40);
  if (!id) return null;
  const ship = obj(o.shipping);
  const bill = obj(o.billing);
  const lines = list(o.line_items).map((l) => {
    const quantity = Math.max(1, Math.round(Number(l.quantity) || 1));
    return {
      name: text(l.name) || "?",
      variant: null,
      sku: text(l.sku, 80) || null,
      quantity,
      unitPrice: money(l.price) || Math.round(money(l.total) / quantity),
    };
  });
  const shipping = money(o.shipping_total);
  const name = fullName(ship) || fullName(bill);
  return {
    ref: `woocommerce:${id}`,
    label: `#${text(o.number, 40) || id}`,
    name,
    phone: normalizePhone(text(ship.phone, 30) || text(bill.phone, 30)),
    wilayaCode: wilayaFrom(ship.state, bill.state, ship.city, bill.city),
    commune: text(ship.city, 120) || text(bill.city, 120),
    address: [text(ship.address_1) || text(bill.address_1), text(ship.address_2) || text(bill.address_2)].filter(Boolean).join(", ") || null,
    note: text(o.customer_note, 500) || null,
    lines,
    shipping,
    total: money(o.total) || lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0) + shipping,
  };
}

export const parsers: Record<ChannelKind, (body: unknown) => ExternalOrder | null> = { shopify: parseShopify, woocommerce: parseWoo };

// Both platforms sign the raw body with HMAC-SHA256 and send it base64-encoded (Shopify: X-Shopify-Hmac-Sha256,
// WooCommerce: X-WC-Webhook-Signature)
export const signatureHeader: Record<ChannelKind, string> = { shopify: "x-shopify-hmac-sha256", woocommerce: "x-wc-webhook-signature" };
export function validSignature(raw: string, secret: string, signature: string | null) {
  if (!signature) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(raw, "utf8").digest("base64"));
  const given = Buffer.from(signature.trim());
  return expected.length === given.length && timingSafeEqual(expected, given);
}
