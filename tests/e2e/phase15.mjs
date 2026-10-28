// Phase 15: better AI landing pages — extra photos, photos reworked by the AI during generation (new
// background, same product), the editor's "enhance image" button, new sections (image + text, benefits),
// a mobile-first public page whose photos are never cropped, and the AI quota for image work.
import { randomUUID } from "node:crypto";
import { BASE, createShop, db, expect, pngBuffer, step, wizardGenerate, wizardStyle } from "./helpers.mjs";

const json = (v) => (typeof v === "string" ? JSON.parse(v) : v);

export default async function phase15(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  const section = `${BASE}/ar/dashboard/landing-pages`;
  const contractId = randomUUID();
  await db.query("INSERT INTO shop_contracts (id, shop_id, start_date, limits) VALUES (?, ?, CURDATE() - INTERVAL 1 DAY, ?)", [contractId, shopId, JSON.stringify({ maxLandingPages: 10, maxAiPerMonth: 20 })]);
  await db.query("INSERT INTO shipping_rates (shop_id, wilaya_code, home_price, office_price) VALUES (?, 16, 500, 350)", [shopId]);
  let pageId;
  let uploaded;

  await step("AI page from two photos, both reworked: the page and the product use the new images", async () => {
    await owner.goto(`${section}/new`);
    const wizard = owner.locator("[data-testid=ai-wizard]");
    await wizardStyle(owner, "sections");
    await wizard.locator("[data-testid=source] button", { hasText: "صور المنتج" }).click();
    await owner.setInputFiles("[data-testid=ai-wizard] [data-testid=image-input]", [
      { name: "front.png", mimeType: "image/png", buffer: pngBuffer([20, 90, 200]) },
      { name: "side.png", mimeType: "image/png", buffer: pngBuffer([200, 90, 20]) },
    ]);
    await owner.waitForFunction(() => document.querySelectorAll("[data-testid=ai-wizard] img").length >= 2);
    await owner.fill("#ai-price", "2500");
    await owner.fill("#ai-compare", "3500");
    expect(await owner.locator("[data-testid=ai-enhance] input[type=checkbox]").isChecked(), "enhancement on by default");
    await owner.selectOption("#ai-style", "studio");
    await owner.selectOption("#ai-enhance-count", "2");
    await wizardGenerate(owner);
    await owner.locator("[data-testid=ai-working]").getByText("تحسين الصور").waitFor();
    await owner.waitForURL(/landing-pages\/[0-9a-f-]{36}$/, { timeout: 60_000 });
    pageId = owner.url().split("/").pop();
    const [[page]] = await db.query("SELECT sections, product_id FROM landing_pages WHERE id = ?", [pageId]);
    const sections = json(page.sections);
    const [[product]] = await db.query("SELECT images, compare_at_price FROM products WHERE id = ?", [page.product_id]);
    const images = json(product.images);
    expect(images.length === 4 && images.every((x) => x.startsWith(`/uploads/${shopId}/`)), `new images added before the originals (got ${images.length})`);
    uploaded = images.slice(2);
    const hero = sections.find((s) => s.type === "hero");
    const imageText = sections.find((s) => s.type === "imageText");
    expect(hero.image === images[0] && imageText.image === images[1], "hero and image+text use the reworked photos");
    expect(sections.some((s) => s.type === "benefits"), "benefits section");
    const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM ai_generations WHERE shop_id = ? AND kind = 'image' AND status = 'done'", [shopId]);
    expect(n === 2, `two image tasks (got ${n})`);
  });

  await step("editor: the new sections can be added, a photo can be reworked by the AI", async () => {
    await owner.selectOption('select[aria-label="إضافة قسم"]', "benefits");
    await owner.locator("[data-editor-section=benefits]").last().waitFor();
    const block = owner.locator("[data-editor-section=imageText]").first();
    await block.locator("button[aria-expanded]").click();
    const enhance = block.locator("[data-testid=enhance-image]");
    await enhance.waitFor();
    const before = await owner.locator("[data-testid=landing-preview] [data-section=imageText] img").getAttribute("src");
    await enhance.locator("select").selectOption("lifestyle");
    await enhance.locator("button").click();
    await owner.waitForFunction(
      (old) => {
        const src = document.querySelector("[data-testid=landing-preview] [data-section=imageText] img")?.getAttribute("src");
        return src && src !== old;
      },
      before,
      { timeout: 30_000 },
    );
    await owner.click("[data-testid=save-page]");
    await owner.waitForSelector("text=تم الحفظ");
    const [[page]] = await db.query("SELECT sections FROM landing_pages WHERE id = ?", [pageId]);
    const imageText = json(page.sections).find((s) => s.type === "imageText");
    expect(imageText.image !== before && imageText.image.startsWith(`/uploads/${shopId}/`), "new photo saved");
  });

  await step("public page on a phone: new sections, photos not cropped, full-width order button, discount", async () => {
    await db.query("UPDATE landing_pages SET status = 'published' WHERE id = ?", [pageId]);
    const [[{ slug }]] = await db.query("SELECT slug FROM landing_pages WHERE id = ?", [pageId]);
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await phone.goto(`${BASE}/store/shop-${tag}/lp/${slug}`);
    await phone.waitForSelector("[data-section=imageText] img");
    await phone.waitForSelector("[data-section=benefits]");
    const hero = await phone.locator("[data-section=hero] img").evaluate(async (img) => {
      if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
      const r = img.getBoundingClientRect();
      return { fit: getComputedStyle(img).objectFit, ratio: r.width / r.height, natural: img.naturalWidth / img.naturalHeight };
    });
    expect(hero.fit === "contain" && Math.abs(hero.ratio - hero.natural) < 0.05, `photo keeps its shape (${JSON.stringify(hero)})`);
    const button = await phone.locator("[data-section=hero] a[href='#order-form']").boundingBox();
    expect(button.width > 300, `order button fills the phone width (${button.width})`);
    await phone.locator("[data-section=hero]").getByText("-29%").waitFor();
    expect((await phone.evaluate(() => document.documentElement.scrollWidth)) <= 390, "no sideways scrolling");
    await phone.close();
  });

  await step("image work counts in the monthly AI quota", async () => {
    await db.query("UPDATE shop_contracts SET limits = ? WHERE id = ?", [JSON.stringify({ maxLandingPages: 10, maxAiPerMonth: 3 }), contractId]);
    await owner.goto(`${section}/${pageId}`);
    const block = owner.locator("[data-editor-section=hero]").first();
    await block.locator("button[aria-expanded]").click();
    const enhance = block.locator("[data-testid=enhance-image]");
    await enhance.locator("button").click();
    await enhance.getByText("وصلت إلى الحد الشهري لاستعمال الذكاء الاصطناعي").waitFor();
    expect(uploaded.length === 2, "originals kept");
  });

  await context.close();
}
