// Fake external services for the apps tests (E2E_APPS_URL):
// /sheets/exec  — behaves like a deployed Google Apps Script (POST → 302 → GET result), keeps a sheet in memory
// /hook         — a webhook receiver
// /shop/…       — a Shopify store (/products.json, product images)
// /youcan/…     — the YouCan API (token "good-yc")
// /dns          — a DNS resolver for custom domains (E2E_DNS_URL); records set with setDns()
import { createServer } from "node:http";
import { pngBuffer } from "./helpers.mjs";

export const sheet = { token: null, headers: null, rows: new Map(), order: [] }; // order number → row (order = row positions)
export const hooks = [];
// Statuses written back to an imported sheet (our import script's doPost): { signature, body }
export const sheetWrites = [];
// Webhooks created on the fake Shopify / WooCommerce stores: { platform, body }
export const platformHooks = [];
const dns = new Map(); // "TXT _scaleitto.x.test" → ["…"]
export const setDns = (name, type, values) => dns.set(`${type} ${name}`, values);
let results = new Map();
let counter = 0;

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const shopify = (base) => ({
  products: [
    {
      id: 101,
      title: "Robe d'été",
      body_html: "<p>Robe légère.</p><ul><li>Coton</li></ul>",
      options: [
        { name: "Taille", values: ["S", "M"] },
        { name: "Couleur", values: ["Rouge"] },
      ],
      variants: [
        { option1: "S", option2: "Rouge", option3: null, price: "2500.00", compare_at_price: "3200.00", sku: "ROBE-S" },
        { option1: "M", option2: "Rouge", option3: null, price: "2700.00", compare_at_price: null, sku: "ROBE-M" },
      ],
      images: [{ src: `${base}/shop/img/robe.png` }, { src: `${base}/shop/img/missing.png` }],
    },
    {
      id: 102,
      title: "Casquette",
      body_html: "",
      options: [{ name: "Title", values: ["Default Title"] }],
      variants: [{ option1: "Default Title", price: "900.00", compare_at_price: null, sku: null }],
      images: [],
    },
  ],
});

// Emails the app sends (E2E_MAIL_URL = <this server>/mail): newest last
export const inbox = [];
// The link of the last email sent to this address
export const lastLink = (to) => inbox.findLast((m) => m.to === to)?.text.match(/https?:\/\/\S+/)?.[0] ?? null;

export function startMockApps(port) {
  const base = `http://127.0.0.1:${port}`;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const path = url.pathname;

    if (path === "/mail" && req.method === "POST") {
      inbox.push(JSON.parse(raw));
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end("{}");
    }

    if (path === "/sheets/exec" && req.method === "POST") {
      const body = JSON.parse(raw);
      let result;
      // Tests set sheet.down to make Google answer with an error (the order must wait in the queue)
      if (sheet.down) return json(res, 503, { error: "Service unavailable" });
      if (sheet.token && body.token !== sheet.token) result = { ok: false, error: "wrong token" };
      else {
        sheet.headers = body.headers;
        // Like the real script: where each row went, the tab and its version (tests set sheet.version to fake an old copy)
        const written = body.rows.map((row) => {
          const key = String(row[0]);
          if (!sheet.rows.has(key)) sheet.order.push(key);
          sheet.rows.set(key, row.map(String));
          return { key, row: sheet.order.indexOf(key) + 2 };
        });
        result = { ok: true, sheet: "Orders", gid: 0, written, ...(sheet.version === 1 ? {} : { version: sheet.version ?? 4 }), url: "https://docs.google.com/spreadsheets/d/e2e-sheet/edit" };
      }
      const id = ++counter;
      results.set(id, result);
      res.writeHead(302, { Location: `${base}/sheets/echo?id=${id}` });
      return res.end();
    }
    if (path === "/sheets/echo") return json(res, 200, results.get(Number(url.searchParams.get("id"))) ?? { ok: false });
    if (path === "/dns") return json(res, 200, dns.get(`${url.searchParams.get("type")} ${url.searchParams.get("name")}`) ?? []);
    // Shopify Admin API (token shpat_good…): shop check, list and create webhooks
    const sh = path.match(/^\/shopify-admin\/([^/]+)\/admin\/api\/[\d-]+\/(shop|webhooks)\.json$/);
    if (sh) {
      if (!String(req.headers["x-shopify-access-token"] ?? "").startsWith("shpat_good")) return json(res, 401, { errors: "[API] Invalid API key or access token (unrecognized login or wrong password)" });
      if (sh[2] === "shop") return json(res, 200, { shop: { myshopify_domain: sh[1] } });
      if (req.method === "GET") return json(res, 200, { webhooks: platformHooks.filter((h) => h.platform === "shopify").map((h, i) => ({ id: i + 1, address: h.body.webhook.address })) });
      platformHooks.push({ platform: "shopify", body: JSON.parse(raw) });
      return json(res, 201, { webhook: { id: platformHooks.length, ...JSON.parse(raw).webhook } });
    }
    // A WooCommerce store: the approval page sends the keys to the callback and returns; /woo-bad refuses the webhook
    const woo = path.match(/^\/(woo|woo-bad)\/(wc-auth\/v1\/authorize|wp-json\/wc\/v3\/webhooks)$/);
    if (woo) {
      if (woo[2].startsWith("wc-auth")) {
        const q = url.searchParams;
        await fetch(q.get("callback_url"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key_id: 1, user_id: q.get("user_id"), consumer_key: "ck_goodkey12345", consumer_secret: "cs_goodsecret12345", key_permissions: q.get("scope") }) });
        res.writeHead(302, { Location: q.get("return_url") });
        return res.end();
      }
      if (woo[1] === "woo-bad") return json(res, 401, { code: "woocommerce_rest_cannot_create", message: "Sorry, you cannot create resources." });
      if (req.headers.authorization !== `Basic ${Buffer.from("ck_goodkey12345:cs_goodsecret12345").toString("base64")}`) return json(res, 401, { message: "Invalid key" });
      platformHooks.push({ platform: "woocommerce", body: JSON.parse(raw) });
      return json(res, 201, { id: 70 + platformHooks.length, ...JSON.parse(raw) });
    }
    if (path === "/sheet-import/exec" && req.method === "POST") {
      sheetWrites.push({ signature: url.searchParams.get("signature"), body: JSON.parse(raw) });
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end("ok");
    }
    if (path === "/hook") {
      hooks.push({ headers: req.headers, raw, body: JSON.parse(raw) });
      return json(res, 200, { received: true });
    }
    // A product page that redirects to itself until its cookie comes back (like AliExpress), then shows
    // its data as JSON in a script
    if (path === "/aliexpress/item/1005.html") {
      if (!(req.headers.cookie ?? "").includes("ae_ok=1")) {
        res.writeHead(302, { Location: `${base}/aliexpress/item/1005.html?from=redirect`, "Set-Cookie": "ae_ok=1; Path=/" });
        return res.end();
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(`<html><head><title>AliExpress</title></head><body><script>window.runParams={"subject":"Lampe anti moustique - AliExpress","imagePathList":["${base}/shop/img/robe.png"]};</script></body></html>`);
    }
    if (path === "/products.json") return json(res, 200, url.searchParams.get("page") === "1" ? shopify(base) : { products: [] });
    if (path === "/shop/img/robe.png") {
      res.writeHead(200, { "Content-Type": "image/png" });
      return res.end(pngBuffer([200, 30, 60]));
    }
    if (path === "/youcan/products") {
      if (req.headers.authorization !== "Bearer good-yc") return json(res, 401, { message: "Unauthenticated." });
      return json(res, 200, {
        data: [
          {
            id: "yc-1",
            name: "Montre YouCan",
            description: "<p>Belle montre</p>",
            price: 4200,
            compare_at_price: 5000,
            images: [{ url: `${base}/shop/img/robe.png` }],
            variants: { data: [{ variations: { default: "default" }, price: 4200, sku: "MY-1" }] },
          },
        ],
        meta: { pagination: { total: 1, total_pages: 1, current_page: 1 } },
      });
    }
    json(res, 404, { error: "unknown" });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}
