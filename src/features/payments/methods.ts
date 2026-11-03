// Online payments: four independent methods, each connected through its own connector (the provider or official
// infrastructure that processes it). Pure: shared by the dashboard, the store and the server.
//
//   stripe   → Stripe Checkout (cards worldwide)
//   paypal   → PayPal Orders v2
//   cib      → SATIM, the national interbank e-payment platform (CIB is the interbank card)
//   edahabia → SATIM (the national platform accepts Algérie Poste's Edahabia card too); a direct Algérie Poste connector
//              is listed but not available: it publishes no merchant API we could implement and verify
//
// A method is offered to buyers only when the merchant connected it with a connector marked ready AND its test call
// succeeded (shop_payment_methods.checked_at).

export const onlineMethods = ["stripe", "paypal", "cib", "edahabia"] as const;
export type OnlineMethod = (typeof onlineMethods)[number];
export const isOnlineMethod = (v: unknown): v is OnlineMethod => typeof v === "string" && (onlineMethods as readonly string[]).includes(v);

export const connectorIds = ["stripe", "paypal", "satim", "algerie_poste"] as const;
export type ConnectorId = (typeof connectorIds)[number];

// The merchant's fields for a connector (all kept encrypted)
export type ConnectorField = { key: string; secret?: boolean; pattern: RegExp };
export type Connector = { id: ConnectorId; ready: boolean; fields: ConnectorField[]; currencies: readonly ("dzd" | "eur" | "usd")[] };

const satim: Connector = {
  id: "satim",
  ready: true,
  fields: [
    { key: "userName", pattern: /^[\w.@-]{3,80}$/ },
    { key: "password", secret: true, pattern: /^.{4,120}$/ },
    { key: "terminalId", pattern: /^[\w-]{3,40}$/ },
  ],
  currencies: ["dzd"],
};

export const connectors: Record<OnlineMethod, Connector[]> = {
  stripe: [{ id: "stripe", ready: true, fields: [{ key: "secretKey", secret: true, pattern: /^(sk|rk)_(test|live)_[A-Za-z0-9]{10,250}$/ }], currencies: ["dzd", "eur", "usd"] }],
  // PayPal does not take dinars: the order is charged in euros or dollars at the merchant's rate
  paypal: [
    {
      id: "paypal",
      ready: true,
      fields: [
        { key: "clientId", pattern: /^[\w-]{20,200}$/ },
        { key: "clientSecret", secret: true, pattern: /^[\w-]{20,200}$/ },
      ],
      currencies: ["eur", "usd"],
    },
  ],
  cib: [satim],
  edahabia: [satim, { id: "algerie_poste", ready: false, fields: [], currencies: ["dzd"] }],
};

export const connectorOf = (method: OnlineMethod, id: string) => connectors[method].find((c) => c.id === id) ?? null;

// The amount sent to the connector, in the currency's smallest unit (DZD and euros/dollars use cents);
// rate = dinars for one euro / dollar
export function chargeAmount(dinars: number, currency: "dzd" | "eur" | "usd", rate: number) {
  return currency === "dzd" ? dinars * 100 : Math.max(1, Math.round((dinars / rate) * 100));
}
