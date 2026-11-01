// Phase 30 (Zimam parity, phase 6): landing pages — the list (numbers, filters, list / grid, create with two paths)
// and the builder (components to add, a click in the preview selects a block, its settings on the side, suggestions,
// save state, history with restore, discard, publish).
import { randomUUID } from "node:crypto";
import { BASE, createShop, db, expect, step } from "./helpers.mjs";

export default async function phase30(browser) {
  const { shopId, context } = await createShop(browser);
  const owner = await context.newPage();
  const section = `${BASE}/ar/dashboard/landing-pages`;
  const lamp = randomUUID();
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'مصباح', 'lamp', 2000, '[]', '[]', '[]')", [lamp, shopId]);
  let pageId;

  await step("design manually: pick a product, a blank page with only the order form opens in the builder", async () => {
    await owner.goto(section);
    expect((await owner.locator("[data-testid=landing-stats] [data-stat=total] [data-value]").innerText()) === "0", "no page yet");
    await owner.click("[data-testid=create-landing]");
    await owner.click("[data-create=manual]");
    await owner.selectOption("#create-product", lamp);
    await Promise.all([owner.waitForURL(/landing-pages\/[0-9a-f-]{36}$/), owner.click("[data-testid=create-manual]")]);
    pageId = owner.url().split("/").pop();
    await owner.locator("[data-testid=landing-builder]").waitFor();
    const layers = await owner.locator("[data-editor-section]").evaluateAll((els) => els.map((e) => e.dataset.editorSection));
    expect(layers.join() === "form", `only the form (got ${layers.join()})`);
    expect((await owner.locator("[data-testid=save-state]").getAttribute("data-dirty")) === "false", "saved");
  });

  await step("components: an announcement bar and a spacer; a click in the preview selects a block", async () => {
    await owner.click("[data-add=announcement]");
    await owner.locator("[data-testid=section-panel][data-selected=announcement] [data-field=announcement]").fill("توصيل مجاني هذا الأسبوع");
    await owner.locator('[data-testid=landing-preview] [data-section=announcement]:has-text("توصيل مجاني هذا الأسبوع")').waitFor();
    await owner.click("[data-add=spacer]");
    await owner.locator("[data-testid=section-panel][data-selected=spacer]").waitFor();
    await owner.locator("[data-testid=landing-preview] [data-section=announcement]").click();
    await owner.locator("[data-testid=section-panel][data-selected=announcement]").waitFor();
    expect((await owner.locator("[data-testid=save-state]").getAttribute("data-dirty")) === "true", "unsaved changes");
  });

  await step("suggestions: real reviews, countdown, trust badges, FAQ; adding one opens it", async () => {
    const kinds = await owner.locator("[data-testid=suggestions] [data-suggest]").evaluateAll((els) => els.map((e) => e.dataset.suggest));
    expect(kinds.join() === "reviews,countdown,badges,faq", `suggestions (got ${kinds.join()})`);
    await owner.locator("[data-suggest=faq] button").click();
    await owner.locator("[data-testid=section-panel][data-selected=faq]").waitFor();
    expect(!(await owner.locator("[data-suggest=faq]").count()), "the FAQ suggestion goes away");
  });

  await step("save, history and restore; discard goes back to what was saved", async () => {
    await owner.click("[data-testid=save-page]");
    await owner.locator("[data-testid=save-state][data-dirty=false]").waitFor();
    // A second version without the announcement
    await owner.locator("[data-editor-section=announcement] button[aria-label='حذف']").click();
    await owner.click("[data-testid=save-page]");
    await owner.locator("[data-testid=save-state][data-dirty=false]").waitFor();
    const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM landing_versions WHERE page_id = ?", [pageId]);
    expect(n === 2, `two versions (got ${n})`);
    // Discard
    await owner.click("[data-add=spacer]");
    owner.once("dialog", (d) => d.accept());
    await owner.click("[data-testid=discard-changes]");
    expect((await owner.locator("[data-editor-section=spacer]").count()) === 1, "back to the saved page");
    // Restore the older version (with the announcement)
    await owner.click("[data-testid=open-history]");
    const versions = owner.locator("[data-testid=history-dialog] [data-version]");
    await versions.nth(1).waitFor();
    await versions.nth(1).locator("[data-testid=restore-version]").click();
    await owner.locator("[data-editor-section=announcement]").waitFor();
    await owner.click("[data-testid=save-page]");
    await owner.locator("[data-testid=save-state][data-dirty=false]").waitFor();
    const [[row]] = await db.query("SELECT sections FROM landing_pages WHERE id = ?", [pageId]);
    const sections = typeof row.sections === "string" ? JSON.parse(row.sections) : row.sections;
    expect(sections.some((s) => s.type === "announcement"), "restored and saved");
  });

  await step("publish; the list shows the numbers, filters and the grid", async () => {
    await owner.click("[data-testid=toggle-publish]");
    await owner.waitForFunction(() => document.querySelector("[data-testid=toggle-publish]")?.textContent?.includes("إلغاء النشر"));
    await owner.goto(section);
    expect((await owner.locator("[data-stat=live] [data-value]").innerText()) === "1", "1 live");
    const card = owner.locator("[data-page='مصباح']");
    expect((await card.innerText()).includes("/lp/"), "the page address");
    await owner.selectOption("[data-filter=status]", "draft");
    expect(!(await owner.locator("[data-page]").count()), "no draft");
    await owner.selectOption("[data-filter=status]", "published");
    await owner.locator("[data-page='مصباح']").waitFor();
    await owner.click("[data-view=grid]");
    await owner.locator("[data-testid=landing-list][data-layout=grid]").waitFor();
    await owner.reload();
    await owner.locator("[data-testid=landing-list][data-layout=grid]").waitFor();
    await owner.click("[data-view=list]");
  });

  await context.close();
}
