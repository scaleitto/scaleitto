// Balance → credit packs (Zimam's four packs; prices in dinars). Shared by the page and the server.
export const creditPacks = [
  { key: "starter", credits: 1_000, price: 800 },
  { key: "growth", credits: 5_500, price: 3_800 },
  { key: "scale", credits: 12_000, price: 7_600 },
  { key: "business", credits: 32_500, price: 19_000 },
] as const;
export type CreditPackKey = (typeof creditPacks)[number]["key"];
export const findPack = (key: string) => creditPacks.find((p) => p.key === key) ?? null;

// What paid services cost (Zimam: 5 credits per WhatsApp message)
export const CREDIT_COSTS = { whatsapp: 5, notification: 5 } as const;
export const TRIAL_CREDITS = 500;
// Below this the balance shows as low
export const LOW_BALANCE = 50;
