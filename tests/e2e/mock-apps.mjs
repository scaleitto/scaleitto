// Fake external services for the apps tests (E2E_APPS_URL):
// /sheets/exec  — behaves like a deployed Google Apps Script (POST → 302 → GET result), keeps a sheet in memory
// /hook         — a webhook receiver
// /shop/…       — a Shopify store (/products.json, product images)
// /youcan/…     — the YouCan API (token "good-yc")
import { createServer } from "node:http";
import { pngBuffer } from "./helpers.mjs";

export const sheet = { token: null, headers: null, rows: new Map() }; // order number → row
export const hooks = [];
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

export function startMockApps(port) {
  const base = `http://127.0.0.1:${port}`;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const path = url.pathname;

    if (path === "/sheets/exec" && req.method === "POST") {
      const body = JSON.parse(raw);
      let result;
      if (sheet.token && body.token !== sheet.token) result = { ok: false, error: "wrong token" };
      else {
        sheet.headers = body.headers;
        for (const row of body.rows) sheet.rows.set(String(row[0]), row.map(String));
        result = { ok: true, count: body.rows.length };
      }
      const id = ++counter;
      results.set(id, result);
      res.writeHead(302, { Location: `${base}/sheets/echo?id=${id}` });
      return res.end();
    }
    if (path === "/sheets/echo") return json(res, 200, results.get(Number(url.searchParams.get("id"))) ?? { ok: false });
    if (path === "/hook") {
      hooks.push({ headers: req.headers, raw, body: JSON.parse(raw) });
      return json(res, 200, { received: true });
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
