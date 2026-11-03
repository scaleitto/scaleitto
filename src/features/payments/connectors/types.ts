// One connector = the provider or official infrastructure that processes a payment method.
export type Mode = "test" | "live";
export type Keys = Record<string, string>;
export type StartInput = {
  // in the currency's smallest unit (see methods.ts chargeAmount)
  amount: number;
  currency: "dzd" | "eur" | "usd";
  reference: string;
  orderNumber: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  language: "ar" | "fr" | "en";
};
export type Started = { ok: true; ref: string; url: string } | { ok: false; detail: string };
export type PaymentState = "paid" | "pending" | "failed";
export type ConnectorClient = {
  test(keys: Keys, mode: Mode): Promise<{ ok: true } | { ok: false; detail: string }>;
  start(keys: Keys, mode: Mode, input: StartInput): Promise<Started>;
  status(keys: Keys, mode: Mode, ref: string, amount: number): Promise<PaymentState>;
};

// E2E_PAYMENT_URL points every connector at a local fake server during the automated tests (never in production)
export const fakeBase = () => process.env.E2E_PAYMENT_URL;

export async function readJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
