// Phase 18 (owner's feedback): AliExpress-style links that redirect in a loop until their cookie comes back,
// image pages with 2 images, Google Sheets orders kept in a queue while Google fails (sent later by "send now"
// or the cron link), the store's "how to order" steps and the public homepage.
import { createHash, randomUUID } from "node:crypto";
import { BASE, createShop, db, expect, step, wizardGenerate } from "./helpers.mjs";
import { requests } from "./mock-openai.mjs";
import { sheet } from "./mock-apps.mjs";

const FAKE = process.env.E2E_APPS_URL;
const json = (v) => (typeof v === "string" ? JSON.parse(v) : v);

export default async function phase18(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  const dash = `${BASE}/ar/dashboard`;
  await db.query("INSERT INTO shop_contracts (id, shop_id, start_date, limits) VALUES (?, ?, CURDATE() - INTERVAL 1 DAY, ?)", [randomUUID(), shopId, JSON.stringify({ maxLandingPages: 10, maxAiPerMonth: 30 })]);

  await step("AI image page from a product link that redirects until its cookie is sent, with 2 images", async () => {
    await owner.goto(`${dash}/landing-pages/new`);
    await owner.locator("[data-testid=source] button", { hasText: "رابط منتج" }).click();
    await owner.fill("#ai-url", `${FAKE}/aliexpress/item/1005.html?spm=a2g0o.home&gatewayAdapt=glo2ara`);
    await owner.fill("#ai-price", "2900");
    const counts = await owner.locator("#ai-count option").evaluateAll((os) => os.map((o) => o.value).join());
    expect(counts === "2,4,6,8,10", `image counts (got ${counts})`);
    await owner.selectOption("#ai-count", "2");
    await wizardGenerate(owner);
    await owner.waitForURL(/landing-pages\/[0-9a-f-]{36}$/, { timeout: 90_000 });
    const [[page]] = await db.query("SELECT sections FROM landing_pages WHERE id = ?", [owner.url().split("/").pop()]);
    expect(json(page.sections).filter((s) => s.type === "poster").length === 2, "2 designed images");
    const plan = requests.find((r) => JSON.stringify(r.input ?? "").includes("Lampe anti moustique"));
    expect(plan && !JSON.stringify(plan.input).includes("- AliExpress"), "the page's title read from the product data, without the site name");
    expect(plan.instructions.includes("Angle library") && plan.instructions.includes("hidden problem") && !plan.instructions.includes("MERCHANT BRIEF"), "the platform's marketing method and angle library");
  });

  await step("own prompt: used for the generation, saved as the store's default; the strategy is shown in the editor", async () => {
    await owner.goto(`${dash}/landing-pages/new`);
    expect((await owner.locator("[data-testid=prompt-mode] button[aria-pressed=true]").innerText()).includes("منهجية المنصة"), "platform method by default");
    await owner.locator("[data-testid=prompt-mode] button", { hasText: "البرومبت الخاص بي" }).click();
    expect(await owner.locator("[data-testid=ai-next]").isDisabled(), "an empty prompt cannot be used");
    await owner.fill("#ai-prompt", "أنت خبير تسويق. ركّز على زاوية راحة البال واسألني قبل التنفيذ.");
    await owner.locator("[data-testid=save-prompt]").check();
    await owner.selectOption("#ai-count", "2");
    await owner.click("[data-testid=ai-next]");
    await owner.locator("[data-testid=ai-confirm]").getByText("البرومبت الخاص بي").waitFor();
    await owner.locator("[data-testid=ai-confirm] button").last().click();
    await owner.waitForURL(/landing-pages\/[0-9a-f-]{36}$/, { timeout: 90_000 });
    const plan = requests.filter((r) => r.text?.format?.name === "image_landing_page").pop();
    expect(plan?.instructions.includes("MERCHANT BRIEF") && plan.instructions.includes("ركّز على زاوية راحة البال") && plan.instructions.includes("never ask questions") && !plan.instructions.includes("Angle library"), "the merchant's prompt replaces the method, with the format and honesty rules kept");
    const [[shop]] = await db.query("SELECT ai_prompt FROM shops WHERE id = ?", [shopId]);
    expect(shop.ai_prompt?.includes("راحة البال"), "saved as the store's default");
    const [[page]] = await db.query("SELECT strategy FROM landing_pages WHERE id = ?", [owner.url().split("/").pop()]);
    const strategy = json(page.strategy);
    expect(strategy?.custom === true && strategy.angles.length === 3 && strategy.audience === "العائلات", "strategy saved with the page");
    await owner.locator("[data-testid=page-strategy] summary").click();
    expect((await owner.locator("[data-testid=page-strategy] [data-angle]").count()) === 3, "the angles shown in the editor");
    await owner.locator("[data-editor-section=poster]").first().locator("button[aria-expanded]").click();
    await owner.locator("[data-testid=poster-angle]").getByText("نوم هادئ").waitFor();
    await owner.goto(`${dash}/landing-pages/new`);
    expect((await owner.inputValue("#ai-prompt")).includes("راحة البال"), "the saved prompt is ready next time");
  });

  await step("Google fails: the order waits in the queue, then 'send now' delivers it", async () => {
    await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'منتج', 'item', 2500, '[]', '[]', '[]')", [randomUUID(), shopId]);
    await owner.goto(`${dash}/apps`);
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
    await customer.fill("#commune", "القبة");
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

  await step("store: the three ordering steps; homepage: the order journey, on a phone", async () => {
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await phone.goto(`${BASE}/store/shop-${tag}`);
    expect((await phone.locator("[data-testid=order-steps] li").count()) === 3, "3 steps");
    await phone.goto(`${BASE}/ar`);
    expect((await phone.locator("#journey li").count()) === 6, "6 journey steps");
    expect((await phone.evaluate(() => document.documentElement.scrollWidth)) <= 390, "no sideways scrolling");
    await phone.close();
  });

  await context.close();
}
