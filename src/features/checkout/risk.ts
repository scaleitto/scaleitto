// The fake-order risk of a new order (0–100) from signals gathered when it is placed. Pure: unit-tested.
// Each reason is a key the dashboard translates (orders.risk.reasons.<key>).

export type RiskSignals = {
  // This phone's earlier orders in this store
  returned: number;
  cancelled: number;
  // Marked fake order or wrong number
  fake: number;
  delivered: number;
  // This phone's returned/refused parcels in the platform's other stores (0 when the store does not use the network)
  networkReturned: number;
  // Seconds between the first touch of the form and sending it (null: unknown — no JavaScript)
  fillSeconds: number | null;
  minFillSeconds: number;
  // The browser said it is a robot (headless browser, script, crawler)
  botAgent: boolean;
  // Name that does not look like a person's (digits, one letter repeated, too short)
  name: string;
  // Different phones that ordered from the same connection in the last 24 hours (this one included)
  phonesFromIp: number;
};

export const riskReasons = ["returned", "cancelled", "fake", "network", "fast", "noScript", "bot", "name", "sharedIp"] as const;
export type RiskReason = (typeof riskReasons)[number];

export function fakeName(name: string) {
  const n = name.trim();
  const letters = n.replace(/[^\p{L}]/gu, "");
  return letters.length < 3 || /\d{3,}/.test(n) || /(.)\1{3,}/u.test(n.toLowerCase()) || /^(test|xxx|aaa|asdf|qwerty)/i.test(letters);
}

const BOT_AGENT = /bot|crawl|spider|headless|phantom|selenium|puppeteer|playwright|curl|wget|python|java\/|go-http|okhttp|axios|node-fetch|postman|httpclient/i;
export const isBotAgent = (ua: string | null | undefined) => !ua || BOT_AGENT.test(ua);

export function scoreOrder(s: RiskSignals): { score: number; reasons: RiskReason[] } {
  let score = 0;
  const reasons: RiskReason[] = [];
  const add = (reason: RiskReason, points: number) => {
    score += points;
    reasons.push(reason);
  };
  if (s.returned > 0) add("returned", Math.min(50, 25 * s.returned));
  if (s.cancelled > 0) add("cancelled", Math.min(30, 10 * s.cancelled));
  if (s.fake > 0) add("fake", Math.min(60, 40 * s.fake));
  if (s.networkReturned > 0) add("network", s.networkReturned >= 3 ? 35 : 20);
  if (s.fillSeconds === null) add("noScript", 30);
  else if (s.fillSeconds < s.minFillSeconds) add("fast", 25);
  if (s.botAgent) add("bot", 50);
  if (fakeName(s.name)) add("name", 20);
  if (s.phonesFromIp >= 3) add("sharedIp", 20);
  // Customers who already received their parcels are trusted more
  score -= Math.min(30, 15 * s.delivered);
  return { score: Math.max(0, Math.min(100, score)), reasons };
}

// Obvious robots, refused when the store blocks them: a robot browser, or no JavaScript and too fast
export const isObviousBot = (s: Pick<RiskSignals, "botAgent" | "fillSeconds">) => s.botAgent || s.fillSeconds === null;
