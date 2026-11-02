// Phase 23 (owner round 7): the sidebar in groups with sub-sections (Orders, Store design, Integrations), the admin's way
// back, Orders → Returns (receive, send again) and Order analysis, Inventory (movements, adjustments, alert threshold),
// Finance (money held by couriers, expenses, net profit), and the order form's templates per product, new field types,
// blocks and two steps.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { BASE, createShop, db, expect, step } from "./helpers.mjs";

const json = (v) => (typeof v === "string" ? JSON.parse(v) : v);

export default async function phase23(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  const dash = `${BASE}/ar/dashboard`;
  const store = `${BASE}/store/shop-${tag}`;
  const lamp = randomUUID();
  const vase = randomUUID();
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, track_stock, stock, images, options, offers) VALUES (?, ?, 'مصباح', 'lamp', 3000, 1, 10, '[]', '[]', '[]')", [lamp, shopId]);
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'مزهرية', 'vase', 2000, '[]', '[]', '[]')", [vase, shopId]);

  let number = 5000;
  const order = async ({ status, total = 3400 }) => {
    const id = randomUUID();
    number++;
    await db.query(
      "INSERT INTO orders (id, shop_id, number, customer_name, phone, wilaya_code, commune, delivery_type, subtotal, shipping_price, total, status) VALUES (?, ?, ?, 'زبون', '0661000000', 16, 'Kouba', 'home', ?, 400, ?, ?)",
      [id, shopId, number, total - 400, total, status],
    );
    await db.query("INSERT INTO order_items (id, shop_id, order_id, product_id, name, quantity, unit_price, total) VALUES (?, ?, ?, ?, 'مصباح', 1, ?, ?)", [randomUUID(), shopId, id, lamp, total - 400, total - 400]);
    return { id, number };
  };
  const parcel = (orderId, stage) => db.query("INSERT INTO shipments (id, shop_id, order_id, carrier_name, tracking_number, status) VALUES (?, ?, ?, 'Yalidine', ?, ?)", [randomUUID(), shopId, orderId, `YAL-${number}`, stage]);

  await step("sidebar (Zimam's layout): sell / grow / storefront / account groups; Delivery opens its sub-sections", async () => {
    await owner.goto(dash);
    const groups = await owner.locator("aside [data-section]").evaluateAll((els) => els.map((e) => e.dataset.section));
    expect(groups.join() === "main,sell,grow,storefront,account", `groups (got ${groups.join()})`);
    const order = await owner.locator("aside nav li[data-nav]").evaluateAll((els) => els.map((li) => li.dataset.nav));
    expect(order.join() === "overview,products,orders,scan,delivery,channels,callCenters,landingPages,analytics,pixels,apps,storeDesign,themes,settings,team,plans,profile", `entries (got ${order.join()})`);
    // An entry with sub-pages opens and closes; its sub-pages slide under it
    const group = owner.locator("aside li[data-nav=delivery]");
    await group.locator(":scope > button").click();
    expect((await group.getAttribute("data-open")) === "true", "opened");
    await group.locator("[data-testid=nav-children] a").last().click();
    await owner.waitForURL("**/dashboard/delivery/settings");
    expect((await owner.locator("[data-testid=section-tabs] a").count()) === 3, "Delivery tabs: companies, manifest, settings");
    expect((await group.locator("[data-testid=nav-children] a").count()) === 3, "sub-sections under Delivery in the sidebar");
    await group.locator(":scope > button").click();
    expect((await group.getAttribute("data-open")) === "false", "closed again");
    // Quick search (⌘K) jumps to a page
    await owner.locator("[data-testid=quick-search]").click();
    await owner.locator("[data-testid=command-palette] input").fill("الثيمات");
    await owner.keyboard.press("Enter");
    await owner.waitForURL("**/dashboard/store-design/themes");
    // Dark mode is remembered
    await owner.locator("[data-testid=theme-toggle]").click();
    expect((await owner.evaluate(() => document.documentElement.dataset.theme)) === "dark", "dark mode on");
    await owner.reload();
    expect((await owner.evaluate(() => document.documentElement.dataset.theme)) === "dark", "dark mode remembered");
    await owner.locator("[data-testid=theme-toggle]").click();
    // Old addresses still work
    await owner.goto(`${dash}/pixels`);
    await owner.waitForURL("**/dashboard/integrations/pixels");
  });

  await step("platform admin: a clear way back to the dashboard", async () => {
    const adminId = randomUUID();
    await db.query("INSERT INTO users (id, email, name, password_hash, locale, is_platform_admin, email_verified_at) VALUES (?, ?, 'Admin', 'scrypt$00$00', 'ar', 1, NOW())", [adminId, `admin23-${tag}@test.dz`]);
    await db.query("INSERT INTO shops (id, slug, name, owner_id, plan_id) VALUES (?, ?, 'Platform', ?, (SELECT id FROM plans WHERE code = 'starter'))", [randomUUID(), `plat-${tag}`, adminId]);
    await db.query("INSERT INTO shop_members (shop_id, user_id, role) SELECT id, ?, 'owner' FROM shops WHERE slug = ?", [adminId, `plat-${tag}`]);
    const token = randomBytes(32).toString("base64url");
    await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))", [createHash("sha256").update(token).digest("hex"), adminId]);
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "sc_session", value: token, url: BASE }]);
    const a = await ctx.newPage();
    await a.goto(`${BASE}/ar/admin`);
    const back = a.locator("[data-testid=back-to-dashboard]");
    expect((await back.innerText()).includes("الرجوع إلى لوحة التحكم"), "named as asked");
    await Promise.all([a.waitForURL(/\/ar\/dashboard$/), back.click()]);
    await ctx.close();
  });

  await step("order analysis (now in Analytics): rates and couriers of the period", async () => {
    const d = await order({ status: "delivered" });
    await parcel(d.id, "delivered");
    const r = await order({ status: "returned" });
    await parcel(r.id, "returned");
    await owner.goto(`${dash}/orders/insights`);
    await owner.waitForURL(/\/dashboard\/analytics$/);
    await owner.locator("[data-testid=insight-kpis] [data-kpi=return]").waitFor();
    expect((await owner.locator("[data-kpi=return] [data-value]").innerText()).includes("%"), "return rate");
    await owner.locator('[data-testid=carriers] [data-row="Yalidine"]').waitFor();
  });

  await context.close();
}
