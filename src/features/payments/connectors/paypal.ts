import "server-only";
import { fakeBase, readJson, type ConnectorClient, type Keys, type Mode } from "./types";

// PayPal Orders v2 (developer.paypal.com/docs/api/orders/v2): an OAuth token from the client id + secret, an order
// with intent CAPTURE, the buyer approves it on PayPal's page, then the order is captured here (status COMPLETED).
const base = (mode: Mode) => (fakeBase() ? `${fakeBase()}/paypal/${mode}` : mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");
const reason = (j: Record<string, unknown> | null, status: number) => String(j?.error_description ?? j?.message ?? `HTTP ${status}`).slice(0, 200);

async function token(keys: Keys, mode: Mode) {
  const res = await fetch(`${base(mode)}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${keys.clientId}:${keys.clientSecret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(12_000),
  });
  const j = await readJson(res);
  return res.ok && typeof j?.access_token === "string" ? { ok: true as const, token: j.access_token } : { ok: false as const, detail: reason(j, res.status) };
}

export const paypal: ConnectorClient = {
  async test(keys, mode) {
    const t = await token(keys, mode);
    return t.ok ? { ok: true } : { ok: false, detail: t.detail };
  },
  async start(keys, mode, input) {
    const t = await token(keys, mode);
    if (!t.ok) return t;
    const res = await fetch(`${base(mode)}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t.token}`, "Content-Type": "application/json", "PayPal-Request-Id": input.reference },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{ reference_id: input.reference, custom_id: input.reference, description: input.description.slice(0, 120), amount: { currency_code: input.currency.toUpperCase(), value: (input.amount / 100).toFixed(2) } }],
        application_context: { return_url: input.returnUrl, cancel_url: input.cancelUrl, user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING" },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const j = await readJson(res);
    const links = (j?.links ?? []) as { rel?: string; href?: string }[];
    const approve = links.find((l) => l.rel === "approve" || l.rel === "payer-action")?.href;
    return res.ok && typeof j?.id === "string" && approve ? { ok: true, ref: j.id, url: approve } : { ok: false, detail: reason(j, res.status) };
  },
  // Approved orders are captured now; a captured (COMPLETED) order is paid
  async status(keys, mode, ref) {
    const t = await token(keys, mode);
    if (!t.ok) return "pending";
    const auth = { Authorization: `Bearer ${t.token}`, "Content-Type": "application/json" };
    const res = await fetch(`${base(mode)}/v2/checkout/orders/${encodeURIComponent(ref)}`, { headers: auth, signal: AbortSignal.timeout(12_000) });
    const j = await readJson(res);
    const state = String(j?.status ?? "");
    if (state === "COMPLETED") return "paid";
    if (state === "VOIDED") return "failed";
    if (state !== "APPROVED") return "pending";
    const cap = await fetch(`${base(mode)}/v2/checkout/orders/${encodeURIComponent(ref)}/capture`, { method: "POST", headers: { ...auth, "PayPal-Request-Id": `capture-${ref}` }, signal: AbortSignal.timeout(15_000) });
    const c = await readJson(cap);
    return cap.ok && c?.status === "COMPLETED" ? "paid" : "pending";
  },
};
