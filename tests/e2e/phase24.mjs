// Phase 24 (owner round 8, what remains after the Zimam orders rebuild): more protection options, richer product offers,
// the store design preview that scrolls, the 11 landing page angles (automatic / chosen) and the admin plans matching the
// subscription page.
import { randomUUID } from "node:crypto";
import { BASE, createShop, db, expect, step } from "./helpers.mjs";

const json = (v) => (typeof v === "string" ? JSON.parse(v) : v);

export default async function phase24(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  const dash = `${BASE}/ar/dashboard`;
  const store = `${BASE}/store/shop-${tag}`;
  const lamp = randomUUID();
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'مصباح', 'lamp', 2000, '[]', '[]', '[]')", [lamp, shopId]);

  await step("offers (Zimam's rows): free delivery and chosen by default; a switched-off offer stays out of the store; the order honours it", async () => {
    await owner.goto(`${dash}/products/${lamp}`);
    await owner.locator("[data-testid=product-form][data-ready]").waitFor();
    await owner.click("[data-form-tab=offers]");
    await owner.locator("[data-testid=upsell-offers]").check({ force: true });
    await owner.click("[data-testid=add-offer]");
    await owner.click("[data-testid=add-offer]");
    const rows = owner.locator("[data-testid=offer-rows] [data-offer]");
    await rows.nth(0).locator('[aria-label="الكمية"]').fill("2");
    await rows.nth(0).locator('[aria-label="السعر الإجمالي"]').fill("3600");
    await rows.nth(0).locator('[aria-label="نص العرض (اختياري)"]').fill("قطعتان بسعر خاص");
    await rows.nth(0).locator("[data-testid=offer-free-shipping]").check({ force: true });
    await rows.nth(0).locator("[data-testid=offer-preselected]").click();
    await rows.nth(1).locator('[aria-label="الكمية"]').fill("3");
    await rows.nth(1).locator('[aria-label="السعر الإجمالي"]').fill("5000");
    await rows.nth(1).locator("[data-testid=offer-active]").click();
    await owner.locator("[data-testid=save-product]").click();
    await expectSoon(async () => json((await db.query("SELECT offers FROM products WHERE id = ?", [lamp]))[0][0].offers).length === 2, "offers saved");
    const [[p]] = await db.query("SELECT offers FROM products WHERE id = ?", [lamp]);
    const [saved, off] = json(p.offers);
    expect(saved.quantity === 2 && saved.price === 3600 && saved.freeShipping && saved.preselected && saved.label === "قطعتان بسعر خاص" && off.quantity === 3 && off.off === true, `offers saved (got ${JSON.stringify(json(p.offers))})`);
    await db.query("INSERT INTO shipping_rates (shop_id, wilaya_code, home_price, office_price) VALUES (?, 16, 500, 300)", [shopId]);
    const page = await browser.newPage();
    await page.goto(`${store}/p/lamp`);
    const card = page.locator("[data-offer-card='2']");
    expect(await card.locator("input[type=radio]").isChecked(), "preselected");
    expect((await card.locator("[data-testid=offer-free-shipping]").count()) > 0, "free delivery on the card");
    expect(!(await page.locator("[data-offer-card='3']").count()), "the switched-off offer is not offered");
    await page.fill("#name", "زبون العرض");
    await page.fill("#phone", "0661 22 33 45");
    await page.selectOption("#wilaya", "16");
    await page.waitForSelector("#commune option[value='Kouba']", { state: "attached" });
    await page.selectOption("#commune", "Kouba");
    await page.waitForTimeout(4500);
    await Promise.all([page.waitForURL(/\/thanks\?o=/), page.locator("button[type=submit]").click({ force: true })]);
    const [[o]] = await db.query("SELECT o.shipping_price AS ship, o.subtotal, i.offer_label AS label FROM orders o JOIN order_items i ON i.order_id = o.id WHERE o.id = ?", [new URL(page.url()).searchParams.get("o")]);
    expect(o.ship === 0 && o.subtotal === 3600 && o.label.includes("قطعتان بسعر خاص"), `free delivery and the offer on the order (got ${JSON.stringify(o)})`);
    await page.close();
  });

  await step("store design: the live preview scrolls", async () => {
    await owner.goto(`${dash}/store-design`);
    await owner.setViewportSize({ width: 1280, height: 500 });
    const preview = owner.locator("[data-testid=design-preview]");
    await preview.hover();
    await owner.mouse.wheel(0, 600);
    await owner.waitForTimeout(400);
    expect((await preview.evaluate((el) => el.parentElement.scrollTop)) > 0, "the wheel scrolls the preview");
    await owner.setViewportSize({ width: 1280, height: 800 });
  });

  await step("platform admin: the plans are the subscription page's plans", async () => {
    await db.query("UPDATE users SET is_platform_admin = 1 WHERE id = (SELECT owner_id FROM shops WHERE id = ?)", [shopId]);
    await owner.goto(`${BASE}/ar/admin/plans`);
    const [[active]] = await db.query("SELECT COUNT(*) AS n FROM plans WHERE is_active = 1");
    const shown = await owner.locator("[data-testid=admin-plans] > *").count();
    expect(shown === active.n, `${shown} plans shown, ${active.n} offered`);
    await db.query("UPDATE users SET is_platform_admin = 0 WHERE id = (SELECT owner_id FROM shops WHERE id = ?)", [shopId]);
  });

  await context.close();
}

async function expectSoon(check, message, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  expect(false, message);
}
