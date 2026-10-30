// Phase 8: analytics — KPIs, previous-period comparison, charts, funnel, tables, periods,
// custom range, roles and tenant isolation.
import { randomUUID } from "node:crypto";
import { BASE, createSession, createShop, db, expect, step } from "./helpers.mjs";

export default async function phase8(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  const section = `${BASE}/ar/dashboard/analytics`;
  const DAY = 86400_000;
  const ago = (days, minutes = 0) => new Date(Date.now() - days * DAY - minutes * 60_000);

  await step("no orders: a clear empty state", async () => {
    await owner.goto(section);
    await owner.waitForSelector("text=لا توجد طلبات في هذه الفترة");
  });

  // A product with a cost price, a landing page, and orders spread over the last weeks
  const productId = randomUUID();
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, cost_price, images, options, offers) VALUES (?, ?, 'حذاء رياضي', 'shoe', 4000, 1500, '[]', '[]', '[]')", [productId, shopId]);
  const pageId = randomUUID();
  await db.query("INSERT INTO landing_pages (id, shop_id, product_id, slug, title, sections) VALUES (?, ?, ?, 'shoe-lp', 'صفحة الحذاء', '[]')", [pageId, shopId, productId]);
  let number = 1000;
  const addOrder = async ({ when, status, wilaya = 16, landing = null, quantity = 1 }) => {
    const id = randomUUID();
    const subtotal = 4000 * quantity;
    await db.query(
      "INSERT INTO orders (id, shop_id, number, status, customer_name, phone, wilaya_code, commune, delivery_type, subtotal, shipping_price, total, landing_page_id, created_at) VALUES (?, ?, ?, ?, 'زبون', '0661000000', ?, 'x', 'home', ?, 500, ?, ?, ?)",
      [id, shopId, ++number, status, wilaya, subtotal, subtotal + 500, landing, when],
    );
    await db.query("INSERT INTO order_items (id, order_id, shop_id, product_id, name, unit_price, quantity, total) VALUES (UUID(), ?, ?, ?, 'حذاء رياضي', 4000, ?, ?)", [id, shopId, productId, quantity, subtotal]);
    return id;
  };
  // An abandoned checkout the team turned into an order (recovered), and one still abandoned
  const recovered = await addOrder({ when: ago(0, 5), status: "pending" });
  await db.query("INSERT INTO order_events (id, order_id, shop_id, type, to_status, created_at) VALUES (UUID(), ?, ?, 'created', 'abandoned', ?)", [recovered, shopId, ago(0, 5)]);
  const left = await addOrder({ when: ago(1), status: "abandoned" });
  await db.query("INSERT INTO order_events (id, order_id, shop_id, type, to_status, created_at) VALUES (UUID(), ?, ?, 'created', 'abandoned', ?)", [left, shopId, ago(1)]);
  await addOrder({ when: ago(2), status: "delivered", quantity: 2 });
  await addOrder({ when: ago(3), status: "delivered", wilaya: 31, landing: pageId });
  await addOrder({ when: ago(3), status: "returned", wilaya: 31, landing: pageId });
  await addOrder({ when: ago(5), status: "in_transit" });
  await addOrder({ when: ago(10), status: "cancelled", wilaya: 31 });
  await addOrder({ when: ago(40), status: "delivered" }); // previous period of "30 days"

  // Another shop's orders must never be counted
  const other = await createShop(browser);
  await db.query("INSERT INTO orders (id, shop_id, number, status, customer_name, phone, wilaya_code, commune, delivery_type, subtotal, shipping_price, total) VALUES (UUID(), ?, 1001, 'delivered', 'x', '0661000000', 16, 'x', 'home', 99999, 0, 99999)", [other.shopId]);

  const kpi = async (id) => (await owner.locator(`[data-kpi=${id}] [data-value]`).innerText()).replace(/\s/g, "");

  await step("last 30 days: KPIs, comparison with the previous period", async () => {
    await owner.goto(section);
    await owner.waitForSelector("[data-kpi=orders]");
    expect((await kpi("orders")) === "6", "6 orders in 30 days");
    expect((await kpi("confirmation")) === "80%", `confirmation 4 ÷ (4 + 1 cancelled) = 80% (got ${await kpi("confirmation")})`);
    expect((await kpi("delivery")) === "66.7%", `delivery 2 ÷ 3 = 66.7% (got ${await kpi("delivery")})`);
    expect((await kpi("revenue")).includes("13000"), `delivered sales 8500 + 4500 (got ${await kpi("revenue")})`);
    expect((await kpi("profit")).includes("7500"), `profit (8000 − 3000) + (4000 − 1500) (got ${await kpi("profit")})`);
    expect((await kpi("recovered")) === "50%", "1 of 2 abandoned carts recovered");
    expect((await owner.locator("[data-kpi=orders]").innerText()).includes("+500%"), "orders vs previous period (6 vs 1)");
    expect((await owner.locator("[data-kpi=delivery] [data-delta]").innerText()).includes("-33.3"), "delivery rate change in points (66.7 vs 100)");
  });

  await step("daily chart, funnel, statuses, products, wilayas and sources", async () => {
    expect((await owner.locator("[data-testid=daily-chart] [data-bar]").count()) === 30, "one bar per day");
    const total = await owner.locator("[data-testid=daily-chart] [data-bar]").evaluateAll((bars) => bars.reduce((s, b) => s + Number(b.dataset.value), 0));
    expect(total === 6, "bars add up to the orders");
    await owner.locator("[data-testid=daily-chart] [data-bar]").last().hover();
    expect(await owner.locator("[data-testid=daily-chart] [data-bar]").last().locator("text=الطلبات: 1").isVisible(), "hover tooltip shows the day's orders");
    const product = await owner.locator(`[data-testid=top-products] [data-row="${productId}"]`).innerText();
    expect(product.includes("حذاء رياضي") && product.includes("6"), `pieces sold, cancelled left out (got ${product})`);
    expect((await owner.locator(`[data-testid=sources] [data-row="${pageId}"]`).innerText()).includes("صفحة الحذاء"), "landing page named in sources");
    expect((await owner.locator("[data-testid=hourly-chart] [data-bar]").count()) === 24, "24 hours");
    // What happens to the orders is on the same page (the Order analysis sub-section was merged here)
    expect((await owner.locator("[data-testid=funnel] [data-step=delivered]").innerText()).includes("2"), "funnel delivered = 2");
    expect((await owner.locator("[data-testid=statuses] [data-status=delivered]").innerText()).includes("2"), "2 delivered in statuses");
    const oran = await owner.locator('[data-testid=wilayas] [data-row="31"]').innerText();
    expect(oran.includes("3") && oran.includes("50%"), `wilaya 31: 3 orders, 50% delivered (got ${oran})`);
    // The orders' KPIs do not repeat the sales ones (orders, confirmation, delivery)
    expect((await owner.locator("[data-kpi=confirmation]").count()) === 1 && (await owner.locator("[data-testid=insight-kpis] [data-kpi=refusal]").count()) === 1, "no repeated KPIs");
  });

  await step("today, 7 days and a custom range", async () => {
    await owner.locator("[data-testid=period-bar] a", { hasText: "اليوم" }).click();
    await owner.waitForURL(/period=today/);
    expect((await kpi("orders")) === "1", "1 order today");
    await owner.locator("[data-testid=period-bar] a", { hasText: "7 أيام" }).click();
    await owner.waitForURL(/period=7d/);
    expect((await kpi("orders")) === "5", "5 orders in 7 days");
    const day = (d) => new Date(Date.now() + 3600_000 - d * DAY).toISOString().slice(0, 10);
    await owner.fill("[data-testid=period-bar] input[name=from]", day(45));
    await owner.fill("[data-testid=period-bar] input[name=to]", day(35));
    await Promise.all([owner.waitForURL(/period=custom/), owner.locator("[data-testid=period-bar] button[type=submit]").click()]);
    expect((await kpi("orders")) === "1", "1 order between 45 and 35 days ago");
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
    await p.waitForSelector("[data-kpi=orders]");
    expect((await p.locator("[data-kpi=orders] [data-value]").innerText()).trim() === "1", "other shop: only its own order");
    await other.context.close();
  });

  await context.close();
}
