// Phase 17: image landing pages (Wibi style) — one wizard for AI and manual creation with every option, a
// confirmation with the AI cost, the plan then one designed image per section (made from the product photos),
// the editor's "regenerate this image" panel (texts, background, instructions, reference) and restore, the
// public page as one phone-width column of images with the scrolling band and the form after the first image.
import { randomUUID } from "node:crypto";
import { BASE, createShop, db, expect, pngBuffer, step, wizardMode, wizardStyle } from "./helpers.mjs";
import { requests } from "./mock-openai.mjs";

const json = (v) => (typeof v === "string" ? JSON.parse(v) : v);

export default async function phase17(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  const section = `${BASE}/ar/dashboard/landing-pages`;
  const contractId = randomUUID();
  await db.query("INSERT INTO shop_contracts (id, shop_id, start_date, limits) VALUES (?, ?, CURDATE() - INTERVAL 1 DAY, ?)", [contractId, shopId, JSON.stringify({ maxLandingPages: 10, maxAiPerMonth: 30 })]);
  await db.query("INSERT INTO shipping_rates (shop_id, wilaya_code, home_price, office_price) VALUES (?, 16, 500, 350)", [shopId]);
  let pageId;
  let productId;

  await step("AI image page from photos: options, confirmation with the cost, progress, one image per section", async () => {
    await owner.goto(`${section}/new`);
    const wizard = owner.locator("[data-testid=ai-wizard]");
    expect((await owner.locator("[data-testid=page-style] button[aria-pressed=true]").innerText()).includes("صور تسويقية"), "image pages by default");
    await wizard.locator("[data-testid=source] button", { hasText: "صور المنتج" }).click();
    await owner.setInputFiles("[data-testid=ai-wizard] [data-testid=image-input]", [
      { name: "lamp.png", mimeType: "image/png", buffer: pngBuffer([20, 60, 200]) },
      { name: "lamp-2.png", mimeType: "image/png", buffer: pngBuffer([200, 160, 20]) },
    ]);
    await owner.waitForFunction(() => document.querySelectorAll("[data-testid=ai-wizard] img").length >= 2);
    await owner.fill("#ai-price", "3300");
    await owner.selectOption("#ai-count", "6");
    await owner.selectOption("#ai-people", "none");
    await owner.selectOption("#ai-audience-kind", "family");
    await owner.selectOption("#ai-colors", "custom");
    await owner.locator("input[type=color]").fill("#1d4ed8");
    await owner.click("[data-testid=ai-next]");
    const confirm = owner.locator("[data-testid=ai-confirm]");
    await confirm.getByText("سيستعمل 7 من حصة الذكاء الاصطناعي").waitFor();
    expect((await confirm.innerText()).includes("العائلة") && (await confirm.innerText()).includes("بدون أشخاص"), "settings summarised");
    await confirm.locator("button").last().click();
    await owner.waitForSelector("[data-testid=ai-working]");
    await owner.waitForURL(/landing-pages\/[0-9a-f-]{36}$/, { timeout: 90_000 });
    pageId = owner.url().split("/").pop();
    const [[page]] = await db.query("SELECT sections, color, product_id FROM landing_pages WHERE id = ?", [pageId]);
    productId = page.product_id;
    const sections = json(page.sections);
    const types = sections.map((s) => s.type);
    expect(types[0] === "marquee" && types[1] === "poster" && types[types.length - 1] === "form", `band, images, then the form (got ${types.join()})`);
    const plan = requests.filter((r) => r.text?.format?.name === "image_landing_page").pop();
    expect(plan.instructions.includes("objections") && plan.instructions.includes("AT LEAST 5") && plan.instructions.includes("Never payment or delivery here"), "the persuasion sequence in the plan prompt");
    const posters = sections.filter((s) => s.type === "poster");
    expect(posters.length === 6 && posters.every((s) => s.image.startsWith(`/uploads/${shopId}/`)), "6 designed images");
    expect(posters[0].kind === "hero" && posters[5].kind === "offer" && posters[0].headline === "عنوان القسم 1", "kinds and texts from the plan");
    expect(page.color === "#1d4ed8", "the chosen color");
    const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM ai_generations WHERE shop_id = ? AND kind = 'image' AND status = 'done'", [shopId]);
    expect(n === 6, `6 image tasks (got ${n})`);
    const imageCalls = requests.filter((r) => r.tools?.some((t) => t.type === "image_generation" && t.size === "1024x1536"));
    const last = imageCalls[imageCalls.length - 1];
    const text = last?.input?.[0]?.content?.find((c) => c.type === "input_text")?.text ?? "";
    expect(last?.input?.[0]?.content?.filter((c) => c.type === "input_image").length === 2, "the product photos are the references");
    expect(text.includes('Price: "3300') && text.includes("no people and no faces"), "offer price and the people choice in the image prompt");
    expect(text.includes("Never draw buttons") && !text.includes("Button:"), "images never contain buttons");
    const [[product]] = await db.query("SELECT images FROM products WHERE id = ?", [productId]);
    expect(json(product.images).length === 2, "designed images are not added to the product photos");
  });

  await step("editor: regenerate one image with own background and instructions, then restore it", async () => {
    await owner.locator("[data-editor-section=poster]").nth(1).locator("button[aria-expanded]").click();
    const fields = owner.locator("[data-testid=section-panel] [data-testid=poster-fields]");
    const before = (await db.query("SELECT sections FROM landing_pages WHERE id = ?", [pageId]))[0][0];
    const original = json(before.sections).filter((s) => s.type === "poster")[1].image;
    await fields.getByLabel("العنوان").fill("كل ليلة بلا بعوض");
    const panel = fields.locator("[data-testid=poster-regenerate]");
    if ((await panel.locator("button[aria-expanded]").getAttribute("aria-expanded")) !== "true") await panel.locator("button[aria-expanded]").click();
    await panel.getByLabel("اقتراح الخلفية (اختياري)").fill("غرفة نوم ليلاً بإضاءة دافئة");
    await panel.getByLabel("تعليمات إضافية (اختياري)").fill("العنوان باللون الأصفر");
    await panel.locator("[data-testid=poster-generate]").click();
    await fields.locator("[data-testid=poster-restore]").waitFor({ timeout: 30_000 });
    const call = requests.filter((r) => r.tools?.some((t) => t.type === "image_generation")).pop();
    const text = call.input[0].content.find((c) => c.type === "input_text").text;
    expect(text.includes('"كل ليلة بلا بعوض"') && text.includes("غرفة نوم ليلاً") && text.includes("العنوان باللون الأصفر") && text.includes("current version of this section"), "own texts, background and instructions sent");
    expect(call.input[0].content.filter((c) => c.type === "input_image").length === 3, "current image + product photos as references");
    await owner.click("[data-testid=save-page]");
    await owner.waitForSelector("text=تم الحفظ");
    let poster = json((await db.query("SELECT sections FROM landing_pages WHERE id = ?", [pageId]))[0][0].sections).filter((s) => s.type === "poster")[1];
    expect(poster.image !== original && poster.previous[0] === original && poster.headline === "كل ليلة بلا بعوض", "new image saved, old one kept");
    await fields.locator("[data-testid=poster-restore]").click();
    await owner.click("[data-testid=save-page]");
    await owner.waitForSelector("text=تم الحفظ");
    poster = json((await db.query("SELECT sections FROM landing_pages WHERE id = ?", [pageId]))[0][0].sections).filter((s) => s.type === "poster")[1];
    expect(poster.image === original, "previous image restored");
  });

  await step("public page on a phone: one column of images, the band, the form after the first image", async () => {
    await db.query("UPDATE landing_pages SET status = 'published' WHERE id = ?", [pageId]);
    const [[{ slug }]] = await db.query("SELECT slug FROM landing_pages WHERE id = ?", [pageId]);
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await phone.goto(`${BASE}/store/shop-${tag}/lp/${slug}`);
    const layout = phone.locator("[data-layout=images]");
    await layout.waitFor();
    const order = await layout.evaluate((el) => [...el.children].map((c) => c.getAttribute("data-section")).slice(0, 4).join());
    expect(order === "marquee,poster,poster,poster", `order (got ${order})`);
    expect((await layout.locator(":scope > [data-section]").last().getAttribute("data-section")) === "form", "the form after the images");
    await phone.locator("[data-section=poster] a[href='#order-form']").first().click();
    await phone.waitForFunction(() => document.getElementById("order-form").getBoundingClientRect().top < window.innerHeight);
    await phone.locator("[data-section=marquee]").getByText("دفع عند التسليم").first().waitFor();
    const img = await phone.locator("[data-section=poster] img").first().boundingBox();
    expect(Math.round(img.width) === 390, `images across the phone (${img.width})`);
    expect((await phone.evaluate(() => document.documentElement.scrollWidth)) <= 390, "no sideways scrolling");
    expect((await phone.locator("[data-section=poster] img").first().getAttribute("alt")).includes("عنوان القسم 1"), "the image's text as its alt text");
    await phone.close();
  });

  await step("manual image page: image sections to design or upload, hidden from customers until they have an image", async () => {
    await owner.goto(`${section}/new`);
    await wizardMode(owner, "manual");
    await wizardStyle(owner, "images");
    await owner.locator("[data-testid=manual-create]").getByText("تُنشأ أقسام صور فارغة").waitFor();
    await Promise.all([owner.waitForURL(/landing-pages\/[0-9a-f-]{36}$/), owner.locator("[data-testid=manual-create] button[type=submit]").click()]);
    expect((await owner.locator("[data-editor-section=poster]").count()) === 7, "7 image sections");
    expect((await owner.locator("[data-testid=landing-preview] [data-pending]").count()) === 7, "placeholders in the preview");
    const id = owner.url().split("/").pop();
    await db.query("UPDATE landing_pages SET status = 'published' WHERE id = ?", [id]);
    const [[{ slug }]] = await db.query("SELECT slug FROM landing_pages WHERE id = ?", [id]);
    const visitor = await browser.newPage();
    await visitor.goto(`${BASE}/store/shop-${tag}/lp/${slug}`);
    await visitor.waitForSelector("[data-section=form]");
    expect(!(await visitor.locator("[data-section=poster]").count()), "no empty images for customers");
    await visitor.close();
  });

  await step("the AI quota covers the plan and every image", async () => {
    await db.query("UPDATE shop_contracts SET limits = ? WHERE id = ?", [JSON.stringify({ maxLandingPages: 10, maxAiPerMonth: 16 }), contractId]);
    await owner.goto(`${section}/new`);
    await owner.selectOption("#ai-count", "10");
    await owner.click("[data-testid=ai-next]");
    await owner.locator("[data-testid=ai-cost]").getByText("حصتك المتبقية لا تكفي").waitFor();
    await owner.locator("[data-testid=ai-confirm] button", { hasText: "رجوع" }).click();
    await owner.selectOption("#ai-count", "6");
    await owner.click("[data-testid=ai-next]");
    expect(!(await owner.locator("[data-testid=ai-confirm] button").last().isDisabled()), "6 images fit the quota");
  });

  await context.close();
}

