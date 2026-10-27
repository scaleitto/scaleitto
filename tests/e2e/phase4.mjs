// Phase 4: store design — logo, color, announcement bar, banner, products title, perks, footer and
// social links, with a live preview, applied to every storefront page.
import { randomUUID } from "node:crypto";
import { BASE, createSession, createShop, db, expect, pngBuffer, step } from "./helpers.mjs";

export default async function phase4(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const page = await context.newPage();
  const editor = `${BASE}/ar/dashboard/store-design`;
  const store = `${BASE}/store/shop-${tag}`;
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, compare_at_price, images, options, offers) VALUES (?, ?, 'ساعة', 'watch', 4500, 6000, '[]', '[]', '[]')", [randomUUID(), shopId]);

  await step("a new store has no banner or announcement, perks shown by default", async () => {
    await page.goto(store);
    await page.waitForSelector("[data-testid=badges]");
    expect(!(await page.locator("[data-testid=hero]").count()) && !(await page.locator("[data-testid=announcement]").count()), "nothing extra yet");
  });

  await step("the live preview follows the form before saving", async () => {
    await page.goto(editor);
    const preview = page.locator("[data-testid=design-preview]");
    await page.check('input[name="announcementEnabled"]');
    await page.fill("#announcementText", "توصيل سريع لكل الولايات");
    await page.check('input[name="heroEnabled"]');
    await page.fill("#heroTitle", "تخفيضات الصيف");
    await page.fill("#heroButtonText", "تسوق الآن");
    await page.fill("#productsTitle", "الأكثر مبيعاً");
    await preview.getByText("توصيل سريع لكل الولايات").waitFor();
    await preview.getByText("تخفيضات الصيف").waitFor();
    await preview.getByText("الأكثر مبيعاً").waitFor();
    await page.click('button[aria-label="#7c3aed"]');
    const color = await preview.locator("[data-testid=store-frame]").evaluate((el) => getComputedStyle(el).getPropertyValue("--brand").trim());
    expect(color === "#7c3aed", `preview color (${color})`);
  });

  await step("wrong values are refused with clear messages and nothing is lost", async () => {
    await page.fill("#primaryColor", "red");
    await page.fill("#instagram", "https://facebook.com/x");
    await page.locator("form button[type=submit]").click();
    await page.waitForSelector("text=لون غير صحيح");
    await page.waitForSelector("text=رابط غير صحيح لهذا الموقع");
    expect((await page.inputValue("#heroTitle")) === "تخفيضات الصيف", "typed values kept");
  });

  await step("saving applies logo, color, banner, footer and social links to the store", async () => {
    await page.fill("#primaryColor", "#7c3aed");
    await page.fill("#instagram", "instagram.com/myshop");
    await page.fill("#whatsapp", "0555 12 34 56");
    await page.fill("#about", "متجر جزائري للساعات الأصلية");
    await page.locator("[data-testid=image-input]").first().setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: pngBuffer([37, 99, 235]) });
    await page.locator("[data-testid=design-preview] [data-testid=store-logo]").waitFor();
    await page.locator("form button[type=submit]").click();
    await page.waitForSelector("text=تم الحفظ");

    await page.goto(store);
    await page.waitForSelector("[data-testid=announcement] >> text=توصيل سريع لكل الولايات");
    await page.waitForSelector("[data-testid=hero] >> text=تخفيضات الصيف");
    await page.waitForSelector("text=الأكثر مبيعاً");
    const logo = await page.locator("[data-testid=store-logo]").getAttribute("src");
    expect(logo.startsWith("/uploads/"), "logo shown");
    const footer = page.locator("[data-testid=store-footer]");
    await footer.getByText("متجر جزائري للساعات الأصلية").waitFor();
    expect((await footer.locator('a:has-text("Instagram")').getAttribute("href")) === "https://instagram.com/myshop", "instagram link");
    expect((await footer.locator('a:has-text("WhatsApp")').getAttribute("href")) === "https://wa.me/213555123456", "whatsapp link");
    const brand = await page.locator("[data-testid=store-frame]").evaluate((el) => getComputedStyle(el).getPropertyValue("--brand").trim());
    expect(brand === "#7c3aed", `store color (${brand})`);
  });

  await step("product pages share the announcement bar and footer", async () => {
    await page.goto(`${store}/p/watch`);
    await page.waitForSelector("[data-testid=announcement]");
    await page.waitForSelector("[data-testid=store-footer] >> text=متجر جزائري للساعات الأصلية");
  });

  await step("turning sections off hides them and keeps their text for later", async () => {
    await page.goto(editor);
    await page.uncheck('input[name="heroEnabled"]');
    await page.uncheck('input[name="showBadges"]');
    await page.locator("form button[type=submit]").click();
    await page.waitForSelector("text=تم الحفظ");
    await page.goto(store);
    await page.waitForSelector("[data-testid=announcement]");
    expect(!(await page.locator("[data-testid=hero]").count()) && !(await page.locator("[data-testid=badges]").count()), "banner and perks hidden");
    const [[row]] = await db.query("SELECT design FROM shops WHERE id = ?", [shopId]);
    const design = typeof row.design === "string" ? JSON.parse(row.design) : row.design;
    expect(design.hero.title === "تخفيضات الصيف" && design.hero.enabled === false, "banner text kept");
  });

  await step("call center agents cannot open Store Design", async () => {
    const agent = await createSession({ shopId, role: "agent", email: `agent-p4-${Date.now()}@test.dz` });
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "sc_session", value: agent.token, url: BASE }]);
    const p = await ctx.newPage();
    await p.goto(editor);
    await p.waitForURL("**/ar/dashboard/orders");
    await ctx.close();
  });

  await context.close();
}
