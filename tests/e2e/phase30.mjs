// Phase 30 (landing pages like Zimam): the builder's tools — suggestions (add or dismiss), duplicate / hide / delete
// from a block's toolbar, undo and redo, the page's name, History (restore an earlier save), "Discard changes" back to
// the published page — and the list's filters and grid view.
import { randomUUID } from "node:crypto";
import { BASE, createLandingManually, createShop, db, expect, landingRow, step, until } from "./helpers.mjs";

export default async function phase30(browser) {
  const { shopId, context } = await createShop(browser);
  const owner = await context.newPage();
  owner.on("dialog", (d) => d.accept());
  const section = `${BASE}/ar/dashboard/landing-pages`;
  await db.query("INSERT INTO shop_contracts (id, shop_id, start_date, limits) VALUES (?, ?, CURDATE() - INTERVAL 1 DAY, ?)", [randomUUID(), shopId, JSON.stringify({ maxLandingPages: 10 })]);
  const productId = randomUUID();
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'حذاء رياضي', 'shoe', 4500, '[]', '[]', '[]')", [productId, shopId]);
  const types = async (id) => (await landingRow(id)).sections.map((s) => s.type).join();
  let pageId;

  await step("suggestions: reviews, countdown, trust badges and a sticky button; one added, one dismissed", async () => {
    await owner.goto(section);
    pageId = await createLandingManually(owner, productId);
    const box = owner.locator("[data-testid=suggestions]");
    for (const k of ["reviews", "countdown", "badges", "sticky"]) await box.locator(`[data-suggest=${k}]`).waitFor();
    await box.locator("[data-suggest=badges] button").last().click();
    await owner.waitForSelector("[data-testid=section-panel][data-selected=badges]");
    expect((await owner.locator("[data-testid=landing-preview] [data-section=badges] li").count()) === 4, "four ready badges");
    await box.locator("[data-suggest=countdown] button").first().click();
    expect(!(await box.locator("[data-suggest=countdown]").count()) && !(await box.locator("[data-suggest=badges]").count()), "added and dismissed suggestions leave the list");
    await until(async () => (await types(pageId)) === "image,badges,form", "badges saved after the image");
  });

  await step("a block's toolbar: duplicate, hide, delete; undo and redo", async () => {
    const badges = owner.locator("[data-testid=landing-preview] [data-type=badges]").first();
    await badges.click();
    await badges.locator("[data-tool=duplicate]").click();
    expect((await owner.locator("[data-testid=landing-preview] [data-type=badges]").count()) === 2, "duplicated");
    await owner.locator("[data-testid=landing-preview] [data-type=badges]").first().locator("[data-tool=hide]").click();
    await owner.click("[data-testid=undo]");
    await owner.click("[data-testid=undo]");
    expect((await owner.locator("[data-testid=landing-preview] [data-type=badges]").count()) === 1, "undo twice: back to one block");
    await owner.click("[data-testid=redo]");
    expect((await owner.locator("[data-testid=landing-preview] [data-type=badges]").count()) === 2, "redo: duplicated again");
    await owner.locator("[data-testid=landing-preview] [data-type=badges]").last().click();
    await owner.click("[data-testid=panel-delete]");
    await until(async () => (await types(pageId)) === "image,badges,form", "deleted and saved");
  });

  await step("the page's name, then History restores an earlier save", async () => {
    await owner.fill("[data-testid=page-title]", "صفحة الحذاء");
    await until(async () => (await landingRow(pageId)).title === "صفحة الحذاء", "name saved");
    // An earlier save (History keeps one every few minutes while editing)
    await db.query("INSERT INTO landing_versions (id, shop_id, page_id, title, sections, created_at) VALUES (?, ?, ?, 'نسخة قديمة', ?, NOW(3) - INTERVAL 1 HOUR)", [randomUUID(), shopId, pageId, JSON.stringify({ sections: [{ id: "t", type: "text", title: "من السجل", body: "" }, { id: "f", type: "form" }], variants: [] })]);
    await owner.click("[data-testid=open-history]");
    const dialog = owner.locator("[data-testid=history-dialog]");
    await dialog.getByText("نسخة قديمة").waitFor();
    await dialog.locator("li", { hasText: "نسخة قديمة" }).locator("[data-testid=restore-version]").click();
    await owner.waitForSelector('[data-testid=landing-preview] [data-section=text]:has-text("من السجل")');
    await until(async () => (await types(pageId)) === "text,form", "restored and saved");
  });

  await step("Discard changes goes back to the published page", async () => {
    await owner.click("[data-testid=publish]");
    await owner.waitForSelector("text=تم النشر");
    await owner.click("[data-add=video]");
    await until(async () => (await types(pageId)) === "text,video,form", "draft saved");
    await owner.click("[data-testid=discard-changes]");
    await until(async () => !(await owner.locator("[data-testid=landing-preview] [data-type=video]").count()), "video gone from the builder");
    await until(async () => (await types(pageId)) === "text,form", "draft back to the published page");
  });

  await step("the list: filters by status and product, the grid view is remembered", async () => {
    await owner.goto(section);
    await owner.click("[data-testid=create-landing]");
    await owner.click("[data-create=manual]");
    await owner.selectOption("#create-product", productId);
    await Promise.all([owner.waitForURL(/landing-pages\/[0-9a-f-]{36}$/), owner.click("[data-testid=create-manual]")]);
    await owner.goto(section);
    await owner.selectOption("[data-filter=status]", "draft");
    expect((await owner.locator("[data-testid=landing-list] [data-page]").count()) === 1, "one draft");
    await owner.selectOption("[data-filter=status]", "");
    await owner.selectOption("[data-filter=product]", productId);
    expect((await owner.locator("[data-testid=landing-list] [data-page]").count()) === 2, "both for the product");
    await owner.click("[data-view=grid]");
    await owner.reload();
    await owner.waitForSelector("[data-testid=landing-list][data-layout=grid]");
  });

  await context.close();
}
