// Phase 18 (owner's feedback): Google Sheets orders kept in a queue while Google fails (sent later by "send now"
// or the cron link) and the store's "how to order" steps.
import { createHash, randomUUID } from "node:crypto";
import { BASE, createShop, db, expect, step } from "./helpers.mjs";
import { sheet } from "./mock-apps.mjs";

const FAKE = process.env.E2E_APPS_URL;

export default async function phase18(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  const dash = `${BASE}/ar/dashboard`;
  await db.query("INSERT INTO shop_contracts (id, shop_id, start_date, limits) VALUES (?, ?, CURDATE() - INTERVAL 1 DAY, ?)", [randomUUID(), shopId, JSON.stringify({ maxLandingPages: 10, maxAiPerMonth: 30 })]);

  await step("Google fails: the order waits in the queue, then 'send now' delivers it", async () => {
    await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'منتج', 'item', 2500, '[]', '[]', '[]')", [randomUUID(), shopId]);
    await owner.goto(`${dash}/channels/google_sheets`);
    const sheets = owner.locator("[data-testid=app-sheets]");
    await sheets.locator("button", { hasText: "ربط" }).click();
    sheet.token = (await owner.locator("[data-testid=sheets-script]").inputValue()).match(/const TOKEN = "([^"]+)"/)?.[1];
    await owner.fill("#google_sheets-url", `${FAKE}/sheets/exec`);
    await sheets.locator("button[type=submit]").click();
    await owner.waitForSelector("[data-testid=app-sheets][data-state=on]");

    sheet.rows.clear(); // earlier phases wrote their own #1001
    sheet.order.length = 0;
    sheet.down = true;
    const customer = await browser.newPage();
    await customer.goto(`${BASE}/store/shop-${tag}/p/item`);
    await customer.fill("#name", "زبون");
    await customer.fill("#phone", "0555 66 77 88");
    await customer.selectOption("#wilaya", "16");
    await customer.selectOption("#commune", "القبة");
    await Promise.all([customer.waitForURL(/\/thanks\?o=/), customer.click("button[type=submit]")]);
    await customer.close();
    // The first try runs right after the order is placed: wait until its failure is recorded
    for (let i = 0; i < 20 && !(await db.query("SELECT 1 FROM app_queue WHERE shop_id = ? AND last_error IS NOT NULL", [shopId]))[0].length; i++) await owner.waitForTimeout(500);
    await owner.reload();
    const queue = owner.locator("[data-testid=app-queue]");
    await queue.waitFor();
    expect((await queue.getAttribute("data-waiting")) === "1" && (await queue.innerText()).includes("Service unavailable"), "1 order waiting, with Google's answer");
    expect(!sheet.rows.has("1001"), "nothing written while Google fails");

    sheet.down = false;
    await queue.locator("button").click();
    await sheets.getByText("تم إرسال 1 طلبية، المتبقي: 0").waitFor();
    expect(sheet.rows.get("1001")?.includes("0555667788"), "the order reached the sheet");
    const [[sent]] = await db.query("SELECT detail FROM app_events WHERE shop_id = ? AND kind = 'order' AND ok = 1 ORDER BY created_at DESC LIMIT 1", [shopId]);
    expect(sent?.detail === "Orders: 1001 → 2", `the log says the tab and the row (got ${sent?.detail})`);
    const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM app_queue WHERE shop_id = ?", [shopId]);
    expect(n === 0, "queue empty");
  });

  await step("the cron link needs its key and sends what is waiting", async () => {
    const key = createHash("sha256").update(`scaleitto-cron:${process.env.APP_SECRET || process.env.DATABASE_URL}`).digest("hex").slice(0, 32);
    expect((await fetch(`${BASE}/api/cron/apps?key=wrong`)).status === 403, "wrong key refused");
    const [[order]] = await db.query("SELECT id FROM orders WHERE shop_id = ? AND number = 1001", [shopId]);
    await db.query("INSERT INTO app_queue (id, shop_id, order_id, event, attempts, next_at) VALUES (?, ?, ?, 'order.updated', 0, NOW(3) - INTERVAL 1 DAY) ON DUPLICATE KEY UPDATE next_at = VALUES(next_at)", [randomUUID(), shopId, order.id]);
    await db.query("UPDATE orders SET customer_name = 'زبون من الكرون' WHERE id = ?", [order.id]);
    const res = await fetch(`${BASE}/api/cron/apps?key=${key}`);
    expect(res.ok, `cron answered ${res.status}`);
    expect(sheet.rows.get("1001")?.includes("زبون من الكرون"), "row updated by the cron run");
  });

  await step("store: the three ordering steps, on a phone", async () => {
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await phone.goto(`${BASE}/store/shop-${tag}`);
    expect((await phone.locator("[data-testid=order-steps] li").count()) === 3, "3 steps");
    expect((await phone.evaluate(() => document.documentElement.scrollWidth)) <= 390, "no sideways scrolling");
    await phone.close();
  });

  await step("storefront contrast and icons: readable text on a light main color, SVG trust badge icons", async () => {
    await db.query("UPDATE shops SET primary_color = '#facc15', design = ? WHERE id = ?", [JSON.stringify({ theme: "classic" }), shopId]);
    const [[product]] = await db.query("SELECT id FROM products WHERE shop_id = ? LIMIT 1", [shopId]);
    const sections = [{ id: "t", type: "text", title: "عنوان", body: "" }, { id: "b", type: "badges", items: [{ icon: "truck", text: "توصيل" }, "نص قديم"] }];
    await db.query("INSERT INTO landing_pages (id, shop_id, product_id, slug, title, status, sections, published) VALUES (?, ?, ?, 'icons', 'icons', 'published', ?, ?)", [randomUUID(), shopId, product.id, JSON.stringify(sections), JSON.stringify({ sections, variants: [] })]);
    const visitor = await browser.newPage();
    await visitor.goto(`${BASE}/store/shop-${tag}/lp/icons`);
    const cards = visitor.locator("[data-section=badges] li");
    expect((await cards.nth(0).locator("svg").count()) === 1 && (await cards.nth(1).locator("svg").count()) === 1 && (await cards.nth(1).innerText()).includes("نص قديم"), "icons drawn as SVG, older text badges kept");
    const color = await visitor.locator("button[type=submit]").evaluate((el) => getComputedStyle(el).color);
    expect(color === "rgb(17, 17, 17)", `dark text on a yellow button (got ${color})`);
    await visitor.close();
  });

  await context.close();
}
