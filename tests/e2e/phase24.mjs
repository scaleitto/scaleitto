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

  await step("offers: a ready-made offer with free delivery, a badge and preselected; the store and the order honour it", async () => {
    await owner.goto(`${dash}/products/${lamp}`);
    await owner.click("[data-form-tab=offers]");
    await owner.locator('[data-testid=offer-templates] button[data-template="2-10"]').click();
    const offer = owner.locator("[data-testid=offers] [data-offer='2']");
    await offer.locator("[data-testid=offer-free-shipping]").check();
    await offer.locator("[data-testid=offer-preselected]").check();
    await offer.locator("select").selectOption("bestSeller");
    await offer.locator('input[aria-label="هدية مع العرض (اختياري)"]').fill("حافظة مجانية");
    await owner.locator("[data-testid=save-product]").click();
    await expectSoon(async () => json((await db.query("SELECT offers FROM products WHERE id = ?", [lamp]))[0][0].offers).length === 1, "offer saved");
    const [[p]] = await db.query("SELECT offers FROM products WHERE id = ?", [lamp]);
    const [saved] = json(p.offers);
    expect(saved.quantity === 2 && saved.price === 3600 && saved.freeShipping && saved.preselected && saved.badge === "bestSeller" && saved.gift === "حافظة مجانية", `offer saved (got ${JSON.stringify(saved)})`);
    await db.query("INSERT INTO shipping_rates (shop_id, wilaya_code, home_price, office_price) VALUES (?, 16, 500, 300)", [shopId]);
    const page = await browser.newPage();
    await page.goto(`${store}/p/lamp`);
    const card = page.locator("[data-offer-card='2']");
    expect(await card.locator("input[type=radio]").isChecked(), "preselected");
    expect((await card.locator("[data-testid=offer-badge]").innerText()) === "الأكثر طلباً" && (await card.locator("[data-testid=offer-free-shipping]").count()) && (await card.locator("[data-testid=offer-gift]").innerText()).includes("حافظة مجانية"), "badge, free delivery and gift on the card");
    await page.fill("#name", "زبون العرض");
    await page.fill("#phone", "0661 22 33 45");
    await page.selectOption("#wilaya", "16");
    await page.waitForSelector("#commune option[value='Kouba']", { state: "attached" });
    await page.selectOption("#commune", "Kouba");
    await page.waitForTimeout(4500);
    await Promise.all([page.waitForURL(/\/thanks\?o=/), page.locator("button[type=submit]").click({ force: true })]);
    const [[o]] = await db.query("SELECT o.shipping_price AS ship, o.subtotal, i.offer_label AS label FROM orders o JOIN order_items i ON i.order_id = o.id WHERE o.id = ?", [new URL(page.url()).searchParams.get("o")]);
    expect(o.ship === 0 && o.subtotal === 3600 && o.label.includes("حافظة مجانية"), `free delivery and the gift on the order (got ${JSON.stringify(o)})`);
    await page.close();
  });

  await step("store design: the live preview scrolls", async () => {
    await owner.goto(`${dash}/store-design`);
    const preview = owner.locator("[data-testid=design-preview]");
    await preview.hover();
    await owner.mouse.wheel(0, 600);
    await owner.waitForTimeout(400);
    expect((await preview.evaluate((el) => el.scrollTop)) > 0, "the wheel scrolls the preview");
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
