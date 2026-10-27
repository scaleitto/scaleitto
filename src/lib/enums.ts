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
