// Phase 7 (landing pages like Zimam): design manually (a blank canvas), the builder's components and settings, the
// builder saving by itself, the store's order form, publish (the draft stays private until then), the public page and
// its orders (with the version seen), duplicate / delete from the list,
// plan limits, roles and tenant isolation.
import { randomUUID } from "node:crypto";
import { BASE, createLandingManually, createSession, createShop, db, expect, landingRow, pngBuffer, step, until } from "./helpers.mjs";

export default async function phase7(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  owner.on("dialog", (d) => d.accept());
  const section = `${BASE}/ar/dashboard/landing-pages`;
  const store = `${BASE}/store/shop-${tag}`;
  const contractId = randomUUID();
  await db.query("INSERT INTO shop_contracts (id, shop_id, start_date, limits) VALUES (?, ?, CURDATE() - INTERVAL 1 DAY, ?)", [contractId, shopId, JSON.stringify({ maxLandingPages: 20, maxAiPerMonth: 20 })]);
  const productId = randomUUID();
  await db.query(
    "INSERT INTO products (id, shop_id, name, slug, description, price, compare_at_price, track_stock, stock, images, options, offers) VALUES (?, ?, 'ساعة رياضية', 'sport-watch', 'ساعة مقاومة للماء', 3900, 5200, 1, 50, '[]', '[]', '[]')",
    [productId, shopId],
  );
  await db.query("INSERT INTO shipping_rates (shop_id, wilaya_code, home_price, office_price) VALUES (?, 16, 500, 350)", [shopId]);
  // The store's order form: landing pages use it (they have no form of their own)
  const storeForm = { buttonText: "اطلب ساعتك الآن", address: "required", delivery: "home", thankYou: "شكراً! سنتصل بك اليوم.", custom: [{ id: "c1", label: "لون السوار", type: "select", options: ["أسود", "أزرق"], required: true }] };
  await db.query("UPDATE shops SET order_form = ? WHERE id = ?", [JSON.stringify(storeForm), shopId]);
  const preview = (type) => owner.locator(`[data-testid=landing-preview] [data-type=${type}]`);
  const panel = owner.locator("[data-testid=section-panel]");
  let pageId;
  let pageSlug;

  await step("empty list, then design manually: a blank canvas (an image to fill and the form) opens in the builder", async () => {
    await owner.goto(section);
    await owner.waitForSelector("text=لا توجد صفحات هبوط بعد");
    pageId = await createLandingManually(owner, productId);
    const row = await landingRow(pageId);
    expect(row.status === "draft" && row.product_id === productId && row.language === "ar", "draft page for the product");
    expect(row.sections.map((s) => s.type).join() === "image,form", `blank canvas (got ${row.sections.map((s) => s.type).join()})`);
    pageSlug = row.slug;
    await owner.waitForSelector("[data-testid=landing-builder]");
    expect((await owner.locator("[data-testid=components] [data-add]").count()) === 13, "Zimam's 13 components");
    await preview("image").getByText("مكان الصورة").waitFor();
  });

  await step("builder: an uploaded image, a text section, settings change the preview, the builder saves by itself", async () => {
    await preview("image").click();
    await owner.setInputFiles("[data-testid=image-file]", { name: "watch.png", mimeType: "image/png", buffer: pngBuffer([20, 90, 200]) });
    await owner.waitForSelector("[data-testid=landing-preview] [data-type=image] img");
    await panel.locator("[data-field=radius]").fill("12");
    await owner.click("[data-add=text]");
    await panel.locator("[data-field=title]").fill("ساعة لكل الأيام");
    await panel.locator("[data-field=body]").fill("نص كتبه التاجر بنفسه");
    await owner.waitForSelector('[data-testid=landing-preview] [data-section=text]:has-text("نص كتبه التاجر بنفسه")');
    await until(async () => (await landingRow(pageId)).sections.some((s) => s.type === "text" && s.body === "نص كتبه التاجر بنفسه"), "autosave");
    const row = await landingRow(pageId);
    const img = row.sections.find((s) => s.type === "image");
    expect(img.url.startsWith(`/uploads/${shopId}/`) && img.radius === 12, "image uploaded and rounded");
    // A new component goes after the selected one, before the form
    expect(row.sections.map((s) => s.type).join() === "image,text,form", `order (got ${row.sections.map((s) => s.type).join()})`);
    await owner.waitForSelector("[data-testid=save-state][data-state=saved]");
  });

  await step("the form: the store's form; a sticky button and a block moved with its toolbar", async () => {
    await preview("form").click();
    await panel.locator("[data-testid=landing-form-style]").waitFor();
    await owner.waitForSelector('[data-testid=landing-preview] button:has-text("اطلب ساعتك الآن")');
    await owner.click("[data-add=sticky]");
    expect(await owner.locator("[data-add=sticky]").isDisabled(), "one sticky button per page");
    await preview("text").click();
    await owner.locator('[data-testid=landing-preview] [data-type=text] button[aria-label="إلى الأعلى"]').click();
    await until(async () => {
      const r = await landingRow(pageId);
      return r.sections.map((s) => s.type).join() === "text,image,form,sticky";
    }, "order saved");
  });

  await step("a draft page is not public; Publish puts it online", async () => {
    const visitor = await browser.newPage();
    await visitor.goto(`${store}/lp/${pageSlug}`);
    await visitor.waitForSelector("[data-testid=not-found]");
    await owner.click("[data-testid=publish]");
    await owner.waitForSelector("text=تم النشر");
    const row = await landingRow(pageId);
    expect(row.status === "published" && row.published.sections.length === 4, "published copy saved");
    await visitor.goto(`${store}/lp/${pageSlug}`);
    await visitor.waitForSelector('[data-section=text]:has-text("نص كتبه التاجر بنفسه")');
    await visitor.close();
  });

  await step("changes after publishing stay private until the next Publish", async () => {
    await owner.click("[data-add=announcement]");
    await panel.locator("[data-field=text]").fill("عرض الأسبوع");
    await until(async () => (await landingRow(pageId)).sections.some((s) => s.type === "announcement" && s.text === "عرض الأسبوع"), "draft saved");
    const visitor = await browser.newPage();
    await visitor.goto(`${store}/lp/${pageSlug}`);
    await visitor.waitForSelector("[data-section=text]");
    expect(!(await visitor.getByText("عرض الأسبوع").count()), "visitors still see the published page");
    await owner.click("[data-testid=publish]");
    await owner.waitForSelector("text=تم النشر");
    await visitor.reload();
    await visitor.getByText("عرض الأسبوع").first().waitFor();
    await visitor.close();
  });

  const customer = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await step("public page on a phone: components in order, home delivery only, the sticky button, one visit counted", async () => {
    // Earlier steps' visitors were counted too
    const [[before]] = await db.query("SELECT views FROM landing_stats WHERE page_id = ? AND version = 'A'", [pageId]);
    const base = before?.views ?? 0;
    await customer.goto(`${store}/lp/${pageSlug}`);
    await customer.waitForSelector('button[type=submit]:has-text("اطلب ساعتك الآن")');
    expect(!(await customer.locator('input[name=deliveryType][value="office"]').count()), "office delivery not offered");
    expect(await customer.locator("[data-testid=sticky-order]").isVisible(), "sticky order button");
    await until(async () => {
      const [[s]] = await db.query("SELECT views FROM landing_stats WHERE page_id = ? AND version = 'A'", [pageId]);
      return s?.views === base + 1;
    }, "visit of version A counted");
    await customer.reload();
    await customer.waitForSelector("button[type=submit]");
    await customer.waitForTimeout(400);
    const [[again]] = await db.query("SELECT views FROM landing_stats WHERE page_id = ? AND version = 'A'", [pageId]);
    expect(again.views === base + 1, "one visit per browser session");
  });

  let orderId;
  await step("order: required address and custom field are checked, answers and the version saved with the order", async () => {
    await customer.fill("#name", "ياسين");
    await customer.fill("#phone", "0661 22 33 44");
    await customer.selectOption("#wilaya", "16");
    await customer.selectOption("#commune", "باب الزوار");
    await customer.click("button[type=submit]");
    await customer.waitForSelector("text=هذه المعلومة مطلوبة");
    await customer.fill("#address", "حي 500 مسكن");
    await customer.locator("select[name^=custom_]").selectOption("أزرق");
    expect((await customer.locator("[data-testid=total]").innerText()).replace(/\s/g, "").includes("4400"), "total = 3900 + home 500");
    await Promise.all([customer.waitForURL(/\/thanks\?o=/), customer.click("button[type=submit]")]);
    await customer.waitForSelector("text=شكراً! سنتصل بك اليوم.");
    orderId = new URL(customer.url()).searchParams.get("o");
    const [[order]] = await db.query("SELECT * FROM orders WHERE id = ?", [orderId]);
    const extra = typeof order.extra === "string" ? JSON.parse(order.extra) : order.extra;
    expect(order.landing_page_id === pageId && order.landing_version === "A" && order.delivery_type === "home", "order linked to the page and version A");
    expect(extra?.[0]?.label === "لون السوار" && extra[0].value === "أزرق", "custom answer saved");
  });

  await step("the list: counters, the row's numbers, search and the versions' numbers", async () => {
    await owner.goto(section);
    expect((await owner.locator("[data-stat=live] [data-value]").innerText()) === "1", "1 live page");
    const row = owner.locator("[data-testid=landing-list] [data-page]").first();
    const stats = await row.locator("dl dd").allInnerTexts();
    const [[{ views }]] = await db.query("SELECT views FROM landing_pages WHERE id = ?", [pageId]);
    expect(stats[0].trim() === String(views) && stats[1].trim() === "1", `visits and 1 order (got ${stats.join(" | ")})`);
    await owner.fill("[data-filter=search]", "لا يوجد");
    expect(!(await owner.locator("[data-testid=landing-list] [data-page]").count()), "search hides it");
    await owner.fill("[data-filter=search]", "ساعة");
    await row.locator("[data-action=stats]").click();
    await owner.locator("[data-testid=version-stats] [data-version=A]").getByText(`${Math.round(1000 / views) / 10}%`).waitFor();
    await owner.keyboard.press("Escape");
  });

  await step("the list's actions: duplicate opens a draft copy, unpublish / publish, delete", async () => {
    await owner.goto(section);
    const original = owner.locator("[data-testid=landing-list] [data-page]").first();
    await original.locator("[data-action=more]").click();
    await Promise.all([owner.waitForURL((u) => /landing-pages\/[0-9a-f-]{36}$/.test(u.pathname) && !u.pathname.endsWith(pageId)), original.locator("[data-action=duplicate]").click()]);
    const copy = await landingRow(owner.url().split("/").pop());
    expect(copy.status === "draft" && copy.sections.length === 5, "copy is a draft with the same components");
    await owner.goto(section);
    await owner.waitForFunction(() => document.querySelectorAll("[data-testid=landing-list] [data-page]").length === 2);
    const live = owner.locator('[data-testid=landing-list] [data-page][data-status="published"]');
    await live.locator("[data-action=toggle-live]").click();
    await until(async () => (await landingRow(pageId)).status === "draft", "unpublished");
    await owner.locator(`[data-testid=landing-list] [data-page]`).first().waitFor();
    const draftCopy = owner.locator("[data-testid=landing-list] [data-page]", { hasText: "(2)" });
    await draftCopy.locator("[data-action=more]").click();
    await draftCopy.locator("[data-action=delete]").click();
    await owner.waitForFunction(() => document.querySelectorAll("[data-testid=landing-list] [data-page]").length === 1);
    await owner.locator('[data-testid=landing-list] [data-page] [data-action=toggle-live]').click();
    await until(async () => (await landingRow(pageId)).status === "published", "back online");
  });

  await step("plan limit: no new page past the plan's pages", async () => {
    await db.query("UPDATE shop_contracts SET limits = ? WHERE id = ?", [JSON.stringify({ maxLandingPages: 1, maxAiPerMonth: 2 }), contractId]);
    await owner.goto(section);
    await owner.click("[data-testid=create-landing]");
    await owner.click("[data-create=manual]");
    await owner.selectOption("#create-product", productId);
    await owner.click("[data-testid=create-manual]");
    await owner.waitForSelector("text=وصلت إلى الحد الأقصى لصفحات الهبوط في باقتك");
    await db.query("UPDATE shop_contracts SET limits = ? WHERE id = ?", [JSON.stringify({ maxLandingPages: 20, maxAiPerMonth: 20 }), contractId]);
  });

  await step("call center agents cannot open landing pages", async () => {
    const { token } = await createSession({ shopId, role: "agent", email: `agent7-${tag}@test.dz` });
    const agentContext = await browser.newContext();
    await agentContext.addCookies([{ name: "sc_session", value: token, url: BASE }]);
    const agent = await agentContext.newPage();
    await agent.goto(`${section}/${pageId}`);
    await agent.waitForURL((u) => !u.pathname.includes("landing-pages"));
    await agentContext.close();
  });

  await step("another shop cannot see or edit this shop's page", async () => {
    const other = await createShop(browser);
    const page = await other.context.newPage();
    await page.goto(`${section}/${pageId}`);
    await page.waitForSelector("[data-testid=not-found]");
    await page.goto(`${BASE}/store/shop-${other.tag}/lp/${pageSlug}`);
    await page.waitForSelector("[data-testid=not-found]");
    await other.context.close();
  });

  await customer.close();
  await context.close();
}
