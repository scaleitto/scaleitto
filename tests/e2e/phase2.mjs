// Phase 2: storefront ordering (cash on delivery), fake-order protection, abandoned carts,
// and the merchant's order management (status, stock, edits, notes, blocking, roles, isolation).
import { randomUUID } from "node:crypto";
import { BASE, createSession, createShop, db, expect, step, setOrderStatus, openOrder, orderEvents } from "./helpers.mjs";

export default async function phase2(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  owner.on("dialog", (d) => d.accept());
  const store = `${BASE}/store/shop-${tag}`;
  const orders = `${BASE}/ar/dashboard/orders`;

  // A product with two colors (one sold out), two quantity offers and stock tracking
  const productId = randomUUID();
  const black = randomUUID();
  const brown = randomUUID();
  await db.query(
    "INSERT INTO products (id, shop_id, name, slug, description, price, compare_at_price, track_stock, stock, images, options, offers) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, '[]', ?, ?)",
    [productId, shopId, "ساعة كلاسيكية", "watch", "ساعة أنيقة", 4500, 6000, JSON.stringify([{ name: "اللون", values: ["أسود", "بني"] }]), JSON.stringify([{ quantity: 2, price: 8500, label: "الأكثر طلباً" }])],
  );
  await db.query("INSERT INTO product_variants (id, product_id, shop_id, option_values, title, stock, position) VALUES (?, ?, ?, ?, 'أسود', 10, 0), (?, ?, ?, ?, 'بني', 0, 1)", [
    black, productId, shopId, JSON.stringify({ اللون: "أسود" }), brown, productId, shopId, JSON.stringify({ اللون: "بني" }),
  ]);
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, status, images, options, offers) VALUES (?, ?, 'مسودة مخفية', 'hidden', 100, 'draft', '[]', '[]', '[]')", [randomUUID(), shopId]);
  await db.query("INSERT INTO shipping_rates (shop_id, wilaya_code, home_price, office_price) VALUES (?, 16, 400, 300), (?, 31, 700, NULL)", [shopId, shopId]);
  const stockOf = async (id) => (await db.query("SELECT stock FROM product_variants WHERE id = ?", [id]))[0][0].stock;

  const customer = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let orderId;
  let orderNumber;

  await step("store home lists active products only", async () => {
    await customer.goto(store);
    await customer.waitForSelector("text=ساعة كلاسيكية");
    expect(!(await customer.locator("text=مسودة مخفية").count()), "draft product hidden");
    // The not-found page can arrive streamed after the first bytes: wait for it
    await customer.goto(`${store}/p/hidden`);
    await customer.waitForSelector("[data-testid=not-found]");
  });

  await step("order form: field errors in the shop language, sold-out color disabled", async () => {
    await customer.goto(`${store}/p/watch`);
    expect(await customer.locator('button:has-text("بني")').isDisabled(), "sold-out color disabled");
    await customer.click("button[type=submit]");
    await customer.waitForSelector("text=رقم هاتف غير صحيح");
    expect(await customer.locator("text=اختر الولاية >> nth=1").count(), "wilaya error shown");
    expect(!(await customer.locator('input[name="website"]').isVisible()), "honeypot hidden");
  });

  await step("typing a phone saves an abandoned order, shown in the Abandoned tab", async () => {
    await customer.fill("#name", "كريم بن علي");
    await customer.fill("#phone", "0555 12 34 56");
    await customer.locator("#phone").blur();
    let lead;
    for (let i = 0; i < 20 && !lead; i++) {
      [[lead]] = await db.query("SELECT * FROM orders WHERE shop_id = ? AND status = 'abandoned'", [shopId]);
      if (!lead) await customer.waitForTimeout(150);
    }
    expect(lead && lead.phone === "0555123456" && lead.customer_name === "كريم بن علي", "abandoned order saved with the normalized phone");
    await owner.goto(`${orders}?status=abandoned`);
    await owner.waitForSelector(`[data-order="${lead.number}"][data-status=abandoned]`);
  });

  await step("customer orders 2 pieces with the offer and wilaya delivery price", async () => {
    await customer.click("text=2 قطعة");
    await customer.selectOption("#wilaya", "31");
    expect(await customer.locator('input[value="office"]').isDisabled(), "office delivery unavailable in wilaya 31");
    await customer.selectOption("#commune", "بئر الجير");
    expect((await customer.locator("[data-testid=total]").innerText()).replace(/\s/g, "").includes("9200"), "total = 8500 + 700");
    await Promise.all([customer.waitForURL(/\/thanks\?o=/), customer.click("button[type=submit]")]);
    orderId = new URL(customer.url()).searchParams.get("o");
    const [[order]] = await db.query("SELECT * FROM orders WHERE id = ?", [orderId]);
    expect(order.total === 9200 && order.shipping_price === 700 && order.subtotal === 8500 && order.status === "pending", "order totals saved");
    expect(order.number === 1001 && (await customer.locator("[data-testid=order-number]").innerText()) === "#1001", "the abandoned checkout gives its number: #1001");
    orderNumber = order.number;
    expect((await stockOf(black)) === 8, "stock taken (10 → 8)");
    const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM orders WHERE shop_id = ? AND status = 'abandoned'", [shopId]);
    expect(n === 0, "the abandoned order is dropped once the real one is placed");
  });

  await step("the same phone ordering the same product again is a duplicate", async () => {
    await customer.goto(`${store}/p/watch`);
    await customer.fill("#name", "كريم بن علي");
    await customer.fill("#phone", "0555123456");
    await customer.selectOption("#wilaya", "16");
    await customer.selectOption("#commune", "باب الزوار");
    await customer.click("button[type=submit]");
    await customer.waitForSelector("text=طلبك لهذا المنتج مسجل مسبقاً");
  });

  await step("merchant sees the order in Pending, not in Confirmed, and finds it by phone", async () => {
    await owner.goto(orders);
    await owner.waitForSelector(`[data-order="${orderNumber}"][data-status=pending]`);
    expect((await owner.locator('[data-testid=status-tabs] [data-tab=pending] [data-count]').innerText()) === "1", "pending tab counts it");
    await owner.goto(`${orders}?status=confirmed`);
    expect(!(await owner.locator(`[data-order="${orderNumber}"]`).count()), "not in confirmed");
    await owner.goto(`${orders}?q=555 12`);
    await owner.waitForSelector(`[data-order="${orderNumber}"]`);
  });

  await step("cancelling returns the stock, reconfirming takes it again, history records it", async () => {
    await owner.goto(`${orders}/${orderId}`);
    await owner.waitForSelector(`text=تعديل الطلب #${orderNumber}`);
    await setOrderStatus(owner, "cancelled");
    expect((await stockOf(black)) === 10, "stock back to 10");
    await setOrderStatus(owner, "confirmed");
    expect((await stockOf(black)) === 8, "stock taken again");
    const events = await orderEvents(orderId);
    expect(events.includes("status:pending>cancelled") && events.includes("status:cancelled>confirmed"), `history records it (${events})`);
    const [[who]] = await db.query("SELECT u.name FROM order_events e JOIN users u ON u.id = e.user_id WHERE e.order_id = ? AND e.type = 'status' ORDER BY e.created_at DESC LIMIT 1", [orderId]);
    expect(who?.name === "Owner", "history records who changed it");
  });

  await step("editing the order: commune, total and note are saved", async () => {
    await owner.selectOption("#commune", "Es Senia");
    await owner.fill("[data-testid=order-total-input]", "9000");
    await owner.fill("[data-testid=edit-order-dialog] input[name=note]", "اتصل بعد الساعة 6 مساءً");
    await owner.click("[data-testid=save-order]");
    await owner.locator("[data-testid=edit-order-dialog]").waitFor({ state: "detached" });
    let order;
    for (let i = 0; i < 40 && order?.note !== "اتصل بعد الساعة 6 مساءً"; i++) {
      if (i) await owner.waitForTimeout(150);
      [[order]] = await db.query("SELECT commune, total, note FROM orders WHERE id = ?", [orderId]);
    }
    expect(order.commune === "Es Senia" && order.total === 9000 && order.note === "اتصل بعد الساعة 6 مساءً", `saved (got ${JSON.stringify(order)})`);
  });

  await step("a blocked customer cannot order; unblocking allows it again", async () => {
    await openOrder(owner, orderId);
    await owner.click("[data-testid=block-customer]");
    await owner.waitForSelector('[data-testid=block-customer]:has-text("إلغاء الحظر")');
    await customer.goto(`${store}/p/watch`);
    await customer.fill("#name", "كريم بن علي");
    await customer.fill("#phone", "0555123456");
    await customer.selectOption("#wilaya", "16");
    await customer.selectOption("#commune", "باب الزوار");
    await customer.click("button[type=submit]");
    await customer.waitForSelector("text=تعذر تسجيل الطلب");
    await owner.click("[data-testid=block-customer]");
    await owner.waitForSelector('[data-testid=block-customer]:has-text("حظر الزبون")');
  });

  await step("a call center agent can open and update orders", async () => {
    const agent = await createSession({ shopId, role: "agent", email: `agent-p2-${Date.now()}@test.dz` });
    // Agents only see the orders assigned to them
    await db.query("UPDATE orders SET assigned_to = ?, assigned_at = NOW() WHERE id = ?", [agent.userId, orderId]);
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "sc_session", value: agent.token, url: BASE }]);
    const p = await ctx.newPage();
    await p.goto(`${orders}/${orderId}`);
    await p.locator("[data-testid=edit-order-dialog] [data-testid=order-form]").waitFor();
    await setOrderStatus(p, "call_back");
    const [[who]] = await db.query("SELECT u.name FROM order_events e JOIN users u ON u.id = e.user_id WHERE e.order_id = ? AND e.type = 'status' ORDER BY e.created_at DESC LIMIT 1", [orderId]);
    expect(who?.name === "Test agent", "history records the agent");
    await ctx.close();
  });

  await step("another shop cannot see this order", async () => {
    const other = await createShop(browser);
    const p = await other.context.newPage();
    await p.goto(`${orders}/${orderId}`);
    await p.waitForURL((u) => u.searchParams.has("edit"));
    await p.locator("[data-testid=status-tabs]").waitFor();
    expect(!(await p.locator("[data-testid=edit-order-dialog]").count()), "the order does not open");
    expect(!(await p.locator("text=كريم").count()), "no customer data shown");
    await other.context.close();
  });

  await step("French store shows French strings and LTR", async () => {
    await db.query("UPDATE shops SET default_locale = 'fr' WHERE id = ?", [shopId]);
    await customer.goto(`${store}/p/watch`);
    await customer.waitForSelector("text=Paiement à la livraison");
    expect((await customer.locator("[lang=fr]").first().getAttribute("dir")) === "ltr", "LTR");
    await db.query("UPDATE shops SET default_locale = 'ar' WHERE id = ?", [shopId]);
  });

  await customer.close();
  await context.close();
}
