// The store's apps (Zimam's Apps page): on/off switches and the settings of the apps that have some, kept in
// shops.apps and always read through resolveApps (missing or invalid values → defaults). Pure: used by the dashboard,
// the storefront and the order code.

export const badgeKeys = ["payment", "returns", "guarantee", "delivery"] as const;
export type BadgeKey = (typeof badgeKeys)[number];
// title / text "" = the store language's default wording
export type TrustBadge = { key: BadgeKey; on: boolean; title: string; text: string };

export type ThanksSettings = { title: string; message: string; button: string; redirect: "product" | "home" };
export type ContactSettings = { phoneOn: boolean; phone: string; whatsappOn: boolean; whatsapp: string };

export type AppSettings = {
  // A draft order is kept when a buyer starts the form and leaves (Orders → Abandoned)
  abandoned: boolean;
  // Scan in the menu and on the Orders page
  scanner: boolean;
  badges: TrustBadge[];
  contact: ContactSettings;
  thanks: ThanksSettings;
};

// Only what is true for every cash-on-delivery store is on by default: returns and guarantees are the merchant's promise
const badgeDefaults: Record<BadgeKey, boolean> = { payment: true, returns: false, guarantee: false, delivery: true };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const phone = (v: unknown) => str(v, 20).replace(/[^\d+ ]/g, "");

export function resolveApps(raw: unknown): AppSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const badgesIn = Array.isArray(r.badges) ? (r.badges as Record<string, unknown>[]) : [];
  const c = (r.contact && typeof r.contact === "object" ? r.contact : {}) as Record<string, unknown>;
  const th = (r.thanks && typeof r.thanks === "object" ? r.thanks : {}) as Record<string, unknown>;
  return {
    abandoned: bool(r.abandoned, true),
    scanner: bool(r.scanner, true),
    badges: badgeKeys.map((key) => {
      const b = badgesIn.find((x) => x && x.key === key) ?? {};
      return { key, on: bool(b.on, badgeDefaults[key]), title: str(b.title, 40), text: str(b.text, 80) };
    }),
    contact: { phoneOn: bool(c.phoneOn, false), phone: phone(c.phone), whatsappOn: bool(c.whatsappOn, false), whatsapp: phone(c.whatsapp) },
    thanks: { title: str(th.title, 80), message: str(th.message, 300), button: str(th.button, 40), redirect: th.redirect === "product" ? "product" : "home" },
  };
}
