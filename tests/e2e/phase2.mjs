// Phase 2: storefront ordering (cash on delivery), fake-order protection, abandoned carts,
// and the merchant's order management (status, stock, edits, notes, blocking, roles, isolation).
import { randomUUID } from "node:crypto";
import { BASE, createSession, createShop, db, expect, step } from "./helpers.mjs";

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

  await step("typing a phone saves an abandoned cart, shown to the merchant", async () => {
    await customer.fill("#name", "كريم بن علي");
    await customer.fill("#phone", "0555 12 34 56");
    await customer.locator("#phone").blur();
    let lead;
    for (let i = 0; i < 20 && !lead; i++) {
      [[lead]] = await db.query("SELECT * FROM leads WHERE shop_id = ?", [shopId]);
      if (!lead) await customer.waitForTimeout(150);
    }
    expect(lead && lead.phone === "0555123456" && lead.name === "كريم بن علي", "lead saved with the normalized phone");
    await owner.goto(`${orders}/abandoned`);
    await owner.waitForSelector('[data-lead="0555123456"]');
    await owner.click('[data-lead="0555123456"] button[aria-label="تم الاتصال"]');
    await owner.locator('[data-lead="0555123456"]').getByText("تم الاتصال").filter({ visible: true }).waitFor();
  });

  await step("customer orders 2 pieces with the offer and wilaya delivery price", async () => {
    await customer.click("text=2 قطعة");
    await customer.selectOption("#wilaya", "31");
    expect(await customer.locator('input[value="office"]').isDisabled(), "office delivery unavailable in wilaya 31");
    await customer.selectOption("#commune", "بئر الجير");
    expect((await customer.locator("[data-testid=total]").innerText()).replace(/\s/g, "").includes("9200"), "total = 8500 + 700");
    await Promise.all([customer.waitForURL(/\/thanks\?o=/), customer.click("button[type=submit]")]);
    expect((await customer.locator("[data-testid=order-number]").innerText()) === "#1001", "first order is #1001");
    orderId = new URL(customer.url()).searchParams.get("o");
    const [[order]] = await db.query("SELECT * FROM orders WHERE id = ?", [orderId]);
    expect(order.total === 9200 && order.shipping_price === 700 && order.subtotal === 8500 && order.status === "new", "order totals saved");
    expect((await stockOf(black)) === 8, "stock taken (10 → 8)");
    const [[lead]] = await db.query("SELECT status, order_id FROM leads WHERE shop_id = ?", [shopId]);
    expect(lead.status === "converted" && lead.order_id === orderId, "abandoned cart converted");
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

  await step("merchant sees the order, filters by status and finds it by phone", async () => {
    await owner.goto(orders);
    await owner.waitForSelector('[data-order="1001"]');
    expect((await owner.locator('[data-order="1001"]').innerText()).includes("جديد"), "status new");
    await owner.goto(`${orders}?status=confirmed`);
    expect(!(await owner.locator('[data-order="1001"]').count()), "not in confirmed");
    await owner.goto(`${orders}?q=555 12`);
    await owner.waitForSelector('[data-order="1001"]');
  });

  await step("cancelling returns the stock, reconfirming takes it again, history records it", async () => {
    await owner.goto(`${orders}/${orderId}`);
    await owner.waitForSelector("text=طلب #1001");
    await owner.click('[data-testid=status-picker] button:has-text("ملغى")');
    await owner.waitForSelector('[data-testid=history] >> text=تغيير الحالة: جديد ← ملغى');
    expect((await stockOf(black)) === 10, "stock back to 10");
    await owner.click('[data-testid=status-picker] button:has-text("مؤكد")');
    await owner.waitForSelector('[data-testid=history] >> text=تغيير الحالة: ملغى ← مؤكد');
    expect((await stockOf(black)) === 8, "stock taken again");
    expect(await owner.locator('[data-testid=history] >> text=Owner').count(), "history shows who changed it");
  });

  await step("editing the customer's details recomputes the total", async () => {
    await owner.click("text=تعديل المعلومات");
    await owner.selectOption("#commune", "السانية");
    await owner.fill("#shippingPrice", "500");
    await owner.locator("form:has(#commune) button[type=submit]").click();
    await owner.waitForSelector("text=تم الحفظ");
    expect((await owner.locator("[data-testid=order-total]").innerText()).replace(/\s/g, "").includes("9000"), "total = 8500 + 500");
    const [[order]] = await db.query("SELECT commune, total FROM orders WHERE id = ?", [orderId]);
    expect(order.commune === "Es Senia" && order.total === 9000, "saved");
  });

  await step("notes are added to the history and the box is cleared", async () => {
    await owner.fill('textarea[name="note"]', "اتصل بعد الساعة 6 مساءً");
    await owner.click('button:has-text("إضافة ملاحظة")');
    await owner.waitForSelector("[data-testid=history] >> text=اتصل بعد الساعة 6 مساءً");
    expect((await owner.inputValue('textarea[name="note"]')) === "", "note box cleared");
  });

  await step("a blocked phone cannot order; unblocking allows it again", async () => {
    await owner.click('button:has-text("حظر الرقم")');
    await owner.waitForSelector("text=هذا الرقم محظور");
    await customer.goto(`${store}/p/watch`);
    await customer.fill("#name", "كريم بن علي");
    await customer.fill("#phone", "0555123456");
    await customer.selectOption("#wilaya", "16");
    await customer.selectOption("#commune", "باب الزوار");
    await customer.click("button[type=submit]");
    await customer.waitForSelector("text=تعذر تسجيل الطلب");
    await owner.click('button:has-text("إلغاء الحظر")');
    await owner.waitForSelector('button:has-text("حظر الرقم")');
  });

  await step("a call center agent can open and update orders", async () => {
    const agent = await createSession({ shopId, role: "agent", email: `agent-p2-${Date.now()}@test.dz` });
    // Agents only see the orders assigned to them
    await db.query("UPDATE orders SET assigned_to = ?, assigned_at = NOW() WHERE id = ?", [agent.userId, orderId]);
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "sc_session", value: agent.token, url: BASE }]);
    const p = await ctx.newPage();
    await p.goto(`${orders}/${orderId}`);
    await p.click('[data-testid=status-picker] button:has-text("إعادة الاتصال")');
    await p.waitForSelector("[data-testid=history] >> text=Test agent");
    await ctx.close();
  });

  await step("another shop cannot see this order", async () => {
    const other = await createShop(browser);
    const p = await other.context.newPage();
    await p.goto(`${orders}/${orderId}`);
    await p.waitForSelector("[data-testid=not-found]");
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
