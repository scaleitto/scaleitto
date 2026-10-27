// A fake Meta / TikTok / Google Analytics server for the end-to-end tests (server-side events).
// The app is pointed at it with E2E_PIXEL_URL. Valid secrets: "good-token" (Meta, TikTok), "good-secret" (GA4).
import { createServer } from "node:http";

export const received = []; // { platform, path, body, headers }

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
