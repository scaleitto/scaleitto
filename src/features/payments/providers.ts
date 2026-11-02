import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Apps → Online payments: the two Algerian card gateways, with the merchant's own keys.
// Chargily Pay V2 (github.com/Chargily/chargily-pay-javascript): Bearer secret key, POST /checkouts → checkout_url,
// webhook signed with HMAC-SHA256(secret, raw body) in the "signature" header.
// SlickPay API v2 (github.com/Slick-Pay-Algeria/slickpay-npm, WooCommerce plugin): Bearer public key, POST
// users/invoices → url, GET users/invoices/<id> → completed = 1. No signed webhook: the payment is checked by asking.
// E2E_PAYMENT_URL points both at a local fake server during the automated tests (never set it in production).
const fake = () => process.env.E2E_PAYMENT_URL;
const chargilyBase = (mode: "test" | "live") => (fake() ? `${fake()}/chargily${mode === "test" ? "/test" : ""}/api/v2` : mode === "test" ? "https://pay.chargily.net/test/api/v2" : "https://pay.chargily.net/api/v2");
const slickpayBase = (mode: "test" | "live") => (fake() ? `${fake()}/slickpay/${mode}/api/v2` : mode === "test" ? "https://devapi.slick-pay.com/api/v2" : "https://prodapi.slick-pay.com/api/v2");

type Answer = { ok: boolean; status: number; json: Record<string, unknown> | null; text: string };
async function call(url: string, token: string, method: "GET" | "POST", body?: unknown): Promise<Answer> {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12_000),
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    // not JSON
  }
  return { ok: res.ok, status: res.status, json, text: text.slice(0, 300) };
}
const reason = (a: Answer) => String((a.json?.message as string | undefined) ?? (a.json?.errors ? JSON.stringify(a.json.errors) : "") ?? "").slice(0, 200) || `HTTP ${a.status}`;

export type ChargilyKeys = { secretKey: string };
export type SlickpayKeys = { publicKey: string; contactId: string };

export const chargily = {
  // The key works when the balance can be read
  async test(keys: ChargilyKeys, mode: "test" | "live") {
    const a = await call(`${chargilyBase(mode)}/balance`, keys.secretKey, "GET");
    return a.ok ? { ok: true as const } : { ok: false as const, detail: reason(a) };
  },
  async checkout(keys: ChargilyKeys, mode: "test" | "live", input: { amount: number; successUrl: string; failureUrl: string; webhookUrl: string; locale: string; feesOnBuyer: boolean; description: string; orderId: string }) {
    const a = await call(`${chargilyBase(mode)}/checkouts`, keys.secretKey, "POST", {
      amount: input.amount,
      currency: "dzd",
      success_url: input.successUrl,
      failure_url: input.failureUrl,
      webhook_endpoint: input.webhookUrl,
      locale: input.locale === "fr" || input.locale === "en" ? input.locale : "ar",
      pass_fees_to_customer: input.feesOnBuyer,
      description: input.description.slice(0, 200),
      metadata: { order_id: input.orderId },
    });
    const id = a.json?.id;
    const url = a.json?.checkout_url;
    return a.ok && typeof id === "string" && typeof url === "string" ? { ok: true as const, id, url } : { ok: false as const, detail: reason(a) };
  },
  async status(keys: ChargilyKeys, mode: "test" | "live", id: string) {
    const a = await call(`${chargilyBase(mode)}/checkouts/${encodeURIComponent(id)}`, keys.secretKey, "GET");
    const s = String(a.json?.status ?? "");
    return a.ok ? (s === "paid" ? "paid" : s === "failed" || s === "canceled" || s === "expired" ? "failed" : "pending") : "pending";
  },
  // The webhook comes from Chargily when its signature matches the merchant's secret
  verify(rawBody: string, signature: string | null, keys: ChargilyKeys) {
    if (!signature) return false;
    const expected = Buffer.from(createHmac("sha256", keys.secretKey).update(rawBody).digest("hex"));
    const got = Buffer.from(signature);
    return expected.length === got.length && timingSafeEqual(expected, got);
  },
};

export const slickpay = {
  async test(keys: SlickpayKeys, mode: "test" | "live") {
    const a = await call(`${slickpayBase(mode)}/users/contacts/${encodeURIComponent(keys.contactId)}`, keys.publicKey, "GET");
    return a.ok ? { ok: true as const } : { ok: false as const, detail: reason(a) };
  },
  async checkout(keys: SlickpayKeys, mode: "test" | "live", input: { amount: number; returnUrl: string; firstname: string; lastname: string; phone: string; address: string; items: { name: string; price: number; quantity: number }[] }) {
    const a = await call(`${slickpayBase(mode)}/users/invoices`, keys.publicKey, "POST", {
      amount: input.amount,
      contact: keys.contactId,
      url: input.returnUrl,
      firstname: input.firstname,
      lastname: input.lastname || input.firstname,
      phone: input.phone,
      address: input.address,
      items: input.items,
    });
    const id = a.json?.id;
    const url = a.json?.url;
    return a.ok && (typeof id === "number" || typeof id === "string") && typeof url === "string" ? { ok: true as const, id: String(id), url } : { ok: false as const, detail: reason(a) };
  },
  async status(keys: SlickpayKeys, mode: "test" | "live", id: string) {
    const a = await call(`${slickpayBase(mode)}/users/invoices/${encodeURIComponent(id)}`, keys.publicKey, "GET");
    const data = (a.json?.data ?? {}) as { completed?: unknown };
    return a.ok && (data.completed === 1 || data.completed === true || data.completed === "1") ? "paid" : "pending";
  },
};
