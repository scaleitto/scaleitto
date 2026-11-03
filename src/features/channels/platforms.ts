import "server-only";
import { safeRequest } from "@/server/safe-fetch";

// Talking to the merchant's own platform so they do not set webhooks up by hand (Zimam):
// - Shopify: the custom app's Admin API access token checks the store and creates the "orders/create" webhook; Shopify
//   signs it with the app's API secret key (pasted by the merchant). Admin API version: SHOPIFY_VERSION (Shopify keeps
//   each version about a year: move it forward yearly).
// - WooCommerce: the merchant approves our app on their store (/wc-auth/v1/authorize), WooCommerce sends the REST keys to
//   our callback, and we create the "order.created" webhook signed with the channel's secret.
// Formats from the official docs (shopify.dev Admin REST API, woocommerce.github.io REST API + "Authentication endpoint"):
// verify with real stores. E2E_APPS_URL points both at the fake server during the automated tests.
export const SHOPIFY_VERSION = "2026-07";

type Result = { ok: true; webhookId: string } | { ok: false; detail: string };
const fake = () => process.env.E2E_APPS_URL;
const reason = (json: unknown, status: number) => {
  const j = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const e = j.errors ?? j.message ?? j.error;
  return (typeof e === "string" ? e : e ? JSON.stringify(e) : `HTTP ${status}`).slice(0, 200);
};

const shopifyBase = (shop: string) => (fake() ? `${fake()}/shopify-admin/${shop}` : `https://${shop}`) + `/admin/api/${SHOPIFY_VERSION}`;

export async function shopifySetup(shop: string, token: string, deliveryUrl: string): Promise<Result> {
  const headers = { "X-Shopify-Access-Token": token };
  const check = await safeRequest(`${shopifyBase(shop)}/shop.json`, { headers });
  if (check.status !== 200) return { ok: false, detail: reason(check.json, check.status) };
  const list = await safeRequest(`${shopifyBase(shop)}/webhooks.json?topic=orders/create`, { headers });
  const hooks = ((list.json as { webhooks?: { id: number | string; address: string }[] } | null)?.webhooks ?? []).filter((w) => w.address === deliveryUrl);
  if (hooks[0]) return { ok: true, webhookId: String(hooks[0].id) };
  const made = await safeRequest(`${shopifyBase(shop)}/webhooks.json`, { method: "POST", headers, body: JSON.stringify({ webhook: { topic: "orders/create", address: deliveryUrl, format: "json" } }) });
  const id = (made.json as { webhook?: { id?: number | string } } | null)?.webhook?.id;
  return made.status < 300 && id !== undefined ? { ok: true, webhookId: String(id) } : { ok: false, detail: reason(made.json, made.status) };
}

// Where the merchant approves our app on their WooCommerce store
export function wooAuthorizeUrl(storeUrl: string, userId: string, returnUrl: string, callbackUrl: string) {
  const q = new URLSearchParams({ app_name: "Scaleitto", scope: "read_write", user_id: userId, return_url: returnUrl, callback_url: callbackUrl });
  return `${storeUrl}/wc-auth/v1/authorize?${q}`;
}

export async function wooCreateWebhook(storeUrl: string, keys: { consumerKey: string; consumerSecret: string }, deliveryUrl: string, secret: string): Promise<Result> {
  const auth = `Basic ${Buffer.from(`${keys.consumerKey}:${keys.consumerSecret}`).toString("base64")}`;
  const made = await safeRequest(`${storeUrl}/wp-json/wc/v3/webhooks`, {
    method: "POST",
    headers: { Authorization: auth },
    body: JSON.stringify({ name: "Scaleitto — new orders", topic: "order.created", delivery_url: deliveryUrl, secret, status: "active" }),
  });
  const id = (made.json as { id?: number | string } | null)?.id;
  return made.status < 300 && id !== undefined ? { ok: true, webhookId: String(id) } : { ok: false, detail: reason(made.json, made.status) };
}
