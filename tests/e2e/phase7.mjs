// Phase 7: landing pages — manual creation, the editor (sections + order form settings), the public
// page and its customizable order form, the embeddable form, AI generation (fake OpenAI server),
// the AI connection test, plan limits, roles and tenant isolation.
import { randomUUID } from "node:crypto";
import { BASE, createSession, createShop, db, expect, pngBuffer, step, wizardGenerate, wizardMode, wizardStyle } from "./helpers.mjs";

export default async function phase7(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  owner.on("dialog", (d) => d.accept());
  const section = `${BASE}/ar/dashboard/landing-pages`;
  const store = `${BASE}/store/shop-${tag}`;
  // Room for every page this test creates; the limit step lowers it again
  const contractId = randomUUID();
  await db.query("INSERT INTO shop_contracts (id, shop_id, start_date, limits) VALUES (?, ?, CURDATE() - INTERVAL 1 DAY, ?)", [contractId, shopId, JSON.stringify({ maxLandingPages: 20, maxAiPerMonth: 20 })]);

  const productId = randomUUID();
  await db.query(
    "INSERT INTO products (id, shop_id, name, slug, description, price, compare_at_price, track_stock, stock, images, options, offers) VALUES (?, ?, 'ساعة رياضية', 'sport-watch', 'ساعة مقاومة للماء', 3900, 5200, 1, 50, '[]', '[]', '[]')",
    [productId, shopId],
  );
  await db.query("INSERT INTO shipping_rates (shop_id, wilaya_code, home_price, office_price) VALUES (?, 16, 500, 350)", [shopId]);
  let pageId;
  let pageSlug;

  await step("empty list, then a page made by hand opens in the editor", async () => {
    await owner.goto(section);
    await owner.waitForSelector("text=لا توجد صفحات هبوط بعد");
    await owner.locator("a", { hasText: "صفحة جديدة" }).first().click();
    await owner.waitForSelector("[data-testid=ai-wizard]");
    await wizardMode(owner, "manual");
    await wizardStyle(owner, "sections");
    await Promise.all([owner.waitForURL(/landing-pages\/[0-9a-f-]{36}$/), owner.locator("[data-testid=manual-create] button[type=submit]").click()]);
    pageId = owner.url().split("/").pop();
    const [[row]] = await db.query("SELECT * FROM landing_pages WHERE id = ? AND shop_id = ?", [pageId, shopId]);
    expect(row && row.status === "draft" && row.product_id === productId, "draft page saved for the product");
    pageSlug = row.slug;
    await owner.waitForSelector("[data-testid=sections-editor]");
    expect((await owner.locator("[data-editor-section]").count()) >= 4, "starter template has sections");
    expect(await owner.locator("[data-testid=landing-preview] [data-section=hero]").count(), "live preview shows the hero");
  });

  await step("editor: add a text section, hide the badges, move a section", async () => {
    await owner.selectOption('select[aria-label="إضافة قسم"]', "text");
    const added = owner.locator("[data-editor-section=text]").last();
    await added.locator("textarea").fill("نص كتبه التاجر بنفسه");
    await owner.waitForSelector('[data-testid=landing-preview] [data-section=text]:has-text("نص كتبه التاجر بنفسه")');
    await added.locator('button[aria-label="للأعلى"]').click();
    await owner.locator("[data-editor-section=badges]").first().locator('button[aria-label="إخفاء"]').click();
    expect(!(await owner.locator("[data-testid=landing-preview] [data-section=badges]").count()), "hidden section left the preview");
    await owner.waitForSelector("text=تغييرات غير محفوظة");
  });

  await step("order form settings: button, required address, home only, custom field, thank-you", async () => {
    await owner.locator("nav button", { hasText: "نموذج الطلب" }).click();
    await owner.waitForSelector("[data-testid=form-editor]");
    await owner.fill('input[aria-label="نص زر الطلب"]', "اطلب ساعتك الآن");
    await owner.selectOption('select[aria-label="حقل العنوان"]', "required");
    await owner.selectOption('select[aria-label="أنواع التوصيل"]', "home");
    await owner.click("text=إضافة حقل");
    const field = owner.locator("[data-custom-field='0']");
    await field.locator('input[aria-label="اسم الحقل"]').fill("لون السوار");
    await field.locator('select[aria-label="النوع"]').selectOption("select");
    await field.locator('textarea[aria-label^="الخيارات"]').fill("أسود\nأزرق");
    await field.locator("label", { hasText: "إلزامي" }).click();
    await owner.fill('textarea[aria-label="رسالة بعد الطلب (اختياري)"]', "شكراً! سنتصل بك اليوم.");
    await owner.waitForSelector('[data-testid=landing-preview] button:has-text("اطلب ساعتك الآن")');
    await owner.click("[data-testid=save-page]");
    await owner.waitForSelector("text=تم الحفظ");
    const [[row]] = await db.query("SELECT sections, form FROM landing_pages WHERE id = ?", [pageId]);
    const sections = typeof row.sections === "string" ? JSON.parse(row.sections) : row.sections;
    const form = typeof row.form === "string" ? JSON.parse(row.form) : row.form;
    expect(sections.find((s) => s.type === "badges")?.hidden === true, "badges saved hidden");
    const textAt = sections.findIndex((s) => s.type === "text");
    expect(textAt > 0 && textAt < sections.length - 1, "text section moved up");
    expect(form.address === "required" && form.delivery === "home" && form.buttonText === "اطلب ساعتك الآن", "form settings saved");
    expect(form.custom.length === 1 && form.custom[0].required && form.custom[0].options.join() === "أسود,أزرق", "custom field saved");
  });

  await step("a draft page is not public; publishing makes it visible", async () => {
    await owner.goto(`${store}/lp/${pageSlug}`);
    await owner.waitForSelector("[data-testid=not-found]");
    await owner.goto(`${section}/${pageId}`);
    await owner.locator("button", { hasText: "نشر" }).first().click();
    await owner.waitForSelector("text=إلغاء النشر");
    const [[row]] = await db.query("SELECT status FROM landing_pages WHERE id = ?", [pageId]);
    expect(row.status === "published", "page published");
  });

  const customer = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await step("public page: sections in order, hidden badges, home delivery only, visit counted", async () => {
    await customer.goto(`${store}/lp/${pageSlug}`);
    await customer.waitForSelector('button[type=submit]:has-text("اطلب ساعتك الآن")');
    expect(!(await customer.locator("[data-section=badges]").count()), "hidden badges not shown");
    expect(await customer.locator("[data-section=text]:has-text('نص كتبه التاجر بنفسه')").count(), "merchant text shown");
    expect(!(await customer.locator('input[name=deliveryType][value="office"]').count()), "office delivery not offered");
    let views = 0;
    for (let i = 0; i < 20 && views === 0; i++) {
      [[{ views }]] = await db.query("SELECT views FROM landing_pages WHERE id = ?", [pageId]);
      if (!views) await customer.waitForTimeout(150);
    }
    await customer.reload();
    await customer.waitForSelector("button[type=submit]");
    await customer.waitForTimeout(400);
    const [[again]] = await db.query("SELECT views FROM landing_pages WHERE id = ?", [pageId]);
    expect(views === 1 && again.views === 1, "one visit per browser session");
  });

  let orderId;
  await step("order: required address and custom field are checked, answers saved with the order", async () => {
    await customer.fill("#name", "ياسين");
    await customer.fill("#phone", "0661 22 33 44");
    await customer.selectOption("#wilaya", "16");
    await customer.fill("#commune", "باب الزوار");
    await customer.click("button[type=submit]");
    await customer.waitForSelector("text=هذه المعلومة مطلوبة");
    await customer.fill("#address", "حي 500 مسكن");
    const custom = customer.locator("select[name^=custom_]");
    await custom.selectOption("أزرق");
    expect((await customer.locator("[data-testid=total]").innerText()).replace(/\s/g, "").includes("4400"), "total = 3900 + home 500");
    await Promise.all([customer.waitForURL(/\/thanks\?o=/), customer.click("button[type=submit]")]);
    await customer.waitForSelector("text=شكراً! سنتصل بك اليوم.");
    orderId = new URL(customer.url()).searchParams.get("o");
    const [[order]] = await db.query("SELECT * FROM orders WHERE id = ?", [orderId]);
    const extra = typeof order.extra === "string" ? JSON.parse(order.extra) : order.extra;
    expect(order.landing_page_id === pageId && order.delivery_type === "home" && order.address === "حي 500 مسكن", "order linked to the page");
    expect(extra?.[0]?.label === "لون السوار" && extra[0].value === "أزرق", "custom answer saved");
  });

  await step("the merchant sees the answers and the page in the order and the list", async () => {
    await owner.goto(`${BASE}/ar/dashboard/orders/${orderId}`);
    const card = owner.locator("[data-testid=order-extra]");
    await card.waitFor();
    expect((await card.innerText()).includes("أزرق"), "custom answer on the order page");
    await owner.goto(section);
    const row = owner.locator("tr[data-page]").first();
    await row.waitFor();
    const cells = await row.locator("td").allInnerTexts();
    expect(cells[2].trim() === "1" && cells[3].trim() === "1", `1 visit and 1 order in the list (got ${cells.join(" | ")})`);
  });

  await step("embed: the form alone, with the embed code, and its own thank-you page", async () => {
    await owner.goto(`${section}/${pageId}`);
    await owner.locator("nav button", { hasText: "الإعدادات" }).click();
    const code = await owner.locator("[data-testid=embed-code]").inputValue();
    expect(code.includes(`/embed/shop-${tag}/${encodeURIComponent(pageSlug)}`) && code.includes("<iframe"), "embed code has the iframe URL");
    const embed = await browser.newPage({ viewport: { width: 420, height: 900 } });
    await embed.goto(`${BASE}/embed/shop-${tag}/${pageSlug}`);
    await embed.waitForSelector('button[type=submit]:has-text("اطلب ساعتك الآن")');
    expect(!(await embed.locator("[data-section=hero]").count()), "no page sections in the embed");
    await embed.fill("#name", "سارة");
    await embed.fill("#phone", "0770 11 22 33");
    await embed.selectOption("#wilaya", "16");
    await embed.fill("#commune", "القبة");
    await embed.fill("#address", "شارع 1");
    await embed.locator("select[name^=custom_]").selectOption("أسود");
    await Promise.all([embed.waitForURL(/\/embed\/[^/]+\/thanks\?o=/), embed.click("button[type=submit]")]);
    await embed.waitForSelector("text=شكراً! سنتصل بك اليوم.");
    await embed.close();
  });

  await step("duplicate opens a draft copy in the editor, delete removes it", async () => {
    await owner.goto(section);
    await Promise.all([owner.waitForURL((u) => /landing-pages\/[0-9a-f-]{36}$/.test(u.pathname) && !u.pathname.endsWith(pageId)), owner.locator('tr[data-page] button[aria-label="نسخ"]').first().click()]);
    const [[copy]] = await db.query("SELECT status, form FROM landing_pages WHERE id = ? AND shop_id = ?", [owner.url().split("/").pop(), shopId]);
    const form = typeof copy.form === "string" ? JSON.parse(copy.form) : copy.form;
    expect(copy.status === "draft" && form.custom.length === 1, "copy is a draft with the same form");
    await owner.goto(section);
    await owner.waitForFunction(() => document.querySelectorAll("tr[data-page]").length === 2);
    await owner.locator("tr[data-page]", { has: owner.locator("text=مسودة") }).locator('button[aria-label="حذف"]').click();
    await owner.waitForFunction(() => document.querySelectorAll("tr[data-page]").length === 1);
  });

  await step("AI connection test shows every step", async () => {
    await owner.goto(section);
    await owner.locator("[data-testid=ai-test] button").click();
    await owner.locator("[data-testid=ai-test]").getByText("كل شيء يعمل").waitFor({ timeout: 30_000 });
  });

  await step("AI page from an existing product: waits, then opens the generated page", async () => {
    await owner.goto(`${section}/new`);
    await wizardStyle(owner, "sections");
    await wizardGenerate(owner);
    await owner.waitForSelector("[data-testid=ai-working]");
    await owner.waitForURL(/landing-pages\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    const id = owner.url().split("/").pop();
    const [[page]] = await db.query("SELECT * FROM landing_pages WHERE id = ? AND shop_id = ?", [id, shopId]);
    const sections = typeof page.sections === "string" ? JSON.parse(page.sections) : page.sections;
    expect(page.product_id === productId && page.status === "draft", "page for the chosen product, as a draft");
    expect(sections[0].type === "hero" && sections[sections.length - 1].type === "form", `order form as the last step of the sequence (got ${sections.map((s) => s.type).join()})`);
    expect(!sections.some((s) => s.type === "image"), "image not from the product was dropped");
    const [[gen]] = await db.query("SELECT status, landing_page_id FROM ai_generations WHERE shop_id = ? ORDER BY created_at DESC LIMIT 1", [shopId]);
    expect(gen.status === "done" && gen.landing_page_id === id, "generation recorded");
    await owner.waitForSelector('[data-testid=landing-preview] h1:has-text("عنوان من الذكاء الاصطناعي")');
  });

  await step("AI page from photos creates the product too", async () => {
    await owner.goto(`${section}/new`);
    await wizardStyle(owner, "sections");
    await owner.locator("[data-testid=source] button", { hasText: "صور المنتج" }).click();
    await owner.setInputFiles("[data-testid=ai-wizard] [data-testid=image-input]", [{ name: "watch.png", mimeType: "image/png", buffer: pngBuffer([20, 90, 200]) }]);
    await owner.waitForSelector("[data-testid=ai-wizard] img");
    await owner.fill("#ai-price", "2500");
    // Photo enhancement is tested in phase 15; here the page keeps the uploaded photo
    await owner.locator("[data-testid=ai-enhance] input[type=checkbox]").uncheck();
    await wizardGenerate(owner);
    await owner.waitForURL(/landing-pages\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    const [[product]] = await db.query("SELECT * FROM products WHERE shop_id = ? AND name = 'ساعة ذكية AI'", [shopId]);
    const images = typeof product?.images === "string" ? JSON.parse(product.images) : product?.images;
    expect(product && product.price === 2500 && images.length === 1 && images[0].startsWith(`/uploads/${shopId}/`), "product created with the photo and price");
    const [[page]] = await db.query("SELECT sections FROM landing_pages WHERE id = ?", [owner.url().split("/").pop()]);
    const hero = (typeof page.sections === "string" ? JSON.parse(page.sections) : page.sections).find((s) => s.type === "hero");
    expect(hero.image === images[0], "hero uses the uploaded photo");
  });

  await step("plan limits: pages and AI generations", async () => {
    await db.query("UPDATE shop_contracts SET limits = ? WHERE id = ?", [JSON.stringify({ maxLandingPages: 3, maxAiPerMonth: 2 }), contractId]);
    await owner.goto(`${section}/new`);
    await wizardMode(owner, "manual");
    await owner.locator("[data-testid=manual-create] button[type=submit]").click();
    await owner.waitForSelector("text=وصلت إلى الحد الأقصى لصفحات الهبوط في باقتك");
    await db.query("UPDATE shop_contracts SET limits = ? WHERE id = ?", [JSON.stringify({ maxLandingPages: 20, maxAiPerMonth: 2 }), contractId]);
    // The confirmation shows the cost and refuses when the month's AI quota is used up
    await owner.goto(`${section}/new`);
    await wizardStyle(owner, "sections");
    await owner.click("[data-testid=ai-next]");
    await owner.locator("[data-testid=ai-cost]").getByText("حصتك المتبقية لا تكفي").waitFor();
    expect(await owner.locator("[data-testid=ai-confirm] button").last().isDisabled(), "confirm disabled without quota");
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
