import type { ProtectionSettings } from "@/lib/enums";

export const defaultProtection: ProtectionSettings = {
  enabled: true,
  maxPerPhonePerDay: 3,
  maxPerIpPerHour: 10,
  blockDuplicates: true,
  minFillSeconds: 4,
  blockBots: true,
  riskThreshold: 50,
  holdSuspicious: false,
  useNetwork: true,
  maxPerPhonePerWeek: 10,
  duplicateHours: 24,
  maxQuantity: 0,
  blockedIps: [],
  blockedWords: [],
  blockedWilayas: [],
  autoFakeScore: 0,
  autoBlockFake: 0,
  captcha: "never",
  captchaFallback: "accept",
};

export const MAX_BLOCKED_ITEMS = 100;
// IPv4 or IPv6 (letters, digits, dots and colons), as the server sees it
export const isIp = (v: string) => /^(\d{1,3}\.){3}\d{1,3}$/.test(v) || (/^[0-9a-f:]{3,45}$/i.test(v) && v.includes(":"));
// One entry per line (or comma), trimmed, without repeats
export const listOf = (v: unknown) =>
  [...new Set((Array.isArray(v) ? v.map(String) : String(v ?? "").split(/[\n,،]/)).map((x) => x.trim()).filter(Boolean))].slice(0, MAX_BLOCKED_ITEMS);

const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

// The store's settings, every missing or invalid value replaced by its default
export function resolveProtection(raw: Partial<ProtectionSettings> | null | undefined): ProtectionSettings {
  const r = raw ?? {};
  const d = defaultProtection;
  return {
    enabled: bool(r.enabled, d.enabled),
    maxPerPhonePerDay: int(r.maxPerPhonePerDay, 1, 50, d.maxPerPhonePerDay),
    maxPerIpPerHour: int(r.maxPerIpPerHour, 1, 500, d.maxPerIpPerHour),
    blockDuplicates: bool(r.blockDuplicates, d.blockDuplicates),
    minFillSeconds: int(r.minFillSeconds, 0, 60, d.minFillSeconds),
    blockBots: bool(r.blockBots, d.blockBots),
    riskThreshold: int(r.riskThreshold, 10, 100, d.riskThreshold),
    holdSuspicious: bool(r.holdSuspicious, d.holdSuspicious),
    useNetwork: bool(r.useNetwork, d.useNetwork),
    maxPerPhonePerWeek: int(r.maxPerPhonePerWeek, 1, 100, d.maxPerPhonePerWeek),
    // The protection period (Zimam): orders from one number are counted in it, and a repeat inside it is refused
    duplicateHours: int(r.duplicateHours, 1, 720, d.duplicateHours),
    maxQuantity: int(r.maxQuantity, 0, 1000, d.maxQuantity),
    blockedIps: listOf(r.blockedIps).filter(isIp),
    blockedWords: listOf(r.blockedWords)
      .map((w) => w.toLowerCase())
      .filter((w) => w.length >= 2 && w.length <= 40),
    blockedWilayas: (Array.isArray(r.blockedWilayas) ? r.blockedWilayas : []).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 69),
    autoFakeScore: r.autoFakeScore === 0 ? 0 : int(r.autoFakeScore, 10, 100, d.autoFakeScore),
    autoBlockFake: int(r.autoBlockFake, 0, 10, d.autoBlockFake),
    captcha: r.captcha === "always" || r.captcha === "risky" ? r.captcha : "never",
    captchaFallback: r.captchaFallback === "refuse" ? "refuse" : "accept",
  };
}

// Words of the store's block list found in what the customer typed
export function blockedWordIn(words: string[], ...texts: (string | null | undefined)[]) {
  const text = texts.filter(Boolean).join(" ").toLowerCase();
  return words.find((w) => text.includes(w)) ?? null;
}
