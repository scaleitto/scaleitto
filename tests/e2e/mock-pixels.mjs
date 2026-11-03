// A fake Meta / TikTok / Snapchat / Google Analytics server for the end-to-end tests (server-side events).
// The app is pointed at it with E2E_PIXEL_URL. Valid secrets: "good-token" (Meta, TikTok, Snapchat), "good-secret" (GA4).
import { createServer } from "node:http";

export const received = []; // { platform, path, body, headers }
export const payments = [];
export const whatsapp = []; // WhatsApp Cloud API messages: { to, template, body }
// payments = online payments opened: { connector, body }
const sessions = new Map();

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

export function startMockPixels(port) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const form = String(req.headers["content-type"] ?? "").includes("x-www-form-urlencoded");
    const body = !raw ? null : form ? Object.fromEntries(new URLSearchParams(raw)) : JSON.parse(raw);
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
    // Online payments (E2E_PAYMENT_URL = this server): Stripe Checkout, PayPal Orders v2 and SATIM (CIB / Edahabia),
    // each with a fake "payment page" that pays (or fails with ?result=fail) and sends the buyer back
    const host = `http://${req.headers.host}`;
    const bearer = String(req.headers.authorization ?? "").replace(/^(Bearer|Basic) /, "");
    if (path.startsWith("/pay/")) {
      const s = sessions.get(path.split("/")[2]);
      if (!s) return send(res, 404, {});
      const paid = url.searchParams.get("result") !== "fail";
      s.state = paid ? "paid" : "failed";
      res.writeHead(302, { Location: paid ? s.back : s.cancel });
      return res.end();
    }
    const open = (connector, back, cancel, data) => {
      const id = `${connector}_${sessions.size + 1}_${Date.now()}`;
      sessions.set(id, { id, back, cancel, state: "pending", ...data });
      payments.push({ connector, id, body });
      return { id, url: `${host}/pay/${id}` };
    };
    if (path.startsWith("/stripe/v1/")) {
      if (!bearer.startsWith("sk_test_good")) return send(res, 401, { error: { message: "Invalid API Key provided" } });
      const api = path.slice("/stripe/v1".length);
      if (api === "/balance") return send(res, 200, { object: "balance", available: [] });
      if (api === "/checkout/sessions" && req.method === "POST") {
        const { id, url: payUrl } = open("stripe", body.success_url, body.cancel_url, {});
        return send(res, 200, { id, object: "checkout.session", url: payUrl, payment_status: "unpaid", status: "open" });
      }
      const s = sessions.get(api.split("/")[3]);
      if (s) return send(res, 200, { id: s.id, payment_status: s.state === "paid" ? "paid" : "unpaid", status: s.state === "failed" ? "expired" : s.state === "paid" ? "complete" : "open" });
      return send(res, 404, { error: { message: "No such checkout.session" } });
    }
    if (/^\/paypal\/(test|live)\//.test(path)) {
      const api = path.replace(/^\/paypal\/(test|live)/, "");
      if (api === "/v1/oauth2/token") {
        const [id] = Buffer.from(bearer, "base64").toString().split(":");
        return id.startsWith("good-client") ? send(res, 200, { access_token: "pp-token", token_type: "Bearer" }) : send(res, 401, { error: "invalid_client", error_description: "Client Authentication failed" });
      }
      if (bearer !== "pp-token") return send(res, 401, { message: "Authentication failed" });
      if (api === "/v2/checkout/orders" && req.method === "POST") {
        const ctx = body.application_context;
        const { id, url: payUrl } = open("paypal", ctx.return_url, ctx.cancel_url, {});
        return send(res, 201, { id, status: "CREATED", links: [{ rel: "approve", href: payUrl }] });
      }
      const s = sessions.get(api.split("/")[4]);
      if (!s) return send(res, 404, { message: "RESOURCE_NOT_FOUND" });
      if (api.endsWith("/capture")) {
        if (s.state !== "paid") return send(res, 422, { message: "ORDER_NOT_APPROVED" });
        s.captured = true;
        return send(res, 201, { id: s.id, status: "COMPLETED" });
      }
      return send(res, 200, { id: s.id, status: s.captured ? "COMPLETED" : s.state === "paid" ? "APPROVED" : "CREATED" });
    }
    if (/^\/satim\/(test|live)\/payment\/rest\//.test(path)) {
      const api = path.split("/").pop();
      if (body?.userName !== "good-user" || body?.password !== "good-pass") return send(res, 200, { errorCode: 5, errorMessage: "Access denied" });
      if (api === "register.do") {
        if (JSON.parse(body.jsonParams ?? "{}").force_terminal_id !== "E010900000") return send(res, 200, { errorCode: 5, errorMessage: "Terminal not found" });
        const { id, url: payUrl } = open("satim", body.returnUrl, body.failUrl, {});
        return send(res, 200, { errorCode: "0", orderId: id, formUrl: payUrl });
      }
      const s = sessions.get(body.orderId);
      if (!s) return send(res, 200, { errorCode: 6, errorMessage: "Order not found" });
      if (api === "getOrderStatusExtended.do") return send(res, 200, { errorCode: "0", orderStatus: s.state === "paid" ? 2 : s.state === "failed" ? 6 : 0 });
      return send(res, 200, { errorCode: "0" });
    }
    send(res, 404, { error: { message: "unknown" } });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}
