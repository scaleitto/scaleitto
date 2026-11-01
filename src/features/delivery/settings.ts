// Delivery settings (Zimam's General Settings + the handover manifest template), stored as JSON on the shop and always
// read through resolveDelivery / resolveManifest so missing keys get their defaults. Pure: used by the server and the browser.
import type { RateMap } from "@/features/checkout/pricing";
import type { DeliveryType } from "@/server/db/schema";
import { wilayas } from "@/lib/wilayas";

export const optionPricings = ["wilaya", "flat", "free"] as const;
export type OptionPricing = (typeof optionPricings)[number];
// One way of delivering offered at checkout: to the door (home) or to the company's desk (office)
export type DeliveryOption = { id: string; name: string; type: DeliveryType; pricing: OptionPricing; price: number; days: string; active: boolean };
export type DeliverySettings = {
  // Off: no delivery fee is charged anywhere
  enabled: boolean;
  // Confirmed orders that have a delivery company are sent to it straight away
  autoSend: boolean;
  options: DeliveryOption[];
};

export const MAX_OPTIONS = 2;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function resolveDelivery(raw: unknown): DeliverySettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const seen = new Set<DeliveryType>();
  const options = (Array.isArray(r.options) ? r.options : [])
    .map((o): DeliveryOption | null => {
      if (!o || typeof o !== "object") return null;
      const x = o as Record<string, unknown>;
      const type: DeliveryType = x.type === "office" ? "office" : "home";
      // One option per way of delivering
      if (seen.has(type)) return null;
      seen.add(type);
      const pricing = (optionPricings as readonly string[]).includes(x.pricing as string) ? (x.pricing as OptionPricing) : "wilaya";
      const price = Number.isInteger(x.price) && (x.price as number) >= 0 && (x.price as number) <= 100_000 ? (x.price as number) : 0;
      return { id: str(x.id, 40) || type, name: str(x.name, 60), type, pricing, price, days: str(x.days, 40), active: x.active !== false };
    })
    .filter((o): o is DeliveryOption => o !== null);
  return { enabled: r.enabled !== false, autoSend: r.autoSend === true, options };
}

// The prices checkout really uses: the wilaya table, shaped by the options. No options = the table as it is (home and
// desk where it has a price); with options, only the active ones are offered, at their own price. Delivery off = free.
export function applyDelivery(rates: RateMap, settings: DeliverySettings): RateMap {
  if (!settings.enabled) return {};
  if (!settings.options.length) return rates;
  const tableEmpty = Object.keys(rates).length === 0;
  const priceOf = (code: number, type: DeliveryType): number | null => {
    const option = settings.options.find((o) => o.type === type && o.active);
    if (!option) return null;
    if (option.pricing === "free") return 0;
    if (option.pricing === "flat") return option.price;
    return tableEmpty ? 0 : ((type === "home" ? rates[code]?.home : rates[code]?.office) ?? null);
  };
  return Object.fromEntries(wilayas.map((w) => [w.code, { home: priceOf(w.code, "home"), office: priceOf(w.code, "office") }]));
}

// ─── Handover manifest ─────────────────────────────────────

export const manifestFields = ["cod", "phone", "items", "notes", "reference", "signatures"] as const;
export type ManifestField = (typeof manifestFields)[number];
export type ManifestTemplate = {
  show: Record<ManifestField, boolean>;
  logo: boolean;
  header: string;
  footer: string;
  paper: "a4" | "a6";
  language: "ar" | "fr" | "en";
  direction: "rtl" | "ltr";
  pickup: string;
  returns: string;
};
// The shop keeps a draft (edited) and the published template (printed); null published = the default one
export type ManifestSettings = { draft: ManifestTemplate; published: ManifestTemplate | null };

export const defaultManifest: ManifestTemplate = {
  // Item lines are off: a manifest of 40 parcels with them does not fit on paper
  show: { cod: true, phone: true, items: false, notes: false, reference: true, signatures: true },
  logo: true,
  header: "",
  footer: "",
  paper: "a4",
  language: "ar",
  direction: "rtl",
  pickup: "",
  returns: "",
};

function template(raw: unknown): ManifestTemplate {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const show = (r.show && typeof r.show === "object" ? r.show : {}) as Record<string, unknown>;
  const language = r.language === "fr" || r.language === "en" ? r.language : "ar";
  return {
    show: Object.fromEntries(manifestFields.map((f) => [f, typeof show[f] === "boolean" ? show[f] : defaultManifest.show[f]])) as ManifestTemplate["show"],
    logo: r.logo !== false,
    header: str(r.header, 500),
    footer: str(r.footer, 500),
    paper: r.paper === "a6" ? "a6" : "a4",
    language,
    direction: r.direction === "ltr" || r.direction === "rtl" ? r.direction : language === "ar" ? "rtl" : "ltr",
    pickup: str(r.pickup, 2000),
    returns: str(r.returns, 2000),
  };
}

export function resolveManifest(raw: unknown): ManifestSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const published = r.published ? template(r.published) : null;
  return { draft: r.draft ? template(r.draft) : (published ?? defaultManifest), published };
}

export const cleanManifest = template;
