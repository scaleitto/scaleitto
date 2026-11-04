// Phase 38: Store settings like Zimam, part 2 — Domain → Allowed origins + the public store API, MCP access tokens + the MCP
// server, Refer a seller (link, sign-up, vouchers taken off a plan request).
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { BASE, BROWSER_ARGS, createShop, db, expect, step } from "./helpers.mjs";

export default async function phase38(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  owner.on("dialog", (d) => d.accept());
  const section = `${BASE}/ar/dashboard/settings`;
  const productId = randomUUID();
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'Montre', 'montre', 3000, '[]', '[]', '[]')", [productId, shopId]);
  await db.query("INSERT INTO shipping_rates (shop_id, wilaya_code, home_price, office_price) VALUES (?, 16, 500, 400)", [shopId]);
  const api = `${BASE}/api/storefront/v1/${shopId}`;
  const origin = "https://shop.example.com";

  await step("Allowed origins: a bad address is refused, a good one saved; the connection details show the store ID", async () => {
    await owner.goto(`${section}?tab=domain`);
    expect((await owner.locator("[data-connection=store]").innerText()).trim() === shopId, "store ID shown");
    await owner.click("[data-testid=add-origin]");
    await owner.fill("[data-origin='0']", "http://shop.example.com/path");
    await owner.click("[data-testid=save-origins]");
    await owner.locator("[data-testid=settings-origins]").getByText("عنوان غير صحيح").waitFor();
    await owner.fill("[data-origin='0']", origin);
    await owner.click("[data-testid=save-origins]");
    await owner.locator("[data-testid=settings-origins]").getByText("تم الحفظ").waitFor();
    const [[row]] = await db.query("SELECT api_origins FROM shops WHERE id = ?", [shopId]);
    const saved = typeof row.api_origins === "string" ? JSON.parse(row.api_origins) : row.api_origins;
    expect(JSON.stringify(saved) === JSON.stringify([origin]), `saved (got ${JSON.stringify(saved)})`);
  });

  await step("Store API: products, product, shipping; CORS only for allowed origins; an order through the same checks", async () => {
    const list = await fetch(`${api}/products`, { headers: { Origin: origin } });
    expect(list.status === 200 && list.headers.get("access-control-allow-origin") === origin, "allowed origin");
    expect((await list.json()).products.some((p) => p.slug === "montre"), "product listed");
    expect((await fetch(`${api}/products`, { headers: { Origin: "https://evil.example.com" } })).status === 403, "other origins refused");
    expect((await fetch(`${api}/products`)).status === 200, "server calls accepted");
    const pre = await fetch(`${api}/orders`, { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "POST" } });
    expect(pre.status === 204 && pre.headers.get("access-control-allow-methods")?.includes("POST"), "preflight");
    const one = await (await fetch(`${api}/products/montre`)).json();
    expect(one.product.id === productId && one.product.price === 3000, "product detail");
    const ship = await (await fetch(`${api}/shipping`)).json();
    expect(ship.wilayas.find((w) => w.code === 16).home === 500 && ship.wilayas.length === 69, "shipping");
    const bad = await fetch(`${api}/orders`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ productId, phone: "12" }) });
    expect(bad.status === 422 && (await bad.json()).fields.phone, "fields checked");
    const ua = BROWSER_ARGS[0].replace("--user-agent=", "");
    const ok = await fetch(`${api}/orders`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json", "User-Agent": ua },
      body: JSON.stringify({ productId, quantity: 1, name: "Karim Api", phone: "0770 11 22 33", wilaya: 16, commune: "Hydra", deliveryType: "home" }),
    });
    const placed = await ok.json();
    expect(ok.status === 201 && placed.order.number === 1001, `order created (got ${ok.status} ${JSON.stringify(placed)})`);
    const [[o]] = await db.query("SELECT customer_name, total, shipping_price FROM orders WHERE id = ?", [placed.order.id]);
    expect(o.customer_name === "Karim Api" && o.total === 3500 && o.shipping_price === 500, "priced like the store");
    expect((await fetch(`${BASE}/api/storefront/v1/${randomUUID()}/products`)).status === 404, "unknown store");
  });

  let token = "";
  await step("MCP: a token needs a name and the consent; it is shown once", async () => {
    await owner.goto(`${section}?tab=mcp`);
    expect((await owner.locator("[data-testid=mcp-url]").innerText()).endsWith("/api/mcp"), "server URL");
    await owner.fill("#mcp-name", "Mon laptop");
    expect(await owner.locator("[data-testid=mcp-create]").isDisabled(), "no consent: disabled");
    await owner.check("[data-testid=mcp-consent]");
    await owner.click("[data-testid=mcp-create]");
    token = (await owner.locator("[data-testid=mcp-token]").innerText()).trim();
    expect(token.startsWith("scm_"), "token shown");
    const [[row]] = await db.query("SELECT token_hash, scopes FROM mcp_tokens WHERE shop_id = ?", [shopId]);
    expect(row.token_hash.length === 64 && !row.token_hash.includes(token), "only the hash is kept");
  });

  await step("MCP server: initialize, the token's tools only, reading orders; write tools refused", async () => {
    const rpc = (body, t = token) => fetch(`${BASE}/api/mcp`, { method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, ...body }) });
    expect((await rpc({ method: "ping" }, "scm_wrongwrongwrongwrongwrong")).status === 401, "bad token refused");
    const init = await (await rpc({ method: "initialize", params: { protocolVersion: "2025-06-18", clientInfo: { name: "Claude", version: "1.0" }, capabilities: {} } })).json();
    expect(init.result.serverInfo.name === "scaleitto-store" && init.result.capabilities.tools, "initialized");
    const list = await (await rpc({ method: "tools/list" })).json();
    const names = list.result.tools.map((t) => t.name);
    expect(names.includes("list_orders") && names.includes("sales_summary") && !names.includes("create_order"), `read tools only (got ${names})`);
    const orders = await (await rpc({ method: "tools/call", params: { name: "list_orders", arguments: {} } })).json();
    expect(orders.result.structuredContent.orders.some((x) => x.number === 1001 && x.customer === "Karim Api"), "orders read");
    const write = await (await rpc({ method: "tools/call", params: { name: "update_order_status", arguments: { number: 1001, status: "confirmed" } } })).json();
    expect(write.error && /no access/.test(write.error.message), "write refused");
    await owner.reload();
    await owner.locator("[data-testid=mcp-apps]").getByText("Claude 1.0").waitFor();
    await owner.locator("[data-token='Mon laptop'] [data-action=revoke]").click();
    await owner.waitForSelector("text=لا توجد رموز بعد.");
    expect((await rpc({ method: "ping" })).status === 401, "revoked token refused");
  });

  await step("Refer a seller: the link brings a new store; its first payment opens a voucher taken off the referrer's next request", async () => {
    await owner.goto(`${section}?tab=refer`);
    const link = (await owner.locator("[data-testid=refer-link]").innerText()).trim();
    expect(link.endsWith(`/r/shop-${tag}`), `link (got ${link})`);
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(`${BASE}/r/shop-${tag}`);
    await p.waitForURL(/\/register$/);
    const id = Date.now().toString(36);
    await p.fill("#name", "Referred");
    await p.fill("#email", `referred-${id}@test.dz`);
    await p.fill("#password", "password123");
    await p.fill("#phone", "0555 12 99 57");
    await p.fill("#shopName", "Referred shop");
    await p.fill("#shopSlug", `referred-${id}`);
    await Promise.all([p.waitForURL((u) => !u.pathname.endsWith("/register")), p.click("button[type=submit]")]);
    await ctx.close();
    const [[ref]] = await db.query("SELECT id, referred_by FROM shops WHERE slug = ?", [`referred-${id}`]);
    expect(ref.referred_by === shopId, "referred store linked");
    await owner.reload();
    expect((await owner.locator("[data-testid=refer-signups]").innerText()).trim() === "1", "one signup");
    // The referred store pays (10% off its first payment), the admin approves: the voucher becomes available
    const [[rocket]] = await db.query("SELECT id, price_monthly AS price FROM plans WHERE code = 'rocket'");
    const reqId = randomUUID();
    await db.query("INSERT INTO plan_requests (id, shop_id, plan_id, months, amount, method, status, requested_by) VALUES (?, ?, ?, 1, ?, 'whatsapp', 'pending', ?)", [reqId, ref.id, rocket.id, rocket.price, ref.id]);
    const adminId = randomUUID();
    await db.query("INSERT INTO users (id, email, name, password_hash, locale, is_platform_admin) VALUES (?, ?, 'Admin', 'scrypt$00$00', 'ar', 1)", [adminId, `admin38-${tag}@test.dz`]);
    const adminToken = randomBytes(32).toString("base64url");
    await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))", [createHash("sha256").update(adminToken).digest("hex"), adminId]);
    const adminContext = await browser.newContext();
    await adminContext.addCookies([{ name: "sc_session", value: adminToken, url: BASE }]);
    const admin = await adminContext.newPage();
    await admin.goto(`${BASE}/ar/admin/plan-requests`);
    const row = admin.locator(`tr[data-request-row="referred-${id}"]`);
    await row.locator("button", { hasText: "قبول وتفعيل" }).click();
    await row.getByText("مقبول").waitFor();
    await adminContext.close();
    for (let i = 0; i < 25; i++) {
      const [[x]] = await db.query("SELECT status FROM referral_vouchers WHERE shop_id = ?", [shopId]);
      if (x.status === "available") break;
      await new Promise((r) => setTimeout(r, 200));
    }
    const [[v]] = await db.query("SELECT status, value FROM referral_vouchers WHERE shop_id = ?", [shopId]);
    expect(v.status === "available" && v.value === rocket.price, `voucher available (got ${JSON.stringify(v)})`);
    await owner.reload();
    expect((await owner.locator("[data-testid=refer-paying]").innerText()).trim() === "1", "one paying seller");
    expect((await owner.locator("[data-testid=refer-vouchers]").innerText()).includes("1"), "vouchers shown");
    // The referrer's next request: half a month off (both on rocket), the voucher kept on the request
    await owner.goto(`${BASE}/ar/dashboard/plans`);
    await owner.click("[data-pay=local]");
    await owner.locator("[data-plan-card=rocket] button").click();
    const form = owner.locator("[data-testid=plan-request-form]");
    await form.waitFor();
    const half = Math.floor(rocket.price / 2);
    expect((await owner.locator("[data-testid=plan-amount]").innerText()).replace(/\s/g, "").includes(String(rocket.price - half)), "amount after the voucher");
    await owner.locator("[data-testid=plan-discount]").waitFor();
    await form.locator("input[name=method][value=whatsapp]").check();
    await form.locator("button[type=submit]").click();
    await owner.waitForSelector("[data-testid=plan-pending]");
    const [[req]] = await db.query("SELECT amount, discount, voucher_id FROM plan_requests WHERE shop_id = ?", [shopId]);
    expect(req.amount === rocket.price - half && req.discount === half && req.voucher_id, `request with the voucher (got ${JSON.stringify(req)})`);
  });

  await context.close();
}
