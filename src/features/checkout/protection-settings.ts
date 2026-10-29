import type { ProtectionSettings } from "@/lib/enums";

export const defaultProtection: ProtectionSettings = {
  maxPerPhonePerDay: 3,
  maxPerIpPerHour: 10,
  blockDuplicates: true,
  minFillSeconds: 4,
  blockBots: true,
  riskThreshold: 50,
  holdSuspicious: false,
  useNetwork: true,
};

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
    maxPerPhonePerDay: int(r.maxPerPhonePerDay, 1, 50, d.maxPerPhonePerDay),
    maxPerIpPerHour: int(r.maxPerIpPerHour, 1, 500, d.maxPerIpPerHour),
    blockDuplicates: bool(r.blockDuplicates, d.blockDuplicates),
    minFillSeconds: int(r.minFillSeconds, 0, 60, d.minFillSeconds),
    blockBots: bool(r.blockBots, d.blockBots),
    riskThreshold: int(r.riskThreshold, 10, 100, d.riskThreshold),
    holdSuspicious: bool(r.holdSuspicious, d.holdSuspicious),
    useNetwork: bool(r.useNetwork, d.useNetwork),
  };
}
