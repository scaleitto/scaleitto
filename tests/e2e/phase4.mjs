// Phase 4: Store Design = Zimam's store builder — sections drafted then published (add, edit, hide, reorder), global parts
// that apply at once (announcement bar, header, navigation, footer, colors), custom pages, history, discard draft.
import { randomUUID } from "node:crypto";
import { BASE, createSession, createShop, db, expect, pngBuffer, step } from "./helpers.mjs";

export default async function phase4(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const page = await context.newPage();
  const editor = `${BASE}/ar/dashboard/store-design`;
  const store = `${BASE}/store/shop-${tag}`;
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, compare_at_price, images, options, offers) VALUES (?, ?, 'ساعة', 'watch', 4500, 6000, '[]', '[]', '[]')", [randomUUID(), shopId]);
  const saved = () => page.waitForSelector("[data-testid=save-state][data-state=saved]");
  const design = async () => {
    const [[row]] = await db.query("SELECT design, primary_color AS color FROM shops WHERE id = ?", [shopId]);
    return { ...(typeof row.design === "string" ? JSON.parse(row.design) : (row.design ?? {})), color: row.color };
  };

  await step("a new store has no banner or announcement, perks shown by default", async () => {
    await page.goto(store);
    await page.waitForSelector("[data-testid=badges]");
    expect(!(await page.locator("[data-testid=hero]").count()) && !(await page.locator("[data-testid=announcement]").count()), "nothing extra yet");
  });

  await step("the builder opens full screen with the store's sections, published", async () => {
    await page.goto(editor);
    await page.waitForSelector("[data-testid=store-builder]");
    const rows = await page.locator("[data-section-row]").evaluateAll((els) => els.map((e) => e.dataset.sectionRow));
    expect(JSON.stringify(rows) === JSON.stringify(["badges", "collections", "products", "steps"]), `home sections (got ${rows})`);
    expect((await page.getAttribute("[data-testid=publish-state]", "data-published")) === "true", "published");
  });

  await step("a banner added and edited shows in the preview, the store keeps the published version", async () => {
    await page.click("[data-testid=add-section]");
    await page.click("[data-add=hero]");
    await page.fill("[data-field=title]", "تخفيضات الصيف");
    await page.fill("[data-field=buttonText]", "تسوق الآن");
    const preview = page.locator("[data-testid=design-preview]");
    await preview.getByText("تخفيضات الصيف").waitFor();
    await saved();
    expect((await page.getAttribute("[data-testid=publish-state]", "data-published")) === "false", "unpublished changes");
    const d = await design();
    expect(d.draft.home.some((s) => s.type === "hero" && s.title === "تخفيضات الصيف") && !d.pages, "only the draft changed");
    await page.goto(store);
    expect(!(await page.locator("[data-testid=hero]").count()), "visitors do not see the draft");
  });

  await step("publish: the store shows the banner first after moving it up, a hidden section disappears", async () => {
    await page.goto(editor);
    // The banner was added at the end: move it to the top
    for (let i = 0; i < 4; i++) await page.locator("[data-section-row=hero] [data-action=up]").click();
    await page.locator("[data-section-row=badges] [data-action=toggle-hidden]").click();
    await saved();
    await page.click("[data-testid=publish]");
    await page.waitForSelector("[data-testid=publish-state][data-published=true]");
    await page.goto(store);
    await page.waitForSelector("[data-testid=hero] >> text=تخفيضات الصيف");
    expect(!(await page.locator("[data-testid=badges]").count()), "perks hidden");
    const first = await page.locator("[data-testid=store-sections] > div").first().locator("[data-testid=hero]").count();
    expect(first === 1, "the banner is the first section");
  });

  await step("global parts apply at once: announcement bar, color, logo, footer and social links", async () => {
    await page.goto(editor);
    await page.locator("[data-toggle=announcement]").check();
    await page.click("[data-global=announcement]");
    await page.fill("#announcementText", "توصيل سريع لكل الولايات");
    await page.click("[data-panel-button=theme]");
    await page.click('button[aria-label="#7c3aed"]');
    await page.click("[data-panel-button=sections]");
    await page.click("[data-tab=layout]");
    await page.click("[data-global=header]");
    await page.locator("[data-testid=image-input]").first().setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: pngBuffer([37, 99, 235]) });
    await page.locator("[data-testid=design-preview] [data-testid=store-logo]").waitFor();
    await page.click("[data-tab=layout]");
    await page.click("[data-global=footer]");
    await page.fill("#about", "متجر جزائري للساعات الأصلية");
    await page.fill("#instagram", "instagram.com/myshop");
    await page.fill("#whatsapp", "0555 12 34 56");
    await saved();
    // No publish needed
    await page.goto(store);
    await page.waitForSelector("[data-testid=announcement] >> text=توصيل سريع لكل الولايات");
    expect((await page.locator("[data-testid=store-logo]").getAttribute("src")).startsWith("/uploads/"), "logo shown");
    const footer = page.locator("[data-testid=store-footer]");
    await footer.getByText("متجر جزائري للساعات الأصلية").waitFor();
    expect((await footer.locator('a:has-text("Instagram")').getAttribute("href")) === "https://instagram.com/myshop", "instagram link");
    expect((await footer.locator('a:has-text("WhatsApp")').getAttribute("href")) === "https://wa.me/213555123456", "whatsapp link");
    const brand = await page.locator("[data-testid=store-frame]").evaluate((el) => getComputedStyle(el).getPropertyValue("--brand").trim());
    expect(brand === "#7c3aed", `store color (${brand})`);
    await page.goto(`${store}/p/watch`);
    await page.waitForSelector("[data-testid=announcement]");
    await page.waitForSelector("[data-testid=store-footer] >> text=متجر جزائري للساعات الأصلية");
  });

  await step("wrong values are refused with clear messages and nothing is saved", async () => {
    await page.goto(editor);
    await page.click("[data-global=footer]");
    await page.fill("#instagram", "https://facebook.com/x");
    await page.waitForSelector("[data-testid=save-state][data-state=failed]");
    await page.waitForSelector("text=رابط غير صحيح لهذا الموقع");
    expect((await design()).socials.instagram === "https://instagram.com/myshop", "the old link is kept");
    await page.fill("#instagram", "instagram.com/myshop");
    await saved();
  });

  await step("a custom page with a menu link, published, opens on the store", async () => {
    await page.goto(editor);
    await page.click("[data-testid=add-page]");
    await page.click("[data-testid=page-settings]");
    await page.fill("#page-title", "من نحن");
    await page.fill("#page-handle", "about-us");
    await page.locator("[data-testid=page-dialog] button[aria-label]").first().click();
    await page.click("[data-section-row=text] button");
    await page.fill("[data-field=body]", "متجر عائلي منذ 2010");
    await page.click("[data-tab=layout]");
    await page.click("[data-toggle=navigation] + button");
    await page.click("[data-testid=add-link]");
    await page.fill("[data-link='0'] [data-link-label]", "من نحن");
    await page.selectOption("[data-link='0'] [data-link-target]", "page:about-us");
    await saved();
    await page.click("[data-testid=publish]");
    await page.waitForSelector("[data-testid=publish-state][data-published=true]");
    await page.goto(store);
    const link = page.locator("[data-testid=store-nav] a", { hasText: "من نحن" });
    expect((await link.getAttribute("href")) === `/store/shop-${tag}/pages/about-us`, "menu link to the page");
    await page.goto(`${store}/pages/about-us`);
    await page.waitForSelector("[data-testid=custom-page] >> text=متجر عائلي منذ 2010");
  });

  await step("discard draft and history: back to the published version, an older one restored", async () => {
    await page.goto(editor);
    page.once("dialog", (d) => d.accept());
    await page.locator("[data-section-row=hero] [data-action=remove]").click();
    await saved();
    page.once("dialog", (d) => d.accept());
    await page.click("[data-testid=discard-draft]");
    await page.waitForSelector("[data-section-row=hero]");
    expect((await page.getAttribute("[data-testid=publish-state]", "data-published")) === "true", "draft = published");
    await page.click("[data-testid=open-history]");
    await page.waitForSelector("[data-history]");
    expect((await page.locator("[data-history]").count()) === 2, "two publishes in the history");
    // The oldest publish had no custom page
    await page.locator("[data-history]").last().locator("[data-action=restore]").click();
    await page.waitForSelector("[data-testid=builder-message]");
    await page.waitForSelector("[data-testid=publish-state][data-published=false]");
    await saved();
    expect((await design()).draft.custom.length === 0 && (await design()).pages.custom.length === 1, "restored into the draft only");
  });

  await step("call center agents cannot open Store Design", async () => {
    const agent = await createSession({ shopId, role: "agent", email: `agent-p4-${Date.now()}@test.dz` });
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "sc_session", value: agent.token, url: BASE }]);
    const p = await ctx.newPage();
    await p.goto(editor);
    await p.waitForURL((u) => u.pathname === "/ar/call-center");
    await ctx.close();
  });

  await context.close();
}
