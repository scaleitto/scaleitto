// A fake delivery company server for the end-to-end tests. It speaks the four platforms the app
// supports (Yalidine, Ecotrack, Procolis/ZR Express, NOEST, ZR Express new platform). The app is pointed at it with E2E_CARRIER_URL.
// Valid keys: apiId "good-id" / apiToken "good-token", token "good-token", key "good-key", userGuid "good-guid",
// tenantId "good-tenant" / apiKey "good-key".
import { createServer } from "node:http";

const parcels = new Map(); // tracking → { status, payload }
export const received = [];
let counter = 1000;

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

export function setParcelStatus(tracking, status) {
  const p = parcels.get(tracking);
  if (p) p.status = status;
}

export function startMockCarriers(port) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    const path = url.pathname;
    const h = req.headers;
    const body = req.method === "POST" ? await readJson(req) : {};
    const newTracking = (prefix) => `${prefix}-${++counter}`;

    // Yalidine
    if (path.startsWith("/v1/")) {
      if (h["x-api-id"] !== "good-id" || h["x-api-token"] !== "good-token") return send(res, 401, { error: { message: "unauthorized" } });
      if (path === "/v1/wilayas/") return send(res, 200, { data: [{ id: 16, name: "Alger" }] });
      if (path === "/v1/centers/") return send(res, 200, { data: [{ center_id: 160101, name: "Agence Alger" }] });
      if (path === "/v1/parcels/" && req.method === "POST") {
        const out = {};
        for (const p of body) {
          received.push({ platform: "yalidine", ...p });
          if (p.to_commune_name === "Nowhere") out[p.order_id] = { success: false, message: "Commune introuvable" };
          else {
            const tracking = newTracking("yal");
            parcels.set(tracking, { status: "En préparation", payload: p });
            out[p.order_id] = { success: true, order_id: p.order_id, tracking, label: `https://example.com/label/${tracking}.pdf`, message: "" };
          }
        }
        return send(res, 200, out);
      }
      const m = path.match(/^\/v1\/parcels\/(.+)$/);
      if (m) return send(res, 200, { data: [{ tracking: m[1], last_status: parcels.get(m[1])?.status ?? "" }] });
    }

    // ZR Express new platform (same /api/v1 prefix as Ecotrack, told apart by its X-Tenant header)
    if (path.startsWith("/api/v1/") && h["x-tenant"] !== undefined) {
      if (h["x-tenant"] !== "good-tenant" || h["x-api-key"] !== "good-key") return send(res, 401, { title: "Unauthorized", status: 401 });
      const filter = (field) => body.advancedFilter?.filters?.find((f) => f.field === field)?.value;
      if (path === "/api/v1/territories/search") {
        if (filter("level") === "commune") {
          const items = filter("parentId") === "w-16" ? [{ id: "c-kouba", name: "Kouba", parentId: "w-16" }, { id: "c-bab", name: "Bab El Oued", parentId: "w-16" }] : [];
          return send(res, 200, { items, hasNext: false });
        }
        return send(res, 200, { items: [{ id: "w-16", code: 16, name: "Alger" }, { id: "w-31", code: 31, name: "Oran" }], hasNext: false });
      }
      if (path === "/api/v1/hubs/search") return send(res, 200, { items: [{ id: "hub-16", isPickupPoint: true, address: { cityTerritoryId: "w-16", districtTerritoryId: "c-bab" } }], hasNext: false });
      if (path === "/api/v1/parcels" && req.method === "POST") {
        received.push({ platform: "zrexpress", ...body });
        const id = `zr-${++counter}`;
        parcels.set(`16-${counter}-ZR`, { id, status: "commande_recue", payload: body });
        return send(res, 201, { id });
      }
      const m = path.match(/^\/api\/v1\/parcels\/(.+)$/);
      if (m) {
        const key = decodeURIComponent(m[1]);
        const found = [...parcels].find(([tracking, p]) => tracking === key || p.id === key);
        if (!found) return send(res, 404, { title: "Not Found", status: 404 });
        return send(res, 200, { id: found[1].id, trackingNumber: found[0], state: { name: found[1].status } });
      }
    }

    // Ecotrack
    if (path.startsWith("/api/v1/")) {
      if (h.authorization !== "Bearer good-token") return send(res, 401, { message: "Unauthenticated." });
      if (path === "/api/v1/get/wilayas") return send(res, 200, [{ wilaya_id: 16, wilaya_name: "Alger" }]);
      if (path === "/api/v1/create/order") {
        received.push({ platform: "ecotrack", ...body });
        // A commune Ecotrack does not know is refused, like the real API
        if (body.commune === "Nowhere") return send(res, 422, { success: false, message: "La commune n'existe pas" });
        const tracking = newTracking("ECO");
        parcels.set(tracking, { status: "Prêt à expédier", payload: body });
        return send(res, 200, { success: true, tracking });
      }
      if (path === "/api/v1/get/order/label") {
        if (!parcels.has(url.searchParams.get("tracking"))) return send(res, 422, { message: "Not found" });
        res.writeHead(200, { "Content-Type": "application/pdf" });
        return res.end("%PDF-1.4 label");
      }
      if (path === "/api/v1/get/tracking/info") return send(res, 200, { activity: [{ status: parcels.get(url.searchParams.get("tracking"))?.status ?? "" }] });
    }

    // Procolis (ZR Express)
    if (path.startsWith("/api_v1/")) {
      if (h.token !== "good-token" || h.key !== "good-key") return send(res, 401, { Statut: "Accès refusé" });
      if (path === "/api_v1/token") return send(res, 200, { Statut: "Accès activé" });
      if (path === "/api_v1/add_colis") {
        const c = body.Colis[0];
        received.push({ platform: "procolis", ...c });
        parcels.set(c.Tracking, { status: "En préparation", payload: c });
        return send(res, 200, { Colis: [{ ...c, MessageRetour: "Good" }] });
      }
      if (path === "/api_v1/lire") return send(res, 200, { Colis: [{ Tracking: body.Colis[0].Tracking, Situation: parcels.get(body.Colis[0].Tracking)?.status ?? "" }] });
    }

    // NOEST
    if (path.startsWith("/api/public/")) {
      const auth = req.method === "GET" ? Object.fromEntries(url.searchParams) : body;
      if (auth.api_token !== "good-token" || auth.user_guid !== "good-guid") return send(res, 401, { message: "unauthorized" });
      if (path === "/api/public/fees") return send(res, 200, { tarifs: [] });
      if (path === "/api/public/create/order") {
        received.push({ platform: "noest", ...body });
        const tracking = newTracking("NOE");
        parcels.set(tracking, { status: "draft", payload: body });
        return send(res, 200, { success: true, tracking });
      }
      if (path === "/api/public/valid/order") {
        const p = parcels.get(body.tracking);
        if (p) p.status = "Validé";
        return send(res, 200, { success: true });
      }
      if (path === "/api/public/get/trackings/info") {
        const t = body.trackings[0];
        return send(res, 200, { [t]: { activity: [{ event: parcels.get(t)?.status ?? "" }] } });
      }
    }
    send(res, 404, { message: "not found" });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}
