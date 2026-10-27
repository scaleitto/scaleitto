// Phase 3: delivery — prices per wilaya, connecting delivery companies (checked keys, encrypted),
// sending confirmed orders, tracking updates that close the order, manual tracking numbers.
import { randomUUID } from "node:crypto";
import { BASE, createSession, createShop, db, expect, step } from "./helpers.mjs";
import { received, setParcelStatus } from "./mock-carriers.mjs";

export default async function phase3(browser) {
  if (!process.env.E2E_CARRIER_URL) throw new Error("E2E_CARRIER_URL must point to the fake delivery server");
  const { shopId, context, tag } = await createShop(browser);
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  const delivery = `${BASE}/ar/dashboard/delivery`;
  const orders = `${BASE}/ar/dashboard/orders`;
  const store = `${BASE}/store/shop-${tag}`;

  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'عطر فاخر', 'perfume', 3000, '[]', '[]', '[]')", [randomUUID(), shopId]);

  async function placeOrder(name, phone, wilaya, commune) {
    const p = await browser.newPage();
    await p.goto(`${store}/p/perfume`);
    await p.fill("#name", name);
    await p.fill("#phone", phone);
    await p.selectOption("#wilaya", String(wilaya));
    await p.fill("#commune", commune);
    await Promise.all([p.waitForURL(/thanks\?o=/), p.click("button[type=submit]")]);
    const id = new URL(p.url()).searchParams.get("o");
    await p.close();
    return id;
  }

  await step("delivery prices: apply to all, adjust one wilaya, used by the store", async () => {
    await page.goto(`${delivery}/rates`);
    await page.fill('[aria-label="تطبيق على كل الولايات إلى المنزل"]', "600");
    await page.fill('[aria-label="تطبيق على كل الولايات إلى المكتب"]', "400");
    await page.click('button:has-text("تطبيق على كل الولايات")');
    await page.fill('[aria-label="إلى المنزل 16 - الجزائر"]', "300");
    await page.fill('[aria-label="إلى المكتب 31 - وهران"]', "");
    await page.locator("button[type=submit]").click();
    await page.waitForSelector("text=تم الحفظ");
    const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM shipping_rates WHERE shop_id = ?", [shopId]);
    expect(Number(n) === 58, `58 wilayas saved (got ${n})`);
    const [[oran]] = await db.query("SELECT home_price, office_price FROM shipping_rates WHERE shop_id = ? AND wilaya_code = 31", [shopId]);
    expect(oran.home_price === 600 && oran.office_price === null, "Oran: home 600, no office");
    const c = await browser.newPage();
    await c.goto(`${store}/p/perfume`);
    await c.selectOption("#wilaya", "16");
    expect((await c.locator("[data-testid=total]").innerText()).replace(/\s/g, "").includes("3300"), "store total = 3000 + 300");
    await c.close();
  });

  await step("wrong delivery keys are refused and never saved", async () => {
    await page.goto(delivery);
    await page.click('[data-carrier="yalidine"] button:has-text("ربط")');
    await page.fill("#yalidine-apiId", "good-id");
    await page.fill("#yalidine-apiToken", "wrong");
    await page.locator('[data-connect="yalidine"] button[type=submit]').click();
    await page.waitForSelector("text=شركة التوصيل رفضت المفاتيح");
    const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM carrier_accounts WHERE shop_id = ?", [shopId]);
    expect(Number(n) === 0, "nothing saved");
  });

  await step("Yalidine connects with valid keys, stored encrypted, first account is default", async () => {
    await page.fill("#yalidine-apiToken", "good-token");
    await page.locator('[data-connect="yalidine"] button[type=submit]').click();
    await page.waitForSelector('[data-account="yalidine"]');
    await page.locator('[data-account="yalidine"]').getByText("الافتراضية").waitFor();
    const [[acc]] = await db.query("SELECT credentials, base_url FROM carrier_accounts WHERE shop_id = ?", [shopId]);
    expect(!acc.credentials.includes("good-token") && acc.credentials.startsWith("v1."), "credentials encrypted");
    expect(acc.base_url === "https://api.yalidine.app", "Yalidine address");
  });

  await step("an Ecotrack company needs a real ecotrack.dz address", async () => {
    await page.click('[data-carrier="navex"] button:has-text("ربط")');
    await page.fill("#navex-baseUrl", "evil.example.com");
    await page.fill("#navex-token", "good-token");
    await page.locator('[data-connect="navex"] button[type=submit]').click();
    await page.waitForSelector("text=رابط غير صحيح");
    await page.fill("#navex-baseUrl", "navex.ecotrack.dz");
    await page.locator('[data-connect="navex"] button[type=submit]').click();
    await page.waitForSelector('[data-account="navex"]');
    await page.click('[data-account="navex"] button:has-text("اجعلها الافتراضية")');
    await page.locator('[data-account="navex"]').getByText("الافتراضية", { exact: true }).waitFor();
  });

  let orderId;
  await step("an order must be confirmed before sending; the courier's refusal is shown", async () => {
    orderId = await placeOrder("سارة بن علي", "0661223344", 16, "Nowhere");
    await page.goto(`${orders}/${orderId}`);
    expect(await page.locator('[data-testid=shipment] button:has-text("إرسال الطلب")').isDisabled(), "send disabled while new");
    await page.click('[data-testid=status-picker] button:has-text("مؤكد")');
    await page.waitForSelector('[data-testid=history] >> text=جديد ← مؤكد');
    await page.selectOption('[data-testid=shipment] select', { label: "Yalidine" });
    await page.click('[data-testid=shipment] button:has-text("إرسال الطلب")');
    await page.waitForSelector("text=رفضت شركة التوصيل الطلب: Commune introuvable");
  });

  await step("sending to Yalidine saves the tracking number and marks the order as shipping", async () => {
    await page.click("text=تعديل المعلومات");
    await page.fill("#commune", "Bab Ezzouar");
    await page.locator("form:has(#commune) button[type=submit]").click();
    await page.waitForSelector("text=تم الحفظ");
    await page.selectOption('[data-testid=shipment] select', { label: "Yalidine" });
    await page.click('[data-testid=shipment] button:has-text("إرسال الطلب")');
    await page.waitForSelector("[data-testid=tracking-number]");
    const tracking = await page.locator("[data-testid=tracking-number]").innerText();
    expect(tracking.startsWith("yal-"), `tracking number (${tracking})`);
    const sent = received.findLast((r) => r.platform === "yalidine");
    expect(sent.to_wilaya_name === "Alger" && sent.price === 3300 && sent.contact_phone === "0661223344" && sent.firstname === "سارة بن" && sent.familyname === "علي", "parcel data sent right");
    await page.waitForSelector('[data-testid=history] >> text=مؤكد ← قيد التوصيل');
  });

  await step("a delivered parcel closes the order as delivered", async () => {
    const tracking = await page.locator("[data-testid=tracking-number]").innerText();
    setParcelStatus(tracking, "En cours de livraison");
    await page.click('button:has-text("تحديث الحالة")');
    await page.locator("[data-testid=shipment]").getByText("خرج للتوصيل").waitFor();
    setParcelStatus(tracking, "Livré");
    await page.click('button:has-text("تحديث الحالة")');
    await page.waitForSelector('[data-testid=history] >> text=قيد التوصيل ← تم التسليم');
    const [[order]] = await db.query("SELECT status FROM orders WHERE id = ?", [orderId]);
    expect(order.status === "delivered", "order delivered");
  });

  await step("sending through an Ecotrack company and a returned parcel", async () => {
    const id = await placeOrder("يوسف", "0770112233", 31, "Es Senia");
    await page.goto(`${orders}/${id}`);
    await page.click('[data-testid=status-picker] button:has-text("مؤكد")');
    await page.waitForSelector('[data-testid=history] >> text=جديد ← مؤكد');
    // The default company (Navex) is preselected
    await page.click('[data-testid=shipment] button:has-text("إرسال الطلب")');
    await page.waitForSelector("[data-testid=tracking-number]");
    const sent = received.findLast((r) => r.platform === "ecotrack");
    expect(sent.code_wilaya === 31 && sent.montant === 3600 && sent.commune === "Es Senia" && sent.stop_desk === 0, "Ecotrack parcel data");
    setParcelStatus(await page.locator("[data-testid=tracking-number]").innerText(), "Retourné");
    await page.click('button:has-text("تحديث الحالة")');
    await page.waitForSelector('[data-testid=history] >> text=قيد التوصيل ← مرتجع');
  });

  await step("ZR Express (both platforms) and NOEST: connect, send, read the status", async () => {
    await page.goto(delivery);
    await page.click('[data-carrier="zr"] button:has-text("ربط")');
    await page.fill("#zr-tenantId", "good-tenant");
    await page.fill("#zr-apiKey", "wrong-key");
    await page.locator('[data-connect="zr"] button[type=submit]').click();
    await page.locator('[data-connect="zr"]').getByText("شركة التوصيل رفضت المفاتيح").waitFor();
    expect(!(await page.locator('[data-account="zr"]').count()), "refused keys are not saved");
    await page.fill("#zr-apiKey", "good-key");
    await page.locator('[data-connect="zr"] button[type=submit]').click();
    await page.waitForSelector('[data-account="zr"]');
    await page.click('[data-carrier="zrexpress"] button:has-text("ربط")');
    await page.fill("#zrexpress-token", "good-token");
    await page.fill("#zrexpress-key", "good-key");
    await page.locator('[data-connect="zrexpress"] button[type=submit]').click();
    await page.waitForSelector('[data-account="zrexpress"]');
    await page.click('[data-carrier="noest"] button:has-text("ربط")');
    await page.fill("#noest-apiToken", "good-token");
    await page.fill("#noest-userGuid", "good-guid");
    await page.locator('[data-connect="noest"] button[type=submit]').click();
    await page.waitForSelector('[data-account="noest"]');

    for (const [label, platform, phone] of [["ZR Express", "zrexpress", "0661000003"], ["ZR Express (Procolis)", "procolis", "0661000001"], ["NOEST Express", "noest", "0661000002"]]) {
      const id = await placeOrder("كريم", phone, 16, "Kouba");
      await page.goto(`${orders}/${id}`);
      await page.click('[data-testid=status-picker] button:has-text("مؤكد")');
      await page.waitForSelector('[data-testid=history] >> text=جديد ← مؤكد');
      await page.selectOption("[data-testid=shipment] select", { label });
      await page.click('[data-testid=shipment] button:has-text("إرسال الطلب")');
      await page.waitForSelector("[data-testid=tracking-number]");
      const sent = received.findLast((r) => r.platform === platform);
      if (platform === "zrexpress")
        expect(sent.deliveryAddress.cityTerritoryId === "w-16" && sent.deliveryAddress.districtTerritoryId === "c-kouba" && sent.amount === 3300 && sent.customer.phone.number1 === "+213661000003" && sent.deliveryType === "home", "ZR (new) parcel data");
      else if (platform === "procolis") expect(sent.IDWilaya === "16" && sent.Total === "3300" && sent.TypeLivraison === "0" && sent.MobileA === phone, "ZR parcel data");
      else expect(sent.wilaya_id === 16 && sent.montant === 3300 && sent.phone === phone, "NOEST parcel data");
      setParcelStatus(await page.locator("[data-testid=tracking-number]").innerText(), platform === "zrexpress" ? "livre" : "Livré");
      await page.click('button:has-text("تحديث الحالة")');
      await page.waitForSelector('[data-testid=history] >> text=قيد التوصيل ← تم التسليم');
    }
  });

  await step("a tracking number typed by hand, then removed", async () => {
    const id = await placeOrder("ليلى", "0550998877", 9, "Blida");
    await page.goto(`${orders}/${id}`);
    await page.click("text=إدخال رقم التتبع يدوياً");
    await page.fill("#carrierName", "Maystro Delivery");
    await page.fill("#trackingNumber", "MS-12345");
    await page.locator("form:has(#trackingNumber) button[type=submit]").click();
    await page.waitForSelector('[data-testid=tracking-number] >> text=MS-12345');
    expect(!(await page.locator('button:has-text("تحديث الحالة")').count()), "no refresh for manual tracking");
    await page.click('button:has-text("إزالة الشحنة")');
    await page.waitForSelector('[data-testid=shipment] button:has-text("إرسال الطلب")');
  });

  await step("call center agents use shipments but cannot open the delivery settings", async () => {
    const agent = await createSession({ shopId, role: "agent", email: `agent-p3-${Date.now()}@test.dz` });
    // Agents only see the orders assigned to them
    await db.query("UPDATE orders SET assigned_to = ?, assigned_at = NOW() WHERE id = ?", [agent.userId, orderId]);
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "sc_session", value: agent.token, url: BASE }]);
    const p = await ctx.newPage();
    await p.goto(delivery);
    await p.waitForURL("**/ar/dashboard/orders");
    await p.goto(`${orders}/${orderId}`);
    await p.waitForSelector("[data-testid=tracking-number]");
    await ctx.close();
  });

  await context.close();
}
