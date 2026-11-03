// Phase 29 (Zimam parity, phase 5): Connected platforms — Google Sheets moved here, Shopify and WooCommerce send their
// orders (signed) and they arrive as pending orders, never twice; platforms not verified shown as coming — and Team:
// invite by email with a role, the invited person joins from the link, invitations can be cancelled.
import { createHmac, randomUUID } from "node:crypto";
import { BASE, createShop, db, expect, step } from "./helpers.mjs";
import { lastLink, platformHooks } from "./mock-apps.mjs";

export default async function phase29(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  const dash = `${BASE}/ar/dashboard`;
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, sku, images, options, offers) VALUES (?, ?, 'مصباح', 'lamp', 2000, 'LAMP-1', '[]', '[]', '[]')", [randomUUID(), shopId]);
  await db.query("INSERT INTO shop_contracts (id, shop_id, start_date, limits) VALUES (UUID(), ?, CURDATE() - INTERVAL 1 DAY, ?)", [shopId, JSON.stringify({ maxStaff: 4 })]);
  // The receiving address on this test server (APP_URL may name another host)
  const local = (url) => `${BASE}${new URL(url).pathname}`;
  const send = (url, header, secret, body) => {
    const raw = JSON.stringify(body);
    return fetch(local(url), { method: "POST", headers: { "Content-Type": "application/json", [header]: createHmac("sha256", secret).update(raw).digest("base64") }, body: raw });
  };

  await step("sidebar: Connected platforms in Sell, Team in Account", async () => {
    await owner.goto(dash);
    const order = await owner.locator("aside nav li[data-nav]").evaluateAll((els) => els.map((li) => li.dataset.nav));
    expect(order.join() === "overview,products,orders,scan,delivery,channels,callCenters,landingPages,analytics,pixels,apps,storeDesign,themes,settings,team,plans,balance,profile", `entries (got ${order.join()})`);
  });

  await step("connected platforms: Google Sheets here, Shopify and WooCommerce to connect, the others coming", async () => {
    await owner.goto(`${dash}/channels`);
    expect((await owner.locator("[data-channel=google_sheets][data-state=off]").count()) === 1, "Google Sheets card");
    expect((await owner.locator("[data-channel=shopify][data-state=off]").count()) === 1 && (await owner.locator("[data-channel=woocommerce][data-state=off]").count()) === 1, "both not connected");
    expect((await owner.locator("[data-channel-soon]").count()) === 4, "4 coming");
    // Each card's Connect opens the platform's own page
    await Promise.all([owner.waitForURL(/channels\/google_sheets$/), owner.locator("[data-channel=google_sheets] [data-testid=channel-open]").click()]);
    await owner.locator("[data-testid=sheets-import]").waitFor();
    await owner.click("[data-testid=sheets-tabs] [data-tab=export]");
    await owner.locator("[data-testid=app-sheets]").waitFor();
    await owner.goto(`${dash}/integrations/apps`);
    expect(!(await owner.locator("[data-testid=app-sheets]").count()), "no longer in Apps");
  });

  await step("WooCommerce: https address required; one-click connect (approval on the store, webhook created); a refused setup shows the manual steps; signed orders arrive once", async () => {
    await owner.goto(`${dash}/channels/woocommerce`);
    const card = owner.locator("[data-channel=woocommerce]");
    await card.locator("#woocommerce-storeUrl").fill("http://shop.example.com");
    await card.locator("[data-testid=channel-connect]").click();
    await card.getByText("يجب أن يبدأ الرابط بـ https://").waitFor();
    // A store that refuses the webhook: the receiving address and secret to add by hand
    await card.locator("#woocommerce-storeUrl").fill(`${process.env.E2E_APPS_URL}/woo-bad`);
    await Promise.all([owner.waitForURL(/channels\/woocommerce$/), card.locator("[data-testid=channel-connect]").click()]);
    await owner.locator("[data-testid=channel-manual]").getByText("Sorry, you cannot create resources.").waitFor();
    await owner.getByRole("button", { name: "إعادة الربط" }).click();
    await card.locator("#woocommerce-storeUrl").fill(`${process.env.E2E_APPS_URL}/woo/`);
    await Promise.all([owner.waitForURL(/channels\/woocommerce$/), card.locator("[data-testid=channel-connect]").click()]);
    await owner.locator("[data-channel=woocommerce][data-state=on] [data-testid=channel-auto]").waitFor();
    const hook = platformHooks.findLast((h) => h.platform === "woocommerce").body;
    expect(hook.topic === "order.created" && hook.delivery_url.includes("/api/channels/") && hook.secret, "webhook created on the store");
    const url = hook.delivery_url.replace(/^https?:\/\/[^/]+/, BASE);
    const secret = hook.secret;
    const order = { id: 555, number: "555", total: "2400", shipping_total: "400", billing: { first_name: "Sara", last_name: "B", phone: "0661 23 45 67", city: "Kouba", state: "DZ-16", address_1: "Rue 1" }, shipping: {}, line_items: [{ name: "Lamp (EN)", sku: "LAMP-1", quantity: 1, price: 2000, total: "2000" }] };
    expect((await send(url, "x-wc-webhook-signature", "wrong", order)).status === 401, "unsigned refused");
    const first = await (await send(url, "x-wc-webhook-signature", secret, order)).json();
    const again = await (await send(url, "x-wc-webhook-signature", secret, order)).json();
    expect(first.created === true && again.created === false, "created once");
    const [[o]] = await db.query("SELECT o.status, o.channel, o.wilaya_code, o.total, o.phone, i.name, i.product_id FROM orders o JOIN order_items i ON i.order_id = o.id WHERE o.shop_id = ? AND o.external_ref = 'woocommerce:555'", [shopId]);
    expect(o.status === "pending" && o.channel === "woocommerce" && o.wilaya_code === 16 && o.total === 2400 && o.phone === "0661234567", `order (got ${JSON.stringify(o)})`);
    expect(o.name === "مصباح" && o.product_id, "matched to the store's product");
    await owner.goto(`${dash}/channels`);
    expect((await owner.locator("[data-channel=woocommerce] [data-testid=channel-receiving]").innerText()).includes("1"), "the card counts it");
  });

  await step("Shopify: myshopify address, Admin API token and secret; the token is checked and the webhook created; a paused channel receives nothing", async () => {
    await owner.goto(`${dash}/channels/shopify`);
    const card = owner.locator("[data-channel=shopify]");
    await card.locator("#shopify-storeUrl").fill("my-shop.com");
    await card.locator("#shopify-token").fill("shpat_wrongtoken1234567890");
    await card.locator("#shopify-secret").fill("shopify-signing-key-123456");
    await card.locator("[data-testid=channel-connect]").click();
    await card.getByText("name.myshopify.com").first().waitFor();
    await card.locator("#shopify-storeUrl").fill(`https://shop-${tag}.myshopify.com/admin`);
    await card.locator("[data-testid=channel-connect]").click();
    await card.getByText("Invalid API key or access token").waitFor();
    expect(!(await db.query("SELECT id FROM shop_channels WHERE shop_id = ? AND kind = 'shopify'", [shopId]))[0].length, "nothing kept after a refusal");
    await card.locator("#shopify-token").fill("shpat_goodtoken1234567890");
    await card.locator("[data-testid=channel-connect]").click();
    await owner.locator("[data-channel=shopify][data-state=on] [data-testid=channel-auto]").waitFor();
    expect(!(await card.locator("[data-testid=channel-secret]").count()), "Shopify's key is never shown back");
    const hook = platformHooks.findLast((h) => h.platform === "shopify").body.webhook;
    expect(hook.topic === "orders/create" && hook.format === "json", "webhook created in Shopify");
    const url = hook.address.replace(/^https?:\/\/[^/]+/, BASE);
    const order = { id: 9001, name: "#1001", total_price: "3300.00", shipping_lines: [{ price: "300.00" }], shipping_address: { first_name: "Karim", last_name: "D", phone: "+213770112233", city: "Es Senia", province_code: "DZ-31" }, line_items: [{ title: "Montre", quantity: 1, price: "3000.00", sku: "" }] };
    const r = await (await send(url, "x-shopify-hmac-sha256", "shopify-signing-key-123456", order)).json();
    expect(r.created === true, "created");
    const [[o]] = await db.query("SELECT channel, wilaya_code, customer_name, phone FROM orders WHERE shop_id = ? AND external_ref = 'shopify:9001'", [shopId]);
    expect(o.channel === "shopify" && o.wilaya_code === 31 && o.customer_name === "Karim D" && o.phone === "0770112233", `order (got ${JSON.stringify(o)})`);
    await card.locator("[data-testid=channel-toggle]").click();
    await owner.locator("[data-channel=shopify][data-state=paused]").waitFor();
    expect((await send(url, "x-shopify-hmac-sha256", "shopify-signing-key-123456", { ...order, id: 9002 })).status === 404, "paused");
  });

  const email = `invitee-${tag}@test.dz`;
  await step("team: invite an agent by email; the link is sent and shown", async () => {
    await owner.goto(`${dash}/team`);
    expect((await owner.locator("[data-testid=team-count]").innerText()).includes("1 / 4"), "the owner counts");
    await owner.click("[data-testid=invite-open]");
    await owner.fill("#invite-email", email);
    await owner.selectOption("#invite-role", "agent");
    await owner.click("[data-testid=invite-send]");
    await owner.locator("[data-testid=invite-link]").waitFor();
    expect(Boolean(lastLink(email)), "invitation emailed");
    await owner.reload();
    await owner.locator(`[data-invite="${email}"]`).waitFor();
    expect((await owner.locator("[data-testid=team-count]").innerText()).includes("2 / 4"), "the invitation counts");
  });

  await step("the invited agent joins from the link and lands in the call-center portal", async () => {
    const link = lastLink(email);
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(`${BASE}${new URL(link).pathname}`);
    await p.locator("[data-testid=invite-accept]").getByText(email).waitFor();
    await p.fill("#name", "سمير");
    await p.fill("#password", "short");
    await p.click("[data-testid=invite-accept-submit]");
    await p.getByText("كلمة المرور قصيرة").waitFor();
    await p.fill("#password", "a-good-password-1");
    await Promise.all([p.waitForURL((u) => u.pathname === "/ar/call-center"), p.click("[data-testid=invite-accept-submit]")]);
    const [[m]] = await db.query("SELECT m.role FROM shop_members m JOIN users u ON u.id = m.user_id WHERE m.shop_id = ? AND u.email = ?", [shopId, email]);
    expect(m.role === "agent", "member as agent");
    // The link works once
    const again = await browser.newPage();
    await again.goto(`${BASE}${new URL(link).pathname}`);
    await again.getByText("رابط الدعوة غير صالح").waitFor();
    await again.close();
    await ctx.close();
    await owner.goto(`${dash}/team`);
    await owner.locator(`[data-member="${email}"]`).waitFor();
  });

  await step("an invitation can be cancelled", async () => {
    await owner.click("[data-testid=invite-open]");
    await owner.fill("#invite-email", `other-${tag}@test.dz`);
    await owner.click("[data-testid=invite-send]");
    await owner.locator("[data-testid=invite-link]").waitFor();
    await owner.reload();
    await owner.locator(`[data-invite="other-${tag}@test.dz"] [data-testid=invite-revoke]`).click();
    await owner.locator(`[data-invite="other-${tag}@test.dz"]`).waitFor({ state: "detached" });
  });

  await context.close();
}
