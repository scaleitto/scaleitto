// Plans → Feature packs (Zimam): extra quota for the current Algeria month only, paid with the store's credits (Balance).
// Several packs can be bought in the same month; what is not used does not carry over.
export const quotaPacks = [
  { key: "orders500", limit: "maxOrdersPerMonth", amount: 500, credits: 1500 },
  { key: "ai20", limit: "maxAiPerMonth", amount: 20, credits: 400 },
] as const;
export type QuotaPackKey = (typeof quotaPacks)[number]["key"];
export const findQuotaPack = (key: string) => quotaPacks.find((p) => p.key === key) ?? null;
