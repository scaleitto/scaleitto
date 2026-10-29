// Value lists used by both the database schema and browser code (kept free of database imports).
export const limitKeys = ["maxProducts", "maxOrdersPerMonth", "maxStaff", "maxLandingPages", "maxAiPerMonth"] as const;
export type LimitKey = (typeof limitKeys)[number];

export const pixelPlatforms = ["meta", "tiktok", "ga4", "gtm"] as const;
export type PixelPlatform = (typeof pixelPlatforms)[number];
// When the "purchase" is reported: as soon as the customer orders, or only once the call center confirms / the parcel is delivered
export const purchaseTriggers = ["placed", "confirmed", "delivered"] as const;
export type PurchaseTrigger = (typeof purchaseTriggers)[number];

export const paymentMethods = ["ccp", "rib", "whatsapp"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

// Policy pages a store can show in its footer
export const policyKinds = ["shipping", "returns", "privacy", "terms"] as const;
export type PolicyKind = (typeof policyKinds)[number];

// Plan features the admin can tick. Only custom_domain is enforced so far; the others describe the plan.
export const planFeatures = ["custom_domain", "landing_pages", "ai", "pixels", "google_sheets", "abandoned_cart", "delivery_integrations", "analytics", "variants", "upsell", "api"] as const;

// Styles of an AI-reworked product photo
export const imageStyles = ["studio", "lifestyle", "premium"] as const;
export type ImageStyle = (typeof imageStyles)[number];

// A parcel's options when it is sent to a delivery company (the Packers / Ecotrack fields: operation type, fragile,
// weight, second phone, item to collect back, map link…). Set per send, with defaults per connected company.
export const parcelKinds = ["delivery", "exchange", "pickup", "recovery"] as const;
export type ParcelKind = (typeof parcelKinds)[number];
// Stop desk: as the customer chose in the order, or forced for this send
export const stopDeskModes = ["order", "yes", "no"] as const;
export type StopDeskMode = (typeof stopDeskModes)[number];
export type ParcelOptions = {
  kind: ParcelKind;
  stopDesk: StopDeskMode;
  fragile: boolean;
  weight: number | null;
  phone2: string;
  note: string;
  productLabel: string;
  itemToCollect: string;
  mapLink: string;
};
export const defaultParcelOptions: ParcelOptions = { kind: "delivery", stopDesk: "order", fragile: false, weight: null, phone2: "", note: "", productLabel: "", itemToCollect: "", mapLink: "" };
// What a connected company remembers as the starting point of each send
export type ParcelDefaults = Pick<ParcelOptions, "kind" | "fragile" | "weight" | "note">;

// A store's fake-order protection (Orders → Protection). Read through resolveProtection (features/checkout/protection-settings.ts).
export type ProtectionSettings = {
  // Orders accepted from one phone in 24 hours, and from one connection (IP) in an hour
  maxPerPhonePerDay: number;
  maxPerIpPerHour: number;
  // Same phone + same product while the first order is still new: refused
  blockDuplicates: boolean;
  // A form sent faster than this (seconds) looks like a robot
  minFillSeconds: number;
  // Refuse obvious robots (a robot browser, or no JavaScript and too fast) instead of only flagging them
  blockBots: boolean;
  // Orders at or above this risk (0–100) are "suspicious"
  riskThreshold: number;
  // Suspicious orders wait for a review: not given to agents automatically
  holdSuspicious: boolean;
  // Use the phone's history in the other stores of the platform (returns, refusals)
  useNetwork: boolean;
};
