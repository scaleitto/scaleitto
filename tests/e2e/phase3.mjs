// Phase 3: delivery — prices per wilaya, connecting delivery companies (checked keys, encrypted),
// sending confirmed orders, tracking updates that close the order (from the Confirmed and In transit tabs).
import { randomUUID } from "node:crypto";
import { BASE, createSession, createShop, db, expect, step, setOrderStatus, openOrder, orderEvents, until } from "./helpers.mjs";
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
    await p.selectOption("#commune", commune);
    await Promise.all([p.waitForURL(/thanks\?o=/), p.click("button[type=submit]")]);
    const id = new URL(p.url()).searchParams.get("o");
    await p.close();
    return id;
  }

  await step("delivery prices: a method per wilaya — select all, bulk prices, adjust one wilaya, used by the store", async () => {
    await page.goto(`${delivery}/settings`);
    await page.click("[data-testid=add-delivery-option]");
    await page.fill("[data-testid=option-name]", "التوصيل العادي");
    await page.click("[data-testid=type-both]");
    await page.click("[data-testid=pricing-wilaya]");
    await page.click("[data-testid=select-all-wilayas]");
    await page.click("[data-testid=bulk-home]");
    await page.fill("[data-testid=price-dialog-input]", "600");
    await page.click("[data-testid=price-dialog-apply]");
    await page.click("[data-testid=bulk-office]");
    await page.fill("[data-testid=price-dialog-input]", "400");
    await page.click("[data-testid=price-dialog-apply]");
    await page.fill("[data-wilaya='16'] [data-price=home]", "300");
    await page.fill("[data-wilaya='31'] [data-price=office]", "");
    expect((await page.locator("[data-testid=rates-configured]").innerText()).includes("58"), "58 wilayas set");
    await page.click("[data-testid=save-option]");
    await page.waitForSelector("[data-testid=delivery-saved]");
    const [[row]] = await db.query("SELECT delivery FROM shops WHERE id = ?", [shopId]);
    const d = typeof row.delivery === "string" ? JSON.parse(row.delivery) : row.delivery;
    const rates = d.options[0].rates;
    expect(Object.keys(rates).length === 58 && rates[31].home === 600 && rates[31].office === null && rates[16].home === 300, "Oran: home 600, no office; Algiers home 300");
    const c = await browser.newPage();
    await c.goto(`${store}/p/perfume`);
    await c.selectOption("#wilaya", "16");
    expect((await c.locator("[data-testid=total]").innerText()).replace(/\s/g, "").includes("3300"), "store total = 3000 + 300");
    await c.close();
  });

  await step("wrong delivery keys are refused and never saved", async () => {
    await page.goto(delivery);
    await page.click('[data-carrier="yalidine"] a:has-text("ربط")');
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
    await page.click('[data-carrier="navex"] a:has-text("ربط")');
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

  // Zimam's way: confirmed orders are sent from the Confirmed tab, parcels updated from the In transit tab
  const numberOf = async (id) => (await db.query("SELECT number FROM orders WHERE id = ?", [id]))[0][0].number;
  const trackingOf = async (id) => (await db.query("SELECT tracking_number AS t FROM shipments WHERE order_id = ?", [id]))[0][0]?.t;
  const confirm = async (id) => {
    await openOrder(page, id);
    await setOrderStatus(page, "confirmed");
  };
  const runBatch = async (tab, id, button, account) => {
    await page.goto(`${orders}?status=${tab}`);
    await page.locator(`tr[data-order="${await numberOf(id)}"] input[data-bulk-order]`).check();
    if (account) await page.selectOption("[data-testid=ship-account]", { label: account });
    await page.click(`[data-testid=${button}]`);
    const report = page.locator("[data-testid=batch-report]");
    await report.waitFor({ timeout: 30_000 });
    return report;
  };
  const send = (id, account) => runBatch("confirmed", id, "ship-send", account);
  const track = (id) => runBatch("in_transit", id, "track-refresh");

  let orderId;
  await step("an order must be confirmed before sending; the courier's refusal is shown", async () => {
    orderId = await placeOrder("سارة بن علي", "0661223344", 16, "Kouba");
    // A commune the courier does not know (only possible in old orders: the form lists real communes)
    await db.query("UPDATE orders SET commune = 'Nowhere' WHERE id = ?", [orderId]);
    await page.goto(`${orders}?status=confirmed`);
    expect(!(await page.locator(`tr[data-order="${await numberOf(orderId)}"]`).count()), "a new order is not in Confirmed");
    await confirm(orderId);
    expect((await orderEvents(orderId)).includes("status:pending>confirmed"), "history");
    const report = await send(orderId, "Yalidine");
    await report.getByText("Commune introuvable").waitFor();
  });

  await step("sending to Yalidine saves the tracking number and marks the order as shipping", async () => {
    await db.query("UPDATE orders SET commune = 'Bab Ezzouar' WHERE id = ?", [orderId]);
    const report = await send(orderId, "Yalidine");
    await report.locator("[data-result=ok]").waitFor();
    const tracking = await trackingOf(orderId);
    expect(tracking?.startsWith("yal-"), `tracking number (${tracking})`);
    const sent = received.findLast((r) => r.platform === "yalidine");
    expect(sent.to_wilaya_name === "Alger" && sent.contact_phone === "0661223344" && sent.firstname === "سارة بن" && sent.familyname === "علي", "parcel data sent right");
    expect((await orderEvents(orderId)).includes("status:confirmed>in_transit"), "in transit");
  });

  await step("a delivered parcel closes the order as delivered", async () => {
    setParcelStatus(await trackingOf(orderId), "Livré");
    await track(orderId);
    await until(async () => (await db.query("SELECT status FROM orders WHERE id = ?", [orderId]))[0][0].status === "delivered", "order delivered");
  });

  await step("sending through an Ecotrack company and a returned parcel", async () => {
    const id = await placeOrder("يوسف", "0770112233", 31, "Es Senia");
    await confirm(id);
    // The default company (Navex) is preselected
    await send(id);
    const sent = received.findLast((r) => r.platform === "ecotrack");
    expect(sent.code_wilaya === 31 && sent.montant === 3600 && sent.commune === "Es Senia" && sent.stop_desk === 0, "Ecotrack parcel data");
    setParcelStatus(await trackingOf(id), "Retourné");
    await track(id);
    await until(async () => (await db.query("SELECT status FROM orders WHERE id = ?", [id]))[0][0].status === "returned", "order returned");
  });

  await step("ZR Express (both platforms) and NOEST: connect, send, read the status", async () => {
    await page.goto(delivery);
    await page.click('[data-carrier="zr"] a:has-text("ربط")');
    await page.fill("#zr-tenantId", "good-tenant");
    await page.fill("#zr-apiKey", "wrong-key");
    await page.locator('[data-connect="zr"] button[type=submit]').click();
    await page.locator('[data-connect="zr"]').getByText("شركة التوصيل رفضت المفاتيح").waitFor();
    expect(!(await page.locator('[data-account="zr"]').count()), "refused keys are not saved");
    await page.fill("#zr-apiKey", "good-key");
    await page.locator('[data-connect="zr"] button[type=submit]').click();
    await page.waitForSelector('[data-account="zr"]');
    await page.click('[data-carrier="zrexpress"] a:has-text("ربط")');
    await page.fill("#zrexpress-token", "good-token");
    await page.fill("#zrexpress-key", "good-key");
    await page.locator('[data-connect="zrexpress"] button[type=submit]').click();
    await page.waitForSelector('[data-account="zrexpress"]');
    await page.click('[data-carrier="noest"] a:has-text("ربط")');
    await page.fill("#noest-apiToken", "good-token");
    await page.fill("#noest-userGuid", "good-guid");
    await page.locator('[data-connect="noest"] button[type=submit]').click();
    await page.waitForSelector('[data-account="noest"]');

    for (const [label, platform, phone] of [["ZR Express", "zrexpress", "0661000003"], ["ZR Express (Procolis)", "procolis", "0661000001"], ["NOEST Express", "noest", "0661000002"]]) {
      const id = await placeOrder("كريم", phone, 16, "Kouba");
      await confirm(id);
      const report = await send(id, label);
      await report.locator("[data-result=ok]").waitFor();
      const sent = received.findLast((r) => r.platform === platform);
      if (platform === "zrexpress")
        expect(sent.deliveryAddress.cityTerritoryId === "w-16" && sent.deliveryAddress.districtTerritoryId === "c-kouba" && sent.amount === 3300 && sent.customer.phone.number1 === "+213661000003" && sent.deliveryType === "home", "ZR (new) parcel data");
      else if (platform === "procolis") expect(sent.IDWilaya === "16" && sent.Total === "3300" && sent.TypeLivraison === "0" && sent.MobileA === phone, "ZR parcel data");
      else expect(sent.wilaya_id === 16 && sent.montant === 3300 && sent.phone === phone, "NOEST parcel data");
      setParcelStatus(await trackingOf(id), platform === "zrexpress" ? "livre" : "Livré");
      await track(id);
      await until(async () => (await db.query("SELECT status FROM orders WHERE id = ?", [id]))[0][0].status === "delivered", `${platform} delivered`);
    }
  });

  await step("call center agents cannot open the delivery settings", async () => {
    const agent = await createSession({ shopId, role: "agent", email: `agent-p3-${Date.now()}@test.dz` });
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "sc_session", value: agent.token, url: BASE }]);
    const p = await ctx.newPage();
    await p.goto(delivery);
    await p.waitForURL((u) => u.pathname === "/ar/call-center");
    await ctx.close();
  });

  await context.close();
}
