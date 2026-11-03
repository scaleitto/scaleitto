// A fake Meta / TikTok / Snapchat / Google Analytics server for the end-to-end tests (server-side events).
// The app is pointed at it with E2E_PIXEL_URL. Valid secrets: "good-token" (Meta, TikTok, Snapchat), "good-secret" (GA4).
import { createHmac } from "node:crypto";
import { createServer } from "node:http";

export const received = []; // { platform, path, body, headers }
export const payments = [];
export const whatsapp = []; // WhatsApp Cloud API messages: { to, template, body } // card checkouts opened: { provider, body }
const checkouts = new Map();
const invoices = new Map();

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

export function startMockPixels(port) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : null;
    const path = url.pathname;

    // WhatsApp Cloud API (Bearer "good-token"): numbers ending in 0000 are refused like a number Meta rejects
    if (/^\/meta\/[^/]+\/[^/]+\/messages$/.test(path)) {
      if (req.headers.authorization !== "Bearer good-token") return send(res, 401, { error: { code: 190, message: "Invalid OAuth access token." } });
      if (String(body.to).endsWith("0000")) return send(res, 400, { error: { code: 131026, message: "Message undeliverable" } });
      const id = `wamid.${whatsapp.length + 1}.${Date.now()}`;
      whatsapp.push({ id, to: body.to, template: body.template.name, body });
      return send(res, 200, { messaging_product: "whatsapp", contacts: [{ input: body.to, wa_id: body.to }], messages: [{ id }] });
    }
    if (path.startsWith("/meta/")) {
      const good = url.searchParams.get("access_token") === "good-token";
      if (req.method === "GET") return good ? send(res, 200, { name: "Pixel test", id: path.split("/")[3] }) : send(res, 400, { error: { message: "Invalid OAuth access token." } });
      received.push({ platform: "meta", path, body });
      return good ? send(res, 200, { events_received: body.data.length, fbtrace_id: "x" }) : send(res, 400, { error: { message: "Invalid OAuth access token." } });
    }
    if (path.startsWith("/tiktok/")) {
      received.push({ platform: "tiktok", path, body, headers: req.headers });
      return req.headers["access-token"] === "good-token" ? send(res, 200, { code: 0, message: "OK" }) : send(res, 200, { code: 40001, message: "Invalid access token" });
    }
    // Snap Conversions API v3: token "good-token"
    if (path.startsWith("/snapchat/")) {
      const good = url.searchParams.get("access_token") === "good-token";
      received.push({ platform: "snapchat", path, body });
      return good ? send(res, 200, { status: "VALID", reason: "" }) : send(res, 401, { status: "INVALID", reason: "Invalid access token" });
    }
    if (path.startsWith("/ga4/")) {
      const good = url.searchParams.get("api_secret") === "good-secret";
      received.push({ platform: "ga4", path, body, query: Object.fromEntries(url.searchParams) });
      if (path.includes("/debug/")) return send(res, 200, { validationMessages: good ? [] : [{ description: "Unable to find api_secret" }] });
      return send(res, 204);
    }
    // Card gateways (E2E_PAYMENT_URL = this server): Chargily Pay V2 and SlickPay, with a "payment page" that pays
    const host = `http://${req.headers.host}`;
    const bearer = String(req.headers.authorization ?? "").replace(/^Bearer /, "");
    if (path.startsWith("/chargily/")) {
      const api = path.replace(/^\/chargily(\/test)?\/api\/v2/, "");
      if (path.startsWith("/chargily/pay/")) {
        const c = checkouts.get(path.split("/")[3]);
        if (!c) return send(res, 404, {});
        const paid = url.searchParams.get("result") !== "fail";
        c.status = paid ? "paid" : "failed";
        if (paid) {
          const raw = JSON.stringify({ id: `evt_${c.id}`, type: "checkout.paid", data: { id: c.id, status: "paid", metadata: c.metadata } });
          await fetch(c.webhook_endpoint, { method: "POST", headers: { "Content-Type": "application/json", signature: createHmac("sha256", c.secret).update(raw).digest("hex") }, body: raw }).catch(() => {});
        }
        res.writeHead(302, { Location: paid ? c.success_url : c.failure_url });
        return res.end();
      }
      if (!bearer.startsWith("test_sk_good")) return send(res, 401, { message: "Unauthenticated." });
      if (api === "/balance") return send(res, 200, { entity: "balance", livemode: false, wallets: [] });
      if (api === "/checkouts" && req.method === "POST") {
        const id = `ch_${checkouts.size + 1}_${Date.now()}`;
        checkouts.set(id, { ...body, id, status: "pending", secret: bearer });
        payments.push({ provider: "chargily", body });
        return send(res, 200, { id, status: "pending", amount: body.amount, checkout_url: `${host}/chargily/pay/${id}` });
      }
      const c = checkouts.get(api.split("/")[2]);
      if (c) return send(res, 200, { id: c.id, status: c.status });
      return send(res, 404, { message: "Not found" });
    }
    if (path.startsWith("/slickpay/")) {
      if (path.startsWith("/slickpay/pay/")) {
        const inv = invoices.get(path.split("/")[3]);
        if (!inv) return send(res, 404, {});
        inv.completed = 1;
        res.writeHead(302, { Location: inv.url });
        return res.end();
      }
      const api = path.replace(/^\/slickpay\/(test|live)\/api\/v2/, "");
      if (!bearer.startsWith("good-public")) return send(res, 401, { message: "Unauthenticated." });
      if (api.startsWith("/users/contacts/")) return send(res, 200, { data: { uuid: api.split("/")[3] } });
      if (api === "/users/invoices" && req.method === "POST") {
        const id = String(invoices.size + 100);
        invoices.set(id, { ...body, completed: 0 });
        payments.push({ provider: "slickpay", body });
        return send(res, 200, { success: 1, id: Number(id), url: `${host}/slickpay/pay/${id}` });
      }
      const inv = invoices.get(api.split("/")[3]);
      if (inv) return send(res, 200, { data: { completed: inv.completed } });
      return send(res, 404, { message: "Not found" });
    }
    send(res, 404, { error: { message: "unknown" } });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}
