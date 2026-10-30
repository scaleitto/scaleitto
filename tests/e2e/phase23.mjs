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
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, cost_price, track_stock, stock, images, options, offers) VALUES (?, ?, 'مصباح', 'lamp', 3000, 1000, 1, 10, '[]', '[]', '[]')", [lamp, shopId]);
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

  await step("sidebar groups: Orders, Store design and Integrations show their sub-sections; renamed entries", async () => {
    await owner.goto(dash);
    const entries = await owner.locator("aside nav li[data-nav] > a, aside nav li[data-nav] > button").allInnerTexts();
    expect(entries.includes("المخزون") && entries.includes("المالية") && entries.includes("الربط والتطبيقات") && entries.includes("باقات الاشتراك"), `new entries (got ${entries.join(", ")})`);
    expect(!entries.includes("البكسل") && !entries.includes("الثيمات"), "pixels and themes are sub-sections now");
    // A group opens and closes; its sub-sections slide under it
    const group = owner.locator("aside li[data-nav=orders]");
    await group.locator(":scope > button").click();
    expect((await group.getAttribute("data-open")) === "true", "opened");
    await group.locator("a", { hasText: "قائمة الطلبات" }).click();
    await owner.waitForURL("**/dashboard/orders");
    const tabs = await owner.locator("[data-testid=section-tabs] a").allInnerTexts();
    expect(tabs.join("|") === "قائمة الطلبات|الإرسال لشركات الشحن|تتبع الطرود|المرتجعات|السلات المتروكة|الحماية", `orders tabs (got ${tabs.join("|")})`);
    expect((await group.locator("[data-testid=nav-children] a").count()) === 6, "sub-sections under Orders in the sidebar");
    await group.locator(":scope > button").click();
    expect((await group.getAttribute("data-open")) === "false", "closed again");
    // The order of the sidebar: daily work first
    const order = await owner.locator("aside nav li[data-nav]").evaluateAll((els) => els.map((li) => li.dataset.nav));
    expect(order.slice(0, 4).join() === "overview,orders,products,inventory", `logical order (got ${order.join()})`);
    await owner.goto(`${dash}/store-design`);
    expect((await owner.locator("[data-testid=section-tabs] a").allInnerTexts()).join("|") === "التصميم|الثيمات|فورم الطلب", "store design tabs");
    // Old addresses still work
    await owner.goto(`${dash}/pixels`);
    await owner.waitForURL("**/dashboard/integrations/pixels");
    expect((await owner.locator("[data-testid=section-tabs] a").allInnerTexts()).join("|") === "البكسل|التطبيقات", "integrations tabs");
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

  await step("inventory: an order takes stock (logged), a restock adds it, the alert threshold", async () => {
    const p = await browser.newPage();
    await p.goto(`${store}/p/lamp`);
    await p.fill("#name", "زبون المخزون");
    await p.fill("#phone", "0662 11 22 33");
    await p.selectOption("#wilaya", "16");
    await p.selectOption("#commune", "Kouba");
    await Promise.all([p.waitForURL(/\/thanks\?o=/), p.click("button[type=submit]")]);
    await p.close();
    await owner.goto(`${dash}/inventory`);
    const row = owner.locator('[data-stock="مصباح"]');
    expect((await row.locator("[data-qty]").getAttribute("data-qty")) === "9", "10 − 1 ordered");
    expect((await owner.locator("[data-card=value] [data-value]").innerText()).replace(/\s/g, "").includes("9000"), "9 × cost 1000");
    await row.locator("[data-testid=adjust-stock]").click();
    const form = owner.locator("[data-testid=adjust-form]");
    await owner.fill("#adjust-quantity", "5");
    expect((await form.locator("[data-testid=adjust-after]").innerText()).includes("14"), "result shown before saving");
    await owner.fill("#adjust-note", "وصول سلعة");
    await form.locator("button[type=submit]").click();
    await form.waitFor({ state: "detached" });
    await owner.locator('[data-stock="مصباح"] [data-qty="14"]').waitFor();
    await owner.locator("[data-testid=inventory-history-tab]").click();
    await owner.locator("[data-testid=movements] [data-movement=restock] [data-delta='5']").waitFor();
    expect(await owner.locator("[data-testid=movements] [data-movement=order] [data-delta='-1']").count(), "the order is in the history");
    await owner.goto(`${dash}/inventory`);
    await owner.fill("#lowStock", "20");
    await owner.locator("[data-testid=low-stock-form] button[type=submit]").click();
    await owner.locator('[data-stock="مصباح"]').getByText("قليل").waitFor();
    await owner.goto(dash);
    await owner.locator("[data-testid=low-stock-alert]").waitFor();
  });

  await step("returns: a returned parcel is received, another is sent again (back in Send to couriers)", async () => {
    const back = await order({ status: "shipped" });
    await parcel(back.id, "returning");
    const r1 = await order({ status: "returned" });
    await parcel(r1.id, "returned");
    const r2 = await order({ status: "returned" });
    await parcel(r2.id, "returned");
    await owner.goto(`${dash}/orders/returns`);
    const chips = owner.locator("[data-testid=order-chips]");
    expect((await chips.locator("[data-chip=back]").innerText()).includes("1") && (await chips.locator("[data-chip=pending]").innerText()).includes("2"), "on the way back / to receive");
    expect((await owner.locator("tr[data-order]").count()) === 3, "all three listed");
    await owner.locator(`tr[data-order="${r1.number}"] input[data-bulk-order]`).check();
    await owner.locator("[data-testid=return-receive]").click();
    await owner.locator("[data-testid=batch-report] [data-result=ok]").waitFor();
    const [[s1]] = await db.query("SELECT return_received_at AS at FROM shipments WHERE order_id = ?", [r1.id]);
    expect(s1.at !== null, "received");
    // A parcel still on its way back cannot be sent again
    owner.once("dialog", (d) => d.accept());
    await owner.locator(`tr[data-order="${back.number}"] input[data-bulk-order]`).check();
    await owner.locator(`tr[data-order="${r2.number}"] input[data-bulk-order]`).check();
    await owner.locator("[data-testid=return-resend]").click();
    const report = owner.locator("[data-testid=batch-report]");
    await report.locator("[data-result=failed]").waitFor();
    expect((await report.locator(`[data-number="${back.number}"]`).getAttribute("data-result")) === "failed", "not returned yet");
    const [[o2]] = await db.query("SELECT o.status, (SELECT COUNT(*) FROM shipments s WHERE s.order_id = o.id) AS parcels FROM orders o WHERE o.id = ?", [r2.id]);
    expect(o2.status === "confirmed" && o2.parcels === 0, "back to confirmed, ready to send again");
    await owner.goto(`${dash}/orders/shipping`);
    await owner.locator(`tr[data-order="${r2.number}"]`).waitFor();
  });

  await step("order analysis (now in Analytics): rates and couriers of the period", async () => {
    await order({ status: "delivered" });
    await owner.goto(`${dash}/orders/insights`);
    await owner.waitForURL(/\/dashboard\/analytics$/);
    await owner.locator("[data-testid=insight-kpis] [data-kpi=return]").waitFor();
    expect((await owner.locator("[data-kpi=return] [data-value]").innerText()).includes("%"), "return rate");
    await owner.locator('[data-testid=carriers] [data-row="Yalidine"]').waitFor();
  });

  await step("finance: money held by couriers marked as received, an expense, the net profit", async () => {
    const delivered = await order({ status: "delivered", total: 5400 });
    await owner.goto(`${dash}/finance`);
    const owed = owner.locator("[data-testid=owed]");
    await owed.locator(`[data-owed="${delivered.number}"]`).waitFor();
    await owed.locator(`[data-owed="${delivered.number}"] input[data-bulk-order]`).check();
    await owner.locator("[data-testid=mark-paid]").click();
    await owner.locator("[data-testid=batch-report] [data-result=ok]").waitFor();
    const [[paid]] = await db.query("SELECT paid_at FROM orders WHERE id = ?", [delivered.id]);
    expect(paid.paid_at !== null, "money received");
    await owner.goto(`${dash}/finance`);
    await owner.fill("#exp-amount", "2 000");
    await owner.fill("#exp-note", "إعلانات فيسبوك");
    await owner.locator("[data-testid=expense-form] button[type=submit]").click();
    await owner.locator("[data-testid=expense-list] [data-expense=ads]").waitFor();
    // Delivered products: 3000 + 5000; cost 2 × 1000; expenses 2000 → 4000
    const net = (await owner.locator("[data-kpi=net] [data-value]").innerText()).replace(/\s/g, "");
    expect(net.includes("4000"), `net profit (got ${net})`);
  });

  await step("order form template for one product: radio field, heading, two steps", async () => {
    await owner.goto(`${dash}/store-design/order-form`);
    await owner.click("[data-testid=new-template]");
    const dialog = owner.locator("[data-testid=template-dialog]");
    await owner.fill("#template-name", "نموذج المصابيح");
    await dialog.locator('input[data-product="مصباح"]').check();
    await dialog.locator("[data-testid=save-template]").click();
    await owner.waitForURL(/template=/);
    const [[tpl]] = await db.query("SELECT t.id FROM form_templates t JOIN products p ON p.form_template_id = t.id WHERE t.shop_id = ? AND p.id = ?", [shopId, lamp]);
    expect(Boolean(tpl), "template linked to the lamp");
    // A radio field, a heading block, two steps
    await owner.click("text=إضافة حقل");
    const field = owner.locator("[data-custom-field='0']");
    await field.locator('input[aria-label="اسم الحقل"]').fill("الحجم");
    await field.locator('select[aria-label="النوع"]').selectOption("radio");
    await field.locator('textarea[aria-label^="الخيارات"]').fill("صغير\nكبير");
    await owner.selectOption("[data-testid=block-kind]", "heading");
    await owner.click("[data-testid=add-block]");
    await owner.locator("[data-form-block='0'] input").fill("معلومات التوصيل");
    await owner.click("[data-testid=form-tab-settings]");
    await owner.check("[data-testid=form-stepper]");
    await owner.click("[data-testid=save-order-form]");
    await owner.waitForSelector("text=تم الحفظ");
    const [[row]] = await db.query("SELECT form FROM form_templates WHERE id = ?", [tpl.id]);
    const form = json(row.form);
    expect(form.stepper && form.custom[0].type === "radio" && form.blocks[0].text === "معلومات التوصيل", "template saved");

    // The lamp's page: two steps, the heading, the radio; the vase keeps the store's form
    const p = await browser.newPage();
    await p.goto(`${store}/p/lamp`);
    await p.locator("[data-testid=form-steps][data-step='1']").waitFor();
    expect(!(await p.locator("#wilaya").isVisible()), "wilaya waits for step 2");
    await p.click("[data-testid=form-next]");
    await p.getByText("اكتب اسمك الكامل").waitFor();
    await p.fill("#name", "زبون النموذج");
    await p.fill("#phone", "0663 44 55 66");
    await p.click("[data-testid=form-next]");
    await p.locator("[data-testid=form-steps][data-step='2']").waitFor();
    expect(await p.getByText("معلومات التوصيل").isVisible(), "heading block");
    await p.selectOption("#wilaya", "16");
    await p.selectOption("#commune", "Hydra");
    await p.locator("label", { hasText: "كبير" }).click();
    await Promise.all([p.waitForURL(/\/thanks\?o=/), p.click("button[type=submit]")]);
    const [[o]] = await db.query("SELECT extra FROM orders WHERE id = ?", [new URL(p.url()).searchParams.get("o")]);
    expect(JSON.stringify(json(o.extra)).includes("كبير"), "radio answer saved with the order");
    await p.goto(`${store}/p/vase`);
    await p.locator("#wilaya").waitFor();
    expect(!(await p.locator("[data-testid=form-steps]").count()), "the vase uses the store's form");
    await p.close();
  });

  await context.close();
}
