// Phase 28 (Zimam parity, phase 4): Delivery in three pages — companies (with "send confirmed orders automatically"),
// handover manifest (template, draft / publish, printing the selected parcels) and general settings (delivery on/off,
// options per type, the prices by wilaya) — and the store's prices following them.
import { randomUUID } from "node:crypto";
import { BASE, createShop, db, expect, step } from "./helpers.mjs";

export default async function phase28(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  const dash = `${BASE}/ar/dashboard`;
  const store = `${BASE}/store/shop-${tag}`;
  const lamp = randomUUID();
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'مصباح', 'lamp', 2000, '[]', '[]', '[]')", [lamp, shopId]);
  await db.query("INSERT INTO shipping_rates (shop_id, wilaya_code, home_price, office_price) VALUES (?, 16, 500, 300), (?, 31, 700, NULL)", [shopId, shopId]);
  const storeTotal = async (wilaya, type = "home") => {
    const p = await browser.newPage();
    await p.goto(`${store}/p/lamp`);
    await p.selectOption("#wilaya", String(wilaya));
    if (type === "office") await p.locator('input[value="office"]').check({ force: true });
    const total = (await p.locator("[data-testid=total]").innerText()).replace(/\s/g, "");
    const office = await p.locator('input[value="office"]').isDisabled();
    await p.close();
    return { total, office };
  };
  let number = 7000;
  const order = async (status, accountId = null) => {
    const id = randomUUID();
    number++;
    await db.query(
      "INSERT INTO orders (id, shop_id, number, customer_name, phone, wilaya_code, commune, delivery_type, subtotal, shipping_price, total, status, carrier_account_id) VALUES (?, ?, ?, 'زبون', '0661000000', 16, 'Kouba', 'home', 2000, 400, 2400, ?, ?)",
      [id, shopId, number, status, accountId],
    );
    await db.query("INSERT INTO order_items (id, shop_id, order_id, product_id, name, quantity, unit_price, total) VALUES (?, ?, ?, ?, 'مصباح', 1, 2000, 2000)", [randomUUID(), shopId, id, lamp]);
    return { id, number };
  };

  await step("Delivery has three pages: companies, handover manifest, settings", async () => {
    await owner.goto(`${dash}/delivery/settings`);
    const tabs = await owner.locator("[data-testid=section-tabs] a").allInnerTexts();
    expect(tabs.join("|") === "إعدادات التوصيل|شركات التوصيل|وصل التسليم", `tabs (got ${tabs.join("|")})`);
    await owner.goto(`${dash}/delivery/rates`);
    await owner.waitForURL("**/delivery/settings");
  });

  await step("methods: the older wilaya table is kept as a method; a preferred home method at one price; the store follows", async () => {
    await owner.waitForSelector("[data-testid=legacy-option]");
    await owner.click("[data-testid=add-delivery-option]");
    await owner.click("[data-testid=save-option]");
    await owner.getByText("اكتب اسم الطريقة").waitFor();
    await owner.fill("[data-testid=option-name]", "توصيل سريع");
    await owner.click("[data-testid=pricing-flat]");
    await owner.fill("[data-testid=flat-home]", "450");
    await owner.locator("label:has([data-testid=option-default])").click();
    await owner.click("[data-testid=save-option]");
    await owner.waitForSelector("[data-testid=delivery-saved]");
    const [[s]] = await db.query("SELECT delivery FROM shops WHERE id = ?", [shopId]);
    const d = typeof s.delivery === "string" ? JSON.parse(s.delivery) : s.delivery;
    expect(d.options.map((o) => `${o.type}:${o.pricing}:${o.home}:${o.isDefault}`).join() === "both:wilaya:0:false,home:flat:450:true", `saved (got ${JSON.stringify(d.options)})`);
    expect(d.options[0].rates[16].office === 300 && d.options[0].rates[31].office === null, "the table became the first method's prices");
    const oran = await storeTotal(31);
    expect(oran.total.includes("2450") && oran.office, `Oran: 2000 + 450 at home, no desk (got ${oran.total})`);
    const algiers = await storeTotal(16, "office");
    expect(algiers.total.includes("2300"), `Algiers desk from the wilaya method: 2000 + 300 (got ${algiers.total})`);
    expect((await owner.locator("[data-option] [data-testid=option-summary]").allInnerTexts()).length === 2, "two method cards");
  });

  await step("delivery off: no fee anywhere", async () => {
    await owner.locator("label:has([data-testid=delivery-enabled])").click();
    await expectSoon(async () => {
      const [[s]] = await db.query("SELECT delivery FROM shops WHERE id = ?", [shopId]);
      return (typeof s.delivery === "string" ? JSON.parse(s.delivery) : s.delivery).enabled === false;
    });
    const algiers = await storeTotal(16);
    expect(algiers.total.includes("2000") && !algiers.total.includes("2450"), `free delivery (got ${algiers.total})`);
    await owner.locator("label:has([data-testid=delivery-enabled])").click();
    await expectSoon(async () => {
      const [[s]] = await db.query("SELECT delivery FROM shops WHERE id = ?", [shopId]);
      return (typeof s.delivery === "string" ? JSON.parse(s.delivery) : s.delivery).enabled === true;
    });
  });

  await step("companies: automatic send of confirmed orders that have a delivery company", async () => {
    await owner.goto(`${dash}/delivery`);
    await owner.click('[data-carrier="yalidine"] button:has-text("ربط")');
    await owner.fill("#yalidine-apiId", "good-id");
    await owner.fill("#yalidine-apiToken", "good-token");
    await owner.locator('[data-connect="yalidine"] button[type=submit]').click();
    await owner.waitForSelector('[data-account="yalidine"]');
    await owner.locator("label:has([data-testid=auto-send-switch])").click();
    await owner.locator("[data-testid=auto-send][data-state=on]").waitFor();
    await expectSoon(async () => {
      const [[s]] = await db.query("SELECT delivery FROM shops WHERE id = ?", [shopId]);
      return (typeof s.delivery === "string" ? JSON.parse(s.delivery) : s.delivery)?.autoSend === true;
    });
    const [[account]] = await db.query("SELECT id FROM carrier_accounts WHERE shop_id = ?", [shopId]);
    const withCompany = await order("pending", account.id);
    const without = await order("pending");
    for (const o of [withCompany, without]) {
      await owner.goto(`${dash}/orders/${o.id}`);
      await owner.locator("[data-testid=order-form] #status").selectOption("confirmed");
      await owner.click("[data-testid=save-order]");
      await owner.locator("[data-testid=edit-order-dialog]").waitFor({ state: "detached" });
    }
    await expectSoon(async () => (await db.query("SELECT status FROM orders WHERE id = ?", [withCompany.id]))[0][0].status === "in_transit");
    const [[parcel]] = await db.query("SELECT tracking_number FROM shipments WHERE order_id = ?", [withCompany.id]);
    expect(parcel?.tracking_number?.startsWith("yal-"), "sent to Yalidine");
    expect((await db.query("SELECT status FROM orders WHERE id = ?", [without.id]))[0][0].status === "confirmed", "an order without a company stays confirmed");
  });

  await step("manifest: draft, preview, publish; the selected parcels print with it", async () => {
    await owner.goto(`${dash}/delivery/manifest`);
    const editor = owner.locator("[data-testid=manifest-editor]");
    expect((await editor.getAttribute("data-state")) === "default", "default manifest");
    await editor.locator("[data-field=items]").check();
    await owner.fill("#m-header", "مستودع باب الزوار");
    await owner.selectOption("#m-language", "fr");
    expect((await owner.locator("[data-testid=manifest]").getAttribute("lang")) === "fr", "preview in French");
    await owner.locator("[data-testid=manifest]").getByText("Articles").waitFor();
    await owner.click("[data-testid=manifest-draft]");
    await owner.locator("[data-testid=manifest-editor][data-state=draft]").waitFor();
    let [[s]] = await db.query("SELECT manifest FROM shops WHERE id = ?", [shopId]);
    let m = typeof s.manifest === "string" ? JSON.parse(s.manifest) : s.manifest;
    expect(m.draft.header === "مستودع باب الزوار" && m.published === null, "draft only");
    await owner.click("[data-testid=manifest-publish]");
    await owner.locator("[data-testid=manifest-editor][data-state=published]").waitFor();
    [[s]] = await db.query("SELECT manifest FROM shops WHERE id = ?", [shopId]);
    m = typeof s.manifest === "string" ? JSON.parse(s.manifest) : s.manifest;
    expect(m.published.language === "fr" && m.published.show.items === true, "published");
    // Print from the orders page: the in-transit parcel
    await owner.goto(`${dash}/orders?status=in_transit`);
    await owner.locator("[data-testid=select-all]").click();
    const [popup] = await Promise.all([owner.waitForEvent("popup"), owner.click("[data-testid=print-manifest]")]);
    await popup.locator("[data-testid=manifest]").waitFor();
    expect((await popup.locator("[data-testid=manifest-count]").innerText()).includes("1"), "one parcel");
    expect((await popup.locator("[data-testid=manifest]").innerText()).includes("مستودع باب الزوار") && (await popup.locator("[data-testid=manifest] [data-row]").innerText()).includes("مصباح × 1"), "published header and item lines");
    await popup.close();
  });

  await context.close();
}

async function expectSoon(check, tries = 40) {
  for (let i = 0; i < tries; i++) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  expect(false, "condition reached in time");
}
