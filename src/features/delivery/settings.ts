// Delivery settings (Zimam's General Settings + the handover manifest template), stored as JSON on the shop and always
// read through resolveDelivery / resolveManifest so missing keys get their defaults. Pure: used by the server and the browser.
import type { RateMap } from "@/features/checkout/pricing";
import type { DeliveryType } from "@/server/db/schema";
import { wilayas } from "@/lib/wilayas";

// Zimam's delivery options: each option has a name, where it delivers (home, office or both), and a pricing model —
// free, one flat price (home / office) or prices per wilaya (paid with its own home / office price, free, or not
// delivered). Options are switched on/off one by one; the default one is preferred at checkout.
export const optionPricings = ["free", "flat", "wilaya"] as const;
export type OptionPricing = (typeof optionPricings)[number];
export const optionTypes = ["home", "office", "both"] as const;
export type OptionType = (typeof optionTypes)[number];
export const wilayaStates = ["paid", "free", "none"] as const;
export type WilayaState = (typeof wilayaStates)[number];
export type WilayaRate = { state: WilayaState; home: number | null; office: number | null };
export type DeliveryOption = {
  id: string;
  name: string;
  type: OptionType;
  pricing: OptionPricing;
  // flat prices
  home: number;
  office: number;
  // per-wilaya prices (keys = wilaya codes; a wilaya missing = not delivered). null = the older shared wilaya table
  rates: Record<string, WilayaRate> | null;
  active: boolean;
  isDefault: boolean;
};
export type DeliverySettings = {
  // Off: no delivery fee is charged anywhere
  enabled: boolean;
  // Confirmed orders that have a delivery company are sent to it straight away
  autoSend: boolean;
  options: DeliveryOption[];
};

export const MAX_OPTIONS = 10;
export const MAX_PRICE = 100_000;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const price = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_PRICE ? v : null);
export const covers = (o: Pick<DeliveryOption, "type">, type: DeliveryType) => o.type === "both" || o.type === type;

function cleanRates(raw: unknown): Record<string, WilayaRate> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, WilayaRate> = {};
  for (const w of wilayas) {
    const r = (raw as Record<string, unknown>)[w.code];
    if (!r || typeof r !== "object") continue;
    const x = r as Record<string, unknown>;
    const state = (wilayaStates as readonly string[]).includes(x.state as string) ? (x.state as WilayaState) : null;
    if (!state) continue;
    out[w.code] = state === "paid" ? { state, home: price(x.home), office: price(x.office) } : { state, home: null, office: null };
  }
  return out;
}

export function resolveDelivery(raw: unknown): DeliverySettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const ids = new Set<string>();
  const options = (Array.isArray(r.options) ? r.options : [])
    .slice(0, MAX_OPTIONS)
    .map((o, i): DeliveryOption | null => {
      if (!o || typeof o !== "object") return null;
      const x = o as Record<string, unknown>;
      const type: OptionType = (optionTypes as readonly string[]).includes(x.type as string) ? (x.type as OptionType) : "home";
      const pricing = (optionPricings as readonly string[]).includes(x.pricing as string) ? (x.pricing as OptionPricing) : "wilaya";
      // Older options had one "price" for their single type
      const old = price(x.price) ?? 0;
      let id = str(x.id, 40) || `opt-${i + 1}`;
      while (ids.has(id)) id = `${id}-${i + 1}`;
      ids.add(id);
      return {
        id,
        name: str(x.name, 60),
        type,
        pricing,
        home: price(x.home) ?? (type === "home" ? old : 0),
        office: price(x.office) ?? (type === "office" ? old : 0),
        rates: pricing === "wilaya" ? cleanRates(x.rates) : null,
        active: x.active !== false,
        isDefault: x.isDefault === true,
      };
    })
    .filter((o): o is DeliveryOption => o !== null);
  // At most one default
  const first = options.findIndex((o) => o.isDefault);
  options.forEach((o, i) => (o.isDefault = i === first));
  return { enabled: r.enabled !== false, autoSend: r.autoSend === true, options };
}

// One option's price for a wilaya and a way of delivering (null = not offered there)
export function optionPrice(o: DeliveryOption, code: number, type: DeliveryType, table: RateMap): number | null {
  if (!covers(o, type)) return null;
  if (o.pricing === "free") return 0;
  if (o.pricing === "flat") return type === "home" ? o.home : o.office;
  if (!o.rates) return Object.keys(table).length === 0 ? 0 : ((type === "home" ? table[code]?.home : table[code]?.office) ?? null);
  const r = o.rates[code];
  if (!r || r.state === "none") return null;
  if (r.state === "free") return 0;
  return type === "home" ? r.home : r.office;
}

// The prices checkout really uses. No options = the shared wilaya table as it is (older stores). With options, each way
// of delivering takes the first active option that delivers there (the default one first). A product sold with one
// option (Products → Checkout & delivery) only gets that option. Delivery off = free everywhere.
export function applyDelivery(table: RateMap, settings: DeliverySettings, productOption?: string | null): RateMap {
  if (!settings.enabled) return {};
  if (!settings.options.length) return table;
  const only = productOption ? settings.options.find((o) => o.id === productOption && o.active) : undefined;
  const active = only ? [only] : [...settings.options.filter((o) => o.active)].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  const priceOf = (code: number, type: DeliveryType) => {
    for (const o of active) {
      const p = optionPrice(o, code, type, table);
      if (p !== null) return p;
    }
    return null;
  };
  return Object.fromEntries(wilayas.map((w) => [w.code, { home: priceOf(w.code, "home"), office: priceOf(w.code, "office") }]));
}

// An older store priced from the shared table without options: the same prices as one option (shown in the editor)
export function optionFromTable(table: RateMap): DeliveryOption {
  const rates: Record<string, WilayaRate> = {};
  for (const [code, r] of Object.entries(table)) if (r.home !== null || r.office !== null) rates[code] = { state: "paid", home: r.home, office: r.office };
  return { id: "standard", name: "", type: "both", pricing: "wilaya", home: 0, office: 0, rates, active: true, isDefault: true };
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
