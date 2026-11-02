// Apps → Delivery auto assign / Agent auto assign: rules that pick the delivery company or the agent of a new order.
// Pure (stored in shops.apps, read through resolveApps); the first active rule that matches wins.

export const orderSources = ["store", "landing", "channel"] as const;
export type OrderSource = (typeof orderSources)[number];

export type DeliveryRule = { id: string; name: string; active: boolean; carrierAccountId: string; wilayas: number[]; minTotal: number | null; maxTotal: number | null; deliveryType: "any" | "home" | "office" };
// from / to = "HH:MM" Algeria time (to before from = overnight); empty = any time
export type AgentRule = { id: string; name: string; active: boolean; agentId: string; productIds: string[]; wilayas: number[]; from: string; to: string; source: "any" | OrderSource };

export const MAX_RULES = 30;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);
const wilayaList = (v: unknown) => (Array.isArray(v) ? [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 69))].slice(0, 69) : []);
const time = (v: unknown) => (typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : "");
const uuid = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/.test(v) ? v : "");
const rows = (v: unknown) => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Record<string, unknown>[]).slice(0, MAX_RULES) : []);

export function resolveDeliveryRules(v: unknown): DeliveryRule[] {
  return rows(v)
    .map((r) => ({
      id: uuid(r.id),
      name: str(r.name, 80),
      active: r.active !== false,
      carrierAccountId: uuid(r.carrierAccountId),
      wilayas: wilayaList(r.wilayas),
      minTotal: int(r.minTotal),
      maxTotal: int(r.maxTotal),
      deliveryType: (r.deliveryType === "home" || r.deliveryType === "office" ? r.deliveryType : "any") as DeliveryRule["deliveryType"],
    }))
    .filter((r) => r.id && r.carrierAccountId);
}

export function resolveAgentRules(v: unknown): AgentRule[] {
  return rows(v)
    .map((r) => ({
      id: uuid(r.id),
      name: str(r.name, 80),
      active: r.active !== false,
      agentId: uuid(r.agentId),
      productIds: Array.isArray(r.productIds) ? [...new Set(r.productIds.map(uuid).filter(Boolean))].slice(0, 200) : [],
      wilayas: wilayaList(r.wilayas),
      from: time(r.from),
      to: time(r.to),
      source: (orderSources.includes(r.source as OrderSource) ? r.source : "any") as AgentRule["source"],
    }))
    .filter((r) => r.id && r.agentId);
}

export function matchDeliveryRule(rules: DeliveryRule[], order: { wilaya: number; total: number; deliveryType: "home" | "office" }) {
  return (
    rules.find(
      (r) =>
        r.active &&
        (!r.wilayas.length || r.wilayas.includes(order.wilaya)) &&
        (r.minTotal === null || order.total >= r.minTotal) &&
        (r.maxTotal === null || order.total <= r.maxTotal) &&
        (r.deliveryType === "any" || r.deliveryType === order.deliveryType),
    )?.carrierAccountId ?? null
  );
}

const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
// Inside a daily window (an empty side = open; to < from = across midnight)
export function inWindow(from: string, to: string, minutes: number) {
  if (!from && !to) return true;
  const a = from ? minutesOf(from) : 0;
  const b = to ? minutesOf(to) : 24 * 60;
  return a <= b ? minutes >= a && minutes < b : minutes >= a || minutes < b;
}

export function matchAgentRules(rules: AgentRule[], order: { productIds: string[]; wilaya: number; minutes: number; source: OrderSource }) {
  return rules.filter(
    (r) =>
      r.active &&
      (!r.productIds.length || r.productIds.some((id) => order.productIds.includes(id))) &&
      (!r.wilayas.length || r.wilayas.includes(order.wilaya)) &&
      (r.source === "any" || r.source === order.source) &&
      inWindow(r.from, r.to, order.minutes),
  ).map((r) => r.agentId);
}
