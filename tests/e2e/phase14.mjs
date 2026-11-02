// Phase 14: AI product descriptions and the monthly AI quota.
import { randomUUID } from "node:crypto";
import { BASE, createShop, db, expect, step } from "./helpers.mjs";

export default async function phase14(browser) {
  const { shopId, context } = await createShop(browser);
  const owner = await context.newPage();
  const productId = randomUUID();
  await db.query("INSERT INTO products (id, shop_id, name, slug, description, price, images, options, offers) VALUES (?, ?, 'ساعة ذكية', 'smartwatch', 'ساعة مقاومة للماء', 4900, '[]', '[]', '[]')", [productId, shopId]);
  // Room for the AI tasks of this test (the free plan has 3 a month)
  const contractId = randomUUID();
  await db.query("INSERT INTO shop_contracts (id, shop_id, start_date, limits) VALUES (?, ?, CURDATE() - INTERVAL 1 DAY, ?)", [contractId, shopId, JSON.stringify({ maxAiPerMonth: 20 })]);

  await step("product description written by the AI into the form, saved with the product", async () => {
    await owner.goto(`${BASE}/ar/dashboard/products/${productId}`);
    await owner.locator("[data-testid=product-form][data-ready]").waitFor();
    await owner.click("[data-form-tab=description]");
    // The old plain description opens in the editor as a paragraph
    expect((await owner.locator("#description").innerText()).includes("ساعة مقاومة للماء"), "existing description in the editor");
    await owner.fill("[data-testid=selling-points]", "مقاومة للماء\nشاشة ملونة");
    await owner.locator("[data-testid=ai-description]").click();
    await owner.waitForFunction(() => document.querySelector("#description")?.textContent?.startsWith("وصف من الذكاء الاصطناعي"), null, { timeout: 30_000 });
    expect((await owner.locator("#description").innerText()).includes("ساعة ذكية"), "written for this product");
    expect((await owner.locator("#description li").count()) === 2, "the AI's lines became a list");
    await owner.locator("[data-testid=save-product]").click();
    let saved = "";
    for (let i = 0; i < 30 && !saved.startsWith("<p>وصف من الذكاء الاصطناعي"); i++) {
      [[{ description: saved }]] = await db.query("SELECT description FROM products WHERE id = ?", [productId]);
      await owner.waitForTimeout(150);
    }
    expect(saved.startsWith("<p>وصف من الذكاء الاصطناعي") && saved.includes("<ul><li>"), `saved as rich text (got ${saved.slice(0, 80)})`);
  });

  await step("the monthly AI quota applies", async () => {
    await db.query("UPDATE shop_contracts SET limits = ? WHERE id = ?", [JSON.stringify({ maxAiPerMonth: 1 }), contractId]);
    await owner.goto(`${BASE}/ar/dashboard/products/${productId}`);
    await owner.locator("[data-testid=product-form][data-ready]").waitFor();
    await owner.click("[data-form-tab=description]");
    await owner.locator("[data-testid=ai-description]").click();
    await owner.getByText("وصلت إلى الحد الشهري لاستعمال الذكاء الاصطناعي").waitFor();
  });

  await context.close();
}
