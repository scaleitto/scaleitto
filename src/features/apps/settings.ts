// The store's apps (Zimam's Apps page): on/off switches and the settings of the apps that have some, kept in
// shops.apps and always read through resolveApps (missing or invalid values → defaults). Pure: used by the dashboard,
// the storefront and the order code.

import { resolveAgentRules, resolveDeliveryRules, type AgentRule, type DeliveryRule } from "./rules";

export const badgeKeys = ["payment", "returns", "guarantee", "delivery"] as const;
export type BadgeKey = (typeof badgeKeys)[number];
// title / text "" = the store language's default wording
export type TrustBadge = { key: BadgeKey; on: boolean; title: string; text: string };

export type ThanksSettings = { title: string; message: string; button: string; redirect: "product" | "home" };
export type ContactSettings = { phoneOn: boolean; phone: string; whatsappOn: boolean; whatsapp: string };
// contact "" = reuse the quick contact number; lookup = what a buyer types to find their orders
export type TrackingSettings = { enabled: boolean; contact: "" | "whatsapp" | "phone" | "none"; number: string; lookup: "phone" | "number_phone" };

// Apps → WhatsApp confirmation (Zimam's): the question to the buyer, quiet hours (Algeria time; from = until → none),
// one reminder, the messages' language ("" = the store's), all products or a chosen list, and the customer notifications
export const waNotices = ["confirmed", "shipped", "delivered", "out_for_delivery", "failed_attempt", "at_desk"] as const;
export type WaNotice = (typeof waNotices)[number];
export type WhatsAppSettings = {
  enabled: boolean;
  quietFrom: number;
  quietTo: number;
  reminder: boolean;
  language: "" | "ar" | "fr" | "en";
  // null = every product
  products: string[] | null;
  notify: Record<WaNotice, boolean>;
  // "Connect my WhatsApp number": when the merchant asked (ISO date), "" = not asked
  connectRequested: string;
};

export type AppSettings = {
  // A draft order is kept when a buyer starts the form and leaves (Orders → Abandoned)
  abandoned: boolean;
  // Scan in the menu and on the Orders page
  scanner: boolean;
  // Each product can ask its own questions at checkout
  customFields: boolean;
  // Each product can have quantity price tiers and a minimum order
  wholesale: boolean;
  // Buyers can put several products in a cart and order them at once
  cart: boolean;
  badges: TrustBadge[];
  contact: ContactSettings;
  thanks: ThanksSettings;
  tracking: TrackingSettings;
  deliveryRules: DeliveryRule[];
  agentRules: AgentRule[];
  whatsapp: WhatsAppSettings;
};

// Only what is true for every cash-on-delivery store is on by default: returns and guarantees are the merchant's promise
const badgeDefaults: Record<BadgeKey, boolean> = { payment: true, returns: false, guarantee: false, delivery: true };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const hour = (v: unknown, fallback: number) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 23 ? v : fallback);
const phone = (v: unknown) => str(v, 20).replace(/[^\d+ ]/g, "");

export function resolveApps(raw: unknown): AppSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const badgesIn = Array.isArray(r.badges) ? (r.badges as Record<string, unknown>[]) : [];
  const c = (r.contact && typeof r.contact === "object" ? r.contact : {}) as Record<string, unknown>;
  const th = (r.thanks && typeof r.thanks === "object" ? r.thanks : {}) as Record<string, unknown>;
  const wa = (r.whatsapp && typeof r.whatsapp === "object" ? r.whatsapp : {}) as Record<string, unknown>;
  const notify = (wa.notify && typeof wa.notify === "object" ? wa.notify : {}) as Record<string, unknown>;
  const tr = (r.tracking && typeof r.tracking === "object" ? r.tracking : {}) as Record<string, unknown>;
  return {
    abandoned: bool(r.abandoned, true),
    scanner: bool(r.scanner, true),
    customFields: bool(r.customFields, false),
    wholesale: bool(r.wholesale, false),
    cart: bool(r.cart, false),
    badges: badgeKeys.map((key) => {
      const b = badgesIn.find((x) => x && x.key === key) ?? {};
      return { key, on: bool(b.on, badgeDefaults[key]), title: str(b.title, 40), text: str(b.text, 80) };
    }),
    contact: { phoneOn: bool(c.phoneOn, false), phone: phone(c.phone), whatsappOn: bool(c.whatsappOn, false), whatsapp: phone(c.whatsapp) },
    thanks: { title: str(th.title, 80), message: str(th.message, 300), button: str(th.button, 40), redirect: th.redirect === "product" ? "product" : "home" },
    tracking: {
      enabled: bool(tr.enabled, true),
      contact: tr.contact === "whatsapp" || tr.contact === "phone" || tr.contact === "none" ? tr.contact : "",
      number: phone(tr.number),
      lookup: tr.lookup === "phone" ? "phone" : "number_phone",
    },
    deliveryRules: resolveDeliveryRules(r.deliveryRules),
    agentRules: resolveAgentRules(r.agentRules),
    whatsapp: {
      enabled: bool(wa.enabled, false),
      quietFrom: hour(wa.quietFrom, 22),
      quietTo: hour(wa.quietTo, 8),
      reminder: bool(wa.reminder, true),
      language: wa.language === "ar" || wa.language === "fr" || wa.language === "en" ? wa.language : "",
      products: Array.isArray(wa.products) ? wa.products.filter((x): x is string => typeof x === "string").slice(0, 500) : null,
      notify: Object.fromEntries(waNotices.map((k) => [k, bool(notify[k], false)])) as Record<WaNotice, boolean>,
      connectRequested: str(wa.connectRequested, 30),
    },
  };
}

// The tracking page's contact button: the app's own choice, or else the quick contact buttons (WhatsApp first)
export function trackingContact(apps: AppSettings, shopPhone: string | null): { kind: "whatsapp" | "phone"; number: string } | null {
  const { tracking: tr, contact: c } = apps;
  if (tr.contact === "none") return null;
  if (tr.contact) {
    const number = tr.number || (tr.contact === "whatsapp" ? c.whatsapp : c.phone) || shopPhone || "";
    return number ? { kind: tr.contact, number } : null;
  }
  if (c.whatsappOn && c.whatsapp) return { kind: "whatsapp", number: c.whatsapp };
  if (c.phoneOn && c.phone) return { kind: "phone", number: c.phone };
  return null;
}

// Inside the quiet hours (an hour of the day in Algeria)? The window may cross midnight (22 → 8).
export function inQuietHours(w: Pick<WhatsAppSettings, "quietFrom" | "quietTo">, hourNow: number) {
  const { quietFrom: a, quietTo: b } = w;
  if (a === b) return false;
  return a < b ? hourNow >= a && hourNow < b : hourNow >= a || hourNow < b;
}
