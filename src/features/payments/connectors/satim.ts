import "server-only";
import { fakeBase, readJson, type ConnectorClient, type Keys, type Mode } from "./types";

// SATIM, the national interbank e-payment platform (CIB and Edahabia cards). The bank or Algérie Poste gives the merchant
// a user name, a password and a terminal id. REST calls, form-encoded: register.do (→ orderId + formUrl, the card page),
// getOrderStatusExtended.do (orderStatus 2 = paid) and confirmOrder.do (for terminals that authorize first). Amounts in
// centimes, currency 012 (DZD). Formats from the open-source satim-node client (github.com/khalilbnd/satim-node) and
// published integrations: verify with a real SATIM terminal before relying on it.
const base = (mode: Mode) => (fakeBase() ? `${fakeBase()}/satim/${mode}/payment/rest` : mode === "live" ? "https://satim.dz/payment/rest" : "https://test.satim.dz/payment/rest");

async function call(keys: Keys, mode: Mode, path: string, params: Record<string, string>) {
  const res = await fetch(`${base(mode)}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ userName: keys.userName, password: keys.password, ...params }),
    signal: AbortSignal.timeout(15_000),
  });
  return { res, j: await readJson(res) };
}
const pick = (j: Record<string, unknown> | null, ...names: string[]) => names.map((n) => j?.[n]).find((v) => v !== undefined && v !== null);
const errorOf = (j: Record<string, unknown> | null, status: number) => String(pick(j, "errorMessage", "ErrorMessage", "actionCodeDescription") ?? `HTTP ${status}`).slice(0, 200);
const errorCode = (j: Record<string, unknown> | null) => Number(pick(j, "errorCode", "ErrorCode") ?? 0);

const register = (keys: Keys, mode: Mode, p: { orderNumber: string; amount: number; returnUrl: string; failUrl: string; language: string; description: string; udf1: string }) =>
  call(keys, mode, "register.do", {
    orderNumber: p.orderNumber,
    amount: String(p.amount),
    currency: "012",
    returnUrl: p.returnUrl,
    failUrl: p.failUrl,
    language: p.language,
    description: p.description,
    jsonParams: JSON.stringify({ force_terminal_id: keys.terminalId, udf1: p.udf1 }),
  });

export const satim: ConnectorClient = {
  // The credentials work when SATIM registers a small order (it expires unpaid)
  async test(keys, mode) {
    const { res, j } = await register(keys, mode, { orderNumber: `T${Date.now().toString(36)}`.slice(0, 10), amount: 5000, returnUrl: "https://example.com/", failUrl: "https://example.com/", language: "FR", description: "test", udf1: "test" });
    return res.ok && typeof pick(j, "orderId") === "string" && errorCode(j) === 0 ? { ok: true } : { ok: false, detail: errorOf(j, res.status) };
  },
  async start(keys, mode, input) {
    // SATIM wants a short unique order number per attempt
    const orderNumber = `${input.orderNumber}${Date.now().toString(36).slice(-4)}`.slice(0, 20);
    const { res, j } = await register(keys, mode, {
      orderNumber,
      amount: input.amount,
      returnUrl: input.returnUrl,
      failUrl: input.cancelUrl,
      language: input.language.toUpperCase(),
      description: input.description.slice(0, 100),
      udf1: String(input.orderNumber),
    });
    const orderId = pick(j, "orderId");
    const formUrl = pick(j, "formUrl");
    return res.ok && typeof orderId === "string" && typeof formUrl === "string" && errorCode(j) === 0 ? { ok: true, ref: orderId, url: formUrl } : { ok: false, detail: errorOf(j, res.status) };
  },
  async status(keys, mode, ref, amount) {
    const { res, j } = await call(keys, mode, "getOrderStatusExtended.do", { orderId: ref, language: "FR" });
    if (!res.ok) return "pending";
    const state = Number(pick(j, "orderStatus", "OrderStatus") ?? 0);
    if (state === 2) return "paid";
    if (state === 1) {
      // Authorized only: confirm it (two-step terminals)
      const c = await call(keys, mode, "confirmOrder.do", { orderId: ref, amount: String(amount), language: "FR" });
      return c.res.ok && errorCode(c.j) === 0 ? "paid" : "pending";
    }
    return state === 3 || state === 4 || state === 6 ? "failed" : "pending";
  },
};
