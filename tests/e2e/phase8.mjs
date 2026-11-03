// Phase 8: analytics like Zimam — the period dropdown, four tabs (orders, products, impressions, call center), the
// numbers of each tab, store visits counted by VisitPing, roles and tenant isolation.
import { randomUUID } from "node:crypto";
import { BASE, BROWSER_ARGS, createSession, createShop, db, expect, step, until } from "./helpers.mjs";

export default async function phase8(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  const section = `${BASE}/ar/dashboard/analytics`;
  const DAY = 86400_000;
  const ago = (days, minutes = 0) => new Date(Date.now() - days * DAY - minutes * 60_000);
  const kpi = async (id) => (await owner.locator(`[data-kpi=${id}] [data-value]`).innerText()).replace(/\s/g, "");

  await step("the page: title, period (last 7 days), four tabs; an empty store shows zeros", async () => {
    await owner.goto(section);
    expect((await owner.locator("[data-testid=period]").inputValue()) === "7d", "last 7 days by default");
    expect((await owner.locator("[data-testid=analytics-tabs] a").count()) === 4, "4 tabs");
    expect((await kpi("orders")) === "0", "no orders yet");
  });

  const productId = randomUUID();
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'حذاء رياضي', 'shoe', 4000, '[]', '[]', '[]')", [productId, shopId]);
  let number = 1000;
  const addOrder = async ({ when, status, wilaya = 16, quantity = 1 }) => {
    const id = randomUUID();
    const subtotal = 4000 * quantity;
    await db.query(
      "INSERT INTO orders (id, shop_id, number, status, customer_name, phone, wilaya_code, commune, delivery_type, subtotal, shipping_price, total, created_at) VALUES (?, ?, ?, ?, 'زبون', '0661000000', ?, 'x', 'home', ?, 500, ?, ?)",
      [id, shopId, ++number, status, wilaya, subtotal, subtotal + 500, when],
    );
    await db.query("INSERT INTO order_items (id, order_id, shop_id, product_id, name, unit_price, quantity, total) VALUES (UUID(), ?, ?, ?, 'حذاء رياضي', 4000, ?, ?)", [id, shopId, productId, quantity, subtotal]);
    return id;
  };
  await addOrder({ when: ago(0, 5), status: "pending" });
  await addOrder({ when: ago(1), status: "abandoned" }); // not an order
  await addOrder({ when: ago(2), status: "delivered", quantity: 2 });
  await addOrder({ when: ago(3), status: "delivered", wilaya: 31 });
  await addOrder({ when: ago(3), status: "returned", wilaya: 31 });
  await addOrder({ when: ago(5), status: "cancelled", wilaya: 31 });
  await addOrder({ when: ago(10), status: "delivered" }); // the 7 days before

  // Another shop's orders must never be counted
  const other = await createShop(browser);
  await db.query("INSERT INTO orders (id, shop_id, number, status, customer_name, phone, wilaya_code, commune, delivery_type, subtotal, shipping_price, total) VALUES (UUID(), ?, 1001, 'delivered', 'x', '0661000000', 16, 'x', 'home', 99999, 0, 99999)", [other.shopId]);

  await step("orders tab: KPIs against the 7 days before, statuses, funnel, insights, wilayas, charts", async () => {
    await owner.goto(section);
    expect((await kpi("orders")) === "5", `5 orders in 7 days (got ${await kpi("orders")})`);
    expect((await kpi("delivery")) === "66.7%", `delivery 2 ÷ 3 (got ${await kpi("delivery")})`);
    expect((await kpi("sales")).includes("26500"), `all orders' totals (got ${await kpi("sales")})`);
    expect((await owner.locator("[data-kpi=orders]").innerText()).includes("+400%"), "5 vs 1 the 7 days before");
    expect((await owner.locator("[data-testid=status-distribution] [data-status=delivered]").innerText()).includes("2"), "2 delivered");
    expect((await owner.locator("[data-testid=funnel] [data-step=delivered]").innerText()).includes("2"), "funnel: 2 delivered");
    await owner.locator("[data-testid=insights] [data-insight=pending]").waitFor();
    const oran = await owner.locator('[data-testid=wilayas] [data-wilaya="31"]').innerText();
    expect(oran.includes("3") && oran.includes("50.0%"), `wilaya 31: 3 orders, 50% returned (got ${oran})`);
    for (const id of ["orders-over-time", "sales-over-time", "delivery-performance"]) expect(await owner.locator(`[data-testid=${id}] svg`).count(), `${id} chart`);
    // The wilaya map colours Oran (and the wilaya taken from it is not counted twice)
    expect((await owner.locator("[data-testid=wilaya-map] [data-map-wilaya='31']").getAttribute("data-orders")) === "3", "Oran on the map");
    expect(await owner.locator("[data-testid=funnel-shape]").count(), "funnel shape");
  });

  await step("visits from the store are counted once per visitor and day, with their source", async () => {
    const visitor = await browser.newContext({ userAgent: BROWSER_ARGS[0].replace("--user-agent=", "") });
    const p = await visitor.newPage();
    await p.goto(`${BASE}/store/shop-${tag}/p/shoe`);
    await until(async () => (await db.query("SELECT impressions FROM page_views WHERE shop_id = ? AND product_id = ?", [shopId, productId]))[0][0]?.impressions === 1, "first view counted");
    await p.reload();
    await until(async () => (await db.query("SELECT SUM(impressions) AS i FROM page_views WHERE shop_id = ? AND product_id = ?", [shopId, productId]))[0][0]?.i == 2, "second view counted");
    const [[row]] = await db.query("SELECT SUM(visitors) AS v FROM page_views WHERE shop_id = ? AND product_id = ?", [shopId, productId]);
    expect(Number(row.v) === 1, "one visitor");
    await visitor.close();
    // Older days of visits for the charts and sources
    const day = (d) => new Date(Date.now() + 3600_000 - d * DAY).toISOString().slice(0, 10);
    await db.query("INSERT INTO page_views (shop_id, day, product_id, source, impressions, visitors) VALUES (?, ?, ?, 'facebook.com', 60, 49)", [shopId, day(2), productId]);
  });

  await step("products tab: visitors, orders, order rate, the performance table", async () => {
    await owner.locator("[data-testid=analytics-tabs] [data-tab=products]").click();
    await owner.waitForURL(/tab=products/);
    expect((await kpi("visitors")) === "50", `50 visitors (got ${await kpi("visitors")})`);
    expect((await kpi("orderRate")) === "10.0%", `5 orders ÷ 50 visitors (got ${await kpi("orderRate")})`);
    expect((await owner.locator('[data-testid=products-table] [data-product="حذاء رياضي"] [data-col=orderRate]').innerText()) === "10.0%", "the product's order rate");
    expect((await owner.locator("[data-testid=bands] [data-band=excellent]").innerText()).includes("1"), "one excellent product");
  });

  await step("impressions tab: impressions, visitors, sources; call center tab", async () => {
    await owner.locator("[data-testid=analytics-tabs] [data-tab=impressions]").click();
    await owner.waitForURL(/tab=impressions/);
    expect((await kpi("impressions")) === "62", `62 impressions (got ${await kpi("impressions")})`);
    await owner.locator('[data-testid=sources] [data-source="facebook.com"]').waitFor();
    // Zimam: the daily trend shows one line, switched between impressions and visitors
    await owner.click("[data-testid=trend-switch] [data-trend=visitors]");
    await owner.waitForURL(/trend=visitors/);
    expect((await owner.locator("[data-testid=trend-switch] [data-trend=visitors]").getAttribute("aria-current")) === "true", "visitors trend");
    await owner.locator("[data-testid=analytics-tabs] [data-tab=team]").click();
    await owner.waitForURL(/tab=team/);
    await owner.getByText("لا يوجد موظفون بعد").waitFor();
  });

  await step("the period dropdown keeps the tab", async () => {
    await owner.selectOption("[data-testid=period]", "today");
    await owner.waitForURL(/tab=team&period=today/);
    await owner.locator("[data-testid=analytics-tabs] [data-tab=orders]").click();
    await owner.waitForURL(/tab=orders&period=today/);
    expect((await kpi("orders")) === "1", "1 order today");
  });

  await step("managers see analytics, call center agents do not", async () => {
    for (const [role, allowed] of [["manager", true], ["agent", false]]) {
      const { token } = await createSession({ shopId, role, email: `${role}8-${tag}@test.dz` });
      const ctx = await browser.newContext();
      await ctx.addCookies([{ name: "sc_session", value: token, url: BASE }]);
      const p = await ctx.newPage();
      await p.goto(section);
      if (allowed) await p.waitForSelector("[data-kpi=orders]");
      else await p.waitForURL((u) => !u.pathname.includes("analytics"));
      await ctx.close();
    }
  });

  await step("each shop sees only its own numbers", async () => {
    const p = await other.context.newPage();
    await p.goto(section);
    expect((await p.locator("[data-kpi=orders] [data-value]").innerText()).trim() === "1", "other shop: only its own order");
    await other.context.close();
  });

  await context.close();
}
