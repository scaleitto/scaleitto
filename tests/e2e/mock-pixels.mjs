// A fake Meta / TikTok / Google Analytics server for the end-to-end tests (server-side events).
// The app is pointed at it with E2E_PIXEL_URL. Valid secrets: "good-token" (Meta, TikTok), "good-secret" (GA4),
// "wa-good" (WhatsApp Business API, sent as a Bearer token).
import { createServer } from "node:http";

export const received = []; // { platform, path, body, headers }
export const whatsapp = []; // messages sent through the WhatsApp Business API: { path, body }

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

    // WhatsApp Business API (Bearer token "wa-good"); a text to 0699999999 is outside the 24-hour window
    if (path.startsWith("/meta/") && req.headers.authorization) {
      if (req.headers.authorization !== "Bearer wa-good") return send(res, 401, { error: { message: "Invalid OAuth access token.", code: 190 } });
      if (req.method === "GET") return send(res, 200, { display_phone_number: "+213 555 00 00 00", verified_name: "Boutique Test", id: path.split("/")[3] });
      if (body.type === "text" && body.to === "213699999999") return send(res, 400, { error: { message: "Re-engagement message", code: 131047 } });
      whatsapp.push({ path, body });
      return send(res, 200, { messaging_product: "whatsapp", contacts: [{ input: body.to, wa_id: body.to }], messages: [{ id: `wamid.${whatsapp.length}` }] });
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
    if (path.startsWith("/ga4/")) {
      const good = url.searchParams.get("api_secret") === "good-secret";
      received.push({ platform: "ga4", path, body, query: Object.fromEntries(url.searchParams) });
      if (path.includes("/debug/")) return send(res, 200, { validationMessages: good ? [] : [{ description: "Unable to find api_secret" }] });
      return send(res, 204);
    }
    send(res, 404, { error: { message: "unknown" } });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}
