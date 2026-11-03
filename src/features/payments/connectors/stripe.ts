import "server-only";
import { fakeBase, readJson, type ConnectorClient, type Keys } from "./types";

// Stripe Checkout (docs.stripe.com/api/checkout/sessions): the secret key as Bearer, form-encoded bodies.
// The buyer pays on Stripe's page and comes back; the session is then read again (payment_status "paid").
const base = () => `${fakeBase() ? `${fakeBase()}/stripe` : "https://api.stripe.com"}/v1`;
const headers = (keys: Keys) => ({ Authorization: `Bearer ${keys.secretKey}` });
const reason = (j: Record<string, unknown> | null, status: number) => String((j?.error as { message?: string } | undefined)?.message ?? `HTTP ${status}`).slice(0, 200);

export const stripe: ConnectorClient = {
  async test(keys) {
    const res = await fetch(`${base()}/balance`, { headers: headers(keys), signal: AbortSignal.timeout(12_000) });
    return res.ok ? { ok: true } : { ok: false, detail: reason(await readJson(res), res.status) };
  },
  async start(keys, _mode, input) {
    const body = new URLSearchParams({
      mode: "payment",
      success_url: input.returnUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.reference,
      "metadata[reference]": input.reference,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": input.currency,
      "line_items[0][price_data][unit_amount]": String(input.amount),
      "line_items[0][price_data][product_data][name]": input.description.slice(0, 120),
      locale: input.language === "ar" ? "auto" : input.language,
    });
    const res = await fetch(`${base()}/checkout/sessions`, { method: "POST", headers: { ...headers(keys), "Content-Type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(15_000) });
    const j = await readJson(res);
    return res.ok && typeof j?.id === "string" && typeof j?.url === "string" ? { ok: true, ref: j.id, url: j.url } : { ok: false, detail: reason(j, res.status) };
  },
  async status(keys, _mode, ref) {
    const res = await fetch(`${base()}/checkout/sessions/${encodeURIComponent(ref)}`, { headers: headers(keys), signal: AbortSignal.timeout(12_000) });
    const j = await readJson(res);
    if (!res.ok) return "pending";
    if (j?.payment_status === "paid") return "paid";
    return j?.status === "expired" ? "failed" : "pending";
  },
};
