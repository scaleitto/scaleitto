// Phase 5: theme store — 13 themes with previews, applying a theme (with or without its color),
// the store and its product page follow the theme, and Store Design keeps the theme.
import { randomUUID } from "node:crypto";
import { BASE, createSession, createShop, db, expect, step } from "./helpers.mjs";

export default async function phase5(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const page = await context.newPage();
  const gallery = `${BASE}/ar/dashboard/themes`;
  const store = `${BASE}/store/shop-${tag}`;
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'ساعة', 'watch', 4500, '[]', '[]', '[]')", [randomUUID(), shopId]);
  const frameStyle = (p, prop) => p.locator("[data-testid=store-frame]").first().evaluate((el, name) => getComputedStyle(el).getPropertyValue(name).trim(), prop);

  await step("the gallery shows at least 12 themes, the classic one is current", async () => {
    await page.goto(gallery);
    const cards = page.locator("[data-theme-card]");
    expect((await cards.count()) >= 12, `12+ themes (got ${await cards.count()})`);
    await page.locator('[data-theme-card="classic"]').getByText("الثيم الحالي").waitFor();
  });

  await step("previewing a theme shows the store with it, without applying it", async () => {
    await page.click('[data-theme-card="night"] button:has-text("معاينة")');
    const preview = page.locator("[data-testid=theme-preview]");
    await preview.getByText("ساعة").waitFor();
    expect((await preview.locator("[data-testid=store-frame]").getAttribute("data-theme")) === "night", "preview uses the theme");
    await page.click('[role=dialog] button[aria-label="إغلاق"]');
    const [[row]] = await db.query("SELECT design FROM shops WHERE id = ?", [shopId]);
    expect(row.design === null, "nothing saved by a preview");
  });

  await step("applying a theme with its color changes the store", async () => {
    // A store that never picked a color takes the theme's color by default
    expect(!(await page.locator('input[type=checkbox]').isChecked()), "keep-color unticked for a default-colored store");
    await page.click('[data-theme-card="night"] button:has-text("تفعيل")');
    await page.waitForSelector("text=تم تفعيل ثيم ليلي");
    await page.locator('[data-theme-card="night"]').getByText("الثيم الحالي").waitFor();
    await page.goto(store);
    expect((await page.locator("[data-testid=store-frame]").getAttribute("data-theme")) === "night", "store uses night");
    expect((await frameStyle(page, "--brand")) === "#8b5cf6", "theme color applied");
    expect((await frameStyle(page, "--s-bg")) === "#0b0f17", "dark background");
  });

  await step("the product page and its order form follow the theme", async () => {
    await page.goto(`${store}/p/watch`);
    expect((await page.locator("[data-testid=store-frame]").getAttribute("data-theme")) === "night", "product page themed");
    const bg = await page.locator("#order-form").evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg === "rgb(20, 26, 36)", `order form on the theme's card color (${bg})`);
  });

  await step("keeping my own color when switching theme", async () => {
    await db.query("UPDATE shops SET primary_color = '#123456' WHERE id = ?", [shopId]);
    await page.goto(gallery);
    expect(await page.locator('input[type=checkbox]').isChecked(), "keep-color ticked for a custom color");
    await page.click('[data-theme-card="elegant"] button:has-text("تفعيل")');
    await page.waitForSelector("text=تم تفعيل ثيم أنيق");
    await page.goto(store);
    expect((await frameStyle(page, "--brand")) === "#123456", "own color kept");
    const font = await page.locator("[data-testid=store-frame]").evaluate((el) => getComputedStyle(el).fontFamily);
    expect(font.includes("El Messiri") || font.includes("el-messiri") || font.includes("Messiri"), `theme font (${font})`);
  });

  await step("saving Store Design keeps the chosen theme", async () => {
    await page.goto(`${BASE}/ar/dashboard/store-design`);
    await page.fill("#productsTitle", "جديدنا");
    await page.locator("form button[type=submit]").click();
    await page.waitForSelector("text=تم الحفظ");
    await page.goto(store);
    expect((await page.locator("[data-testid=store-frame]").getAttribute("data-theme")) === "elegant", "theme kept");
    await page.waitForSelector("text=جديدنا");
  });

  await step("call center agents cannot open the Theme Store", async () => {
    const agent = await createSession({ shopId, role: "agent", email: `agent-p5-${Date.now()}@test.dz` });
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "sc_session", value: agent.token, url: BASE }]);
    const p = await ctx.newPage();
    await p.goto(gallery);
    await p.waitForURL("**/ar/dashboard/orders");
    await ctx.close();
  });

  await context.close();
}
