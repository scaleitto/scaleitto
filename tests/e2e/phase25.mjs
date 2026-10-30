// Phase 25 (owner round 9, what remains after the Zimam orders rebuild): one order form for the store, landing pages and
// the embed code.
import { randomUUID } from "node:crypto";
import { BASE, createShop, db, expect, step } from "./helpers.mjs";

export default async function phase25(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  const dash = `${BASE}/ar/dashboard`;
  const lamp = randomUUID();
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'مصباح', 'lamp', 2000, '[]', '[]', '[]')", [lamp, shopId]);
  await step("one order form: the product's embed code works on any website, with the same form", async () => {
    await owner.goto(`${dash}/store-design/order-form`);
    await owner.locator("[data-testid=embed-source]").selectOption(lamp);
    const code = await owner.locator("[data-testid=embed-code]").inputValue();
    expect(code.includes(`/embed/shop-${tag}/p/lamp`) && code.includes("<iframe"), "embed code for the product");
    const p = await browser.newPage();
    await p.goto(`${BASE}/embed/shop-${tag}/p/lamp`);
    await p.fill("#name", "زبون الكود");
    await p.fill("#phone", "0661 44 55 66");
    await p.selectOption("#wilaya", "16");
    await p.waitForSelector("#commune option[value='Hydra']", { state: "attached" });
    await p.selectOption("#commune", "Hydra");
    await p.waitForTimeout(4500);
    await Promise.all([p.waitForURL(/\/embed\/[^/]+\/thanks\?o=/), p.locator("button[type=submit]").click({ force: true })]);
    const [[o]] = await db.query("SELECT customer_name FROM orders WHERE id = ?", [new URL(p.url()).searchParams.get("o")]);
    expect(o.customer_name === "زبون الكود", "order from the embedded form");
    await p.close();
  });

  await context.close();
}
