import type { CarrierPlatform } from "@/server/db/schema";

// Delivery companies a shop can connect. Most Algerian couriers run on a few shared platforms:
// - yalidine: Yalidine's API (also Yalitec, Guepex…): API ID + API token
// - ecotrack: one API on each courier's own <name>.ecotrack.dz domain: one API token
// - procolis: ZR Express (procolis.com): token + key
// - noest: NOEST's own API: API token + user GUID
export type CredentialField = "apiId" | "apiToken" | "token" | "key" | "userGuid";

export type CarrierInfo = {
  key: string;
  name: string;
  platform: CarrierPlatform | null; // null → not integrated yet (manual tracking only)
  // Fixed API address; for Ecotrack couriers without a known address the merchant types it
  baseUrl?: string;
};

export const platformFields: Record<CarrierPlatform, CredentialField[]> = {
  yalidine: ["apiId", "apiToken"],
  ecotrack: ["token"],
  procolis: ["token", "key"],
  noest: ["apiToken", "userGuid"],
};

const eco = (key: string, name: string, sub?: string): CarrierInfo => ({ key, name, platform: "ecotrack", baseUrl: sub ? `https://${sub}.ecotrack.dz` : undefined });

export const carriers: CarrierInfo[] = [
  { key: "yalidine", name: "Yalidine", platform: "yalidine", baseUrl: "https://api.yalidine.app" },
  { key: "zrexpress", name: "ZR Express", platform: "procolis", baseUrl: "https://procolis.com" },
  { key: "noest", name: "NOEST Express", platform: "noest", baseUrl: "https://app.noest-dz.com" },
  eco("anderson", "Anderson Delivery", "anderson"),
  eco("dhd", "DHD", "dhd"),
  eco("48hr", "48Hr Livraison", "48hr"),
  eco("golivri", "GOLIVRI", "golivri"),
  eco("packers", "Packers", "packers"),
  eco("salva", "Salva Delivery", "salvadelivery"),
  eco("speeddelivery", "Speed Delivery", "speeddelivery"),
  eco("tsl", "TSL Express", "tsl"),
  eco("worldexpress", "World Express", "worldexpress"),
  { key: "yalitec", name: "Yalitec", platform: "yalidine", baseUrl: "https://api.yalitec.me" },
  { key: "guepex", name: "Guepex", platform: "yalidine", baseUrl: "https://api.guepex.app" },
  eco("navex", "Navex Delivery"),
  eco("amana", "Amana Speed Service"),
  eco("colex", "Colex"),
  eco("expediachrono", "Expedia Chrono"),
  eco("hhd", "HHD Delivery Express"),
  eco("imir", "IMIR Logistics"),
  eco("oksbox", "Oksbox"),
  eco("ontime", "On Time Express"),
  eco("rj360", "RJ 360 Express"),
  eco("samex", "Samex"),
  eco("swift", "Swift Express"),
  // Any other courier running Ecotrack: the merchant types its address
  eco("ecotrack", "Ecotrack (other company)"),
  { key: "maystro", name: "Maystro Delivery", platform: null },
  { key: "ecom", name: "E-COM Delivery", platform: null },
  { key: "aligoo", name: "Aligoo Express", platform: null },
  { key: "dch", name: "DCH Express", platform: null },
  { key: "osen", name: "OSEN Express", platform: null },
  { key: "zimou", name: "Zimou Express", platform: null },
];

export const findCarrier = (key: string) => carriers.find((c) => c.key === key);

// Only real courier addresses are accepted (we send secrets there): https and an Ecotrack domain.
export function normalizeEcotrackUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (!/^[a-z0-9-]+\.ecotrack\.dz$/.test(host)) return null;
  return `https://${host}`;
}
