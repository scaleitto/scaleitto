// Phase 10: apps — Google Sheets (Apps Script web app: new orders added, changes update the same row,
// last 30 days sent on demand), Ecomanager through the sheet, signed webhooks, product import from
// Shopify and YouCan, the log, roles and tenant isolation.
import { createHmac, randomUUID } from "node:crypto";
import { BASE, createSession, createShop, db, expect, step, setOrderStatus } from "./helpers.mjs";
import { hooks, sheet } from "./mock-apps.mjs";

const FAKE = process.env.E2E_APPS_URL;

async function waitFor(fn, what, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Expected: ${what}`);
}

export default async function phase10(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  owner.on("dialog", (d) => d.accept());
  const section = `${BASE}/ar/dashboard/integrations/apps`;
  // Google Sheets lives in Connected platforms
  const channelsPage = `${BASE}/ar/dashboard/channels/google_sheets?tab=export`;
  const productId = randomUUID();
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'قميص', 'shirt', 2000, '[]', '[]', '[]')", [productId, shopId]);
  await db.query("INSERT INTO shipping_rates (shop_id, wilaya_code, home_price, office_price) VALUES (?, 16, 400, 300)", [shopId]);
  const sheets = owner.locator("[data-testid=app-sheets]");
  const webhook = owner.locator("[data-testid=app-webhook]");

  await step("Google Sheets: script with the shop's token, Google URL required, test writes the header row", async () => {
    await owner.goto(channelsPage);
    await owner.waitForSelector("[data-testid=app-sheets][data-state=off]");
    await sheets.locator("button", { hasText: "ربط" }).click();
    await owner.waitForSelector("[data-testid=app-sheets][data-state=waiting]");
    const script = await owner.locator("[data-testid=sheets-script]").inputValue();
    sheet.token = script.match(/const TOKEN = "([^"]+)"/)?.[1];
    expect(sheet.token && script.includes("function doPost"), "script with a token");
    await owner.fill("#google_sheets-url", "https://example.com/exec");
    await sheets.locator("button[type=submit]").click();
    await owner.waitForSelector("text=الصق رابط Web app من Apps Script");
    await owner.fill("#google_sheets-url", `${FAKE}/sheets/exec`);
    await sheets.locator("button[type=submit]").click();
    await owner.waitForSelector("[data-testid=app-sheets][data-state=on]");
    expect(sheet.headers?.[0] === "رقم الطلب" && sheet.headers.includes("الهاتف"), "header row in the shop's language");
  });

  let orderId;
  await step("a new order becomes a row; a status change updates the same row", async () => {
    const customer = await browser.newPage();
    await customer.goto(`${BASE}/store/shop-${tag}/p/shirt`);
    await customer.fill("#name", "أمين");
    await customer.fill("#phone", "0555 44 33 22");
    await customer.selectOption("#wilaya", "16");
    await customer.selectOption("#commune", "القبة");
    await Promise.all([customer.waitForURL(/\/thanks\?o=/), customer.click("button[type=submit]")]);
    orderId = new URL(customer.url()).searchParams.get("o");
    await customer.close();
    const row = await waitFor(() => sheet.rows.get("1001"), "row #1001 in the sheet");
    const col = (name) => row[sheet.headers.indexOf(name)];
    expect(col("الهاتف") === "0555443322" && col("الحالة") === "قيد الانتظار" && col("المجموع") === "2400" && col("المنتجات").includes("قميص × 1"), `row content (got ${row.join(" | ")})`);
    await owner.goto(`${BASE}/ar/dashboard/orders/${orderId}`);
    await setOrderStatus(owner, "confirmed");
    await waitFor(() => sheet.rows.get("1001")?.[sheet.headers.indexOf("الحالة")] === "مؤكدة", "row updated to confirmed");
    expect([...sheet.rows.keys()].filter((k) => k !== "TEST").length === 1, "same row, not a new one");
  });

  await step("last 30 days sent on demand; a wrong token shows the script's answer", async () => {
    for (const [n, days] of [[901, 5], [902, 40]]) {
      await db.query("INSERT INTO orders (id, shop_id, number, customer_name, phone, wilaya_code, commune, delivery_type, subtotal, shipping_price, total, created_at) VALUES (UUID(), ?, ?, 'قديم', '0661000000', 16, 'x', 'home', 1000, 0, 1000, ?)", [shopId, n, new Date(Date.now() - days * 86400_000)]);
    }
    await owner.goto(channelsPage);
    await sheets.locator("button", { hasText: "إرسال طلبات آخر 30 يوماً" }).click();
    await sheets.getByText("تم إرسال 2 طلب إلى الجدول").waitFor();
    expect(sheet.rows.has("901") && !sheet.rows.has("902"), "only the last 30 days");
    const real = sheet.token;
    sheet.token = "another";
    await sheets.getByRole("button", { name: "اختبار", exact: true }).click();
    await sheets.getByText("فشل الاختبار: Script: wrong token").waitFor();
    sheet.token = real;
  });

  await step("webhook: signed JSON for tests and order changes", async () => {
    await owner.goto(`${section}/webhook`);
    await webhook.locator("button", { hasText: "ربط" }).click();
    const secret = await owner.locator("[data-testid=webhook-secret]").inputValue();
    await owner.fill("#webhook-url", "http://insecure.example/hook");
    await webhook.locator("button[type=submit]").click();
    await owner.waitForSelector("text=رابط غير صحيح");
    await owner.fill("#webhook-url", `${FAKE}/hook`);
    await webhook.locator("button[type=submit]").click();
    await owner.waitForSelector("[data-testid=app-webhook][data-state=on]");
    const test = await waitFor(() => hooks.find((h) => h.body.event === "test"), "test event");
    const sign = (raw) => `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
    expect(test.headers["x-scaleitto-signature"] === sign(test.raw), "test signed with the shop's key");
    await owner.goto(`${BASE}/ar/dashboard/orders/${orderId}`);
    await setOrderStatus(owner, "call_back");
    const update = await waitFor(() => hooks.find((h) => h.body.event === "order.updated" && h.body.order.status === "call_back"), "order.updated");
    const o = update.body.order;
    expect(o.number === 1001 && o.total === 2400 && o.currency === "DZD" && o.customer.phone === "0555443322" && o.items[0].name === "قميص", "order payload");
    expect(update.headers["x-scaleitto-event"] === "order.updated" && update.headers["x-scaleitto-signature"] === sign(update.raw), "signed update");
  });

  await step("a paused sheet receives nothing; the log lists every send", async () => {
    await owner.goto(channelsPage);
    await sheets.locator("input[type=checkbox]").uncheck();
    await owner.waitForTimeout(400);
    await owner.goto(`${BASE}/ar/dashboard/orders/${orderId}`);
    await setOrderStatus(owner, "pending");
    await waitFor(() => hooks.some((h) => h.body.order?.status === "pending"), "webhook still receives");
    expect(sheet.rows.get("1001")[sheet.headers.indexOf("الحالة")] !== "قيد الانتظار", "paused sheet not updated");
    await owner.goto(`${section}/webhook`);
    const log = owner.locator("[data-testid=app-log]");
    expect((await log.locator("tr[data-app=google_sheets][data-kind=order][data-ok='1']").count()) >= 2, "sheet sends logged");
    expect((await log.locator("tr[data-kind=test][data-ok='0']").count()) === 1, "failed test logged");
  });

  await step("Shopify import: catalog shown, chosen products created as drafts with variants and photos", async () => {
    await owner.goto(`${section}/productImport`);
    const imp = owner.locator("[data-testid=product-import]");
    await owner.fill("#import-input", FAKE);
    await imp.locator("button[type=submit]").click();
    await imp.getByText("2 منتج", { exact: true }).waitFor();
    await imp.locator("button", { hasText: "استيراد 2 منتج" }).click();
    await owner.locator("[data-testid=import-result]").getByText("تم: 2 منتج جديد، 0 موجود سابقاً، 0 فشل.").waitFor({ timeout: 30_000 });
    const [[robe]] = await db.query("SELECT * FROM products WHERE shop_id = ? AND name = ?", [shopId, "Robe d'été"]);
    const images = typeof robe.images === "string" ? JSON.parse(robe.images) : robe.images;
    expect(robe.status === "draft" && robe.price === 2500 && robe.compare_at_price === 3200 && robe.external_ref.startsWith("shopify:"), "draft with prices");
    expect(images.length === 1 && images[0].startsWith(`/uploads/${shopId}/`), "photo copied, broken one skipped");
    const [variants] = await db.query("SELECT title, price, sku FROM product_variants WHERE product_id = ? ORDER BY position", [robe.id]);
    expect(variants.map((v) => `${v.title}:${v.price}:${v.sku}`).join() === "S / Rouge:null:ROBE-S,M / Rouge:2700:ROBE-M", `variants (got ${variants.map((v) => v.title).join()})`);
    await imp.locator("button[type=submit]").click();
    await imp.locator("[data-testid=catalog]").getByText("مستورد سابقاً").first().waitFor();
    expect((await imp.locator("[data-testid=catalog]").getByText("مستورد سابقاً").count()) === 2, "both marked as imported");
    expect(await imp.locator("button", { hasText: "استيراد 0 منتج" }).isDisabled(), "nothing left to import");
  });

  await step("YouCan import with an access token", async () => {
    const imp = owner.locator("[data-testid=product-import]");
    await imp.locator("nav button", { hasText: "YouCan" }).click();
    await owner.fill("#import-input", "bad");
    await imp.locator("button[type=submit]").click();
    await owner.waitForSelector("text=رمز YouCan غير صحيح أو منتهي");
    await owner.fill("#import-input", "good-yc");
    await imp.locator("button[type=submit]").click();
    await imp.getByText("1 منتج", { exact: true }).waitFor();
    await imp.locator("button", { hasText: "استيراد 1 منتج" }).click();
    await owner.locator("[data-testid=import-result]").getByText("تم: 1 منتج جديد").waitFor({ timeout: 30_000 });
    const [[watch]] = await db.query("SELECT price, compare_at_price, options, external_ref FROM products WHERE shop_id = ? AND name = 'Montre YouCan'", [shopId]);
    const options = typeof watch.options === "string" ? JSON.parse(watch.options) : watch.options;
    expect(watch.price === 4200 && watch.compare_at_price === 5000 && options.length === 0 && watch.external_ref === "youcan:yc-1", "YouCan product");
  });

  await step("agents cannot open apps; another shop has none of this shop's apps", async () => {
    const { token } = await createSession({ shopId, role: "agent", email: `agent10-${tag}@test.dz` });
    const agentContext = await browser.newContext();
    await agentContext.addCookies([{ name: "sc_session", value: token, url: BASE }]);
    const agent = await agentContext.newPage();
    await agent.goto(section);
    await agent.waitForURL((u) => !u.pathname.includes("apps"));
    await agentContext.close();
    const other = await createShop(browser);
    const p = await other.context.newPage();
    await p.goto(channelsPage);
    await p.waitForSelector("[data-testid=app-sheets][data-state=off]");
    await p.goto(`${section}/webhook`);
    expect(await p.locator("[data-testid=app-webhook][data-state=off]").count(), "webhook not connected");
    await other.context.close();
  });

  await context.close();
}
