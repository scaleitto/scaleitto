// Phase 33 (Zimam parity): Apps → Online payments — four separate methods (Stripe, PayPal, CIB, Edahabia), each connected
// through its own connector ("Save and test", keys encrypted; CIB / Edahabia through SATIM, the direct Algérie Poste
// connector shown as unavailable). Buyers see only methods that are connected and tested; an online order goes to the
// payment page and comes back paid (status asked from the connector); the orders list shows it. Balance: packs bought
// online with the platform's own methods.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { BASE, BROWSER_ARGS, createShop, db, expect, step, until } from "./helpers.mjs";
import { payments } from "./mock-pixels.mjs";

export default async function phase33(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  const apps = `${BASE}/ar/dashboard/integrations/apps`;
  const store = `${BASE}/store/shop-${tag}`;
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'ساعة', 'watch', 4000, '[]', '[]', '[]')", [randomUUID(), shopId]);
  const customer = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: BROWSER_ARGS[0].replace("--user-agent=", "") });
  const buyer = await customer.newPage();
  const order = async (phone, payment) => {
    await buyer.goto(`${store}/p/watch`);
    await buyer.waitForSelector("button[type=submit]");
    await buyer.fill("#name", "أمين بلقاسم");
    await buyer.fill("#phone", phone);
    await buyer.selectOption("#wilaya", "16");
    await buyer.selectOption("#commune", "حيدرة");
    if (payment) await buyer.locator(`[data-testid=payment-${payment}]`).check();
    await buyer.waitForTimeout(4200);
    await buyer.click("button[type=submit]");
  };

  await step("nothing connected: four separate methods, none active; the order form has cash on delivery only", async () => {
    await owner.goto(`${apps}/payments`);
    for (const m of ["stripe", "paypal", "cib", "edahabia"]) expect((await owner.locator(`[data-payment-method=${m}]`).getAttribute("data-state")) === "off", `${m} not active`);
    await owner.locator("[data-testid=edahabia-connector]").selectOption("algerie_poste");
    await owner.waitForSelector("[data-testid=edahabia-unavailable]");
    expect(!(await owner.locator("[data-testid=edahabia-save]").count()), "no save button for an unavailable connector");
    await buyer.goto(`${store}/p/watch`);
    await buyer.waitForSelector("button[type=submit]");
    expect(!(await buyer.locator("[data-testid=payment-choice]").count()), "cash on delivery only");
  });

  await step("Stripe: refused keys are not saved; good ones are tested, saved encrypted and shown active", async () => {
    await owner.goto(`${apps}/payments`);
    const card = owner.locator("[data-payment-method=stripe]");
    await card.locator("input[name=secretKey]").fill("sk_test_wrongwrongwrong");
    await owner.click("[data-testid=stripe-save]");
    await card.getByText("Invalid API Key").waitFor();
    expect(!(await db.query("SELECT id FROM shop_payment_methods WHERE shop_id = ?", [shopId]))[0].length, "nothing saved");
    await card.locator("input[name=secretKey]").fill("sk_test_good1234567890");
    await owner.click("[data-testid=stripe-save]");
    await owner.waitForSelector("[data-payment-method=stripe][data-state=active]");
    const [[row]] = await db.query("SELECT connector, credentials, mode FROM shop_payment_methods WHERE shop_id = ? AND method = 'stripe'", [shopId]);
    expect(row.connector === "stripe" && !row.credentials.includes("sk_test_good") && row.mode === "test", "encrypted, test mode");
    expect((await owner.locator("[data-payment-method=cib]").getAttribute("data-state")) === "off", "CIB stays separate and off");
  });

  await step("Stripe order: payment page, back to a paid thank-you page, paid badge in the orders list", async () => {
    await order("0550 11 22 33", "stripe");
    await buyer.waitForURL(/\/thanks\?o=.*paid=1/);
    const orderId = new URL(buyer.url()).searchParams.get("o");
    expect((await buyer.locator("[data-testid=payment-result]").getAttribute("data-payment")) === "paid", "thank-you page says paid");
    const sent = payments.find((p) => p.connector === "stripe" && p.body.client_reference_id === orderId);
    expect(sent && sent.body["line_items[0][price_data][unit_amount]"] === "400000" && sent.body["line_items[0][price_data][currency]"] === "dzd", "session opened with the order total in centimes");
    const [[o]] = await db.query("SELECT payment_method, payment_provider, payment_status, paid_at FROM orders WHERE id = ?", [orderId]);
    expect(o.payment_method === "stripe" && o.payment_provider === "stripe" && o.payment_status === "paid" && o.paid_at, "stripe, paid time");
    await owner.goto(`${BASE}/ar/dashboard/orders?status=pending&payment=stripe`);
    await owner.waitForSelector("[data-testid=paid-badge]");
  });

  await step("PayPal in euros at the merchant's rate: approved on PayPal, captured on return", async () => {
    await owner.goto(`${apps}/payments`);
    const card = owner.locator("[data-payment-method=paypal]");
    await card.locator("input[name=clientId]").fill("good-client-id-1234567890");
    await card.locator("input[name=clientSecret]").fill("good-client-secret-1234567890");
    await card.locator("input[name=rate]").fill("250");
    await owner.click("[data-testid=paypal-save]");
    await owner.waitForSelector("[data-payment-method=paypal][data-state=active]");
    await order("0550 22 33 44", "paypal");
    await buyer.waitForURL(/\/thanks\?o=.*paid=1/);
    expect((await buyer.locator("[data-testid=payment-result]").getAttribute("data-payment")) === "paid", "captured and paid");
    const sent = payments.findLast((p) => p.connector === "paypal");
    expect(sent.body.purchase_units[0].amount.currency_code === "EUR" && sent.body.purchase_units[0].amount.value === "16.00", "4000 DA = 16.00 EUR");
  });

  await step("CIB and Edahabia through SATIM, each its own method; a failed card payment keeps the order", async () => {
    await owner.goto(`${apps}/payments`);
    for (const m of ["cib", "edahabia"]) {
      const card = owner.locator(`[data-payment-method=${m}]`);
      if (m === "edahabia") await card.locator("[data-testid=edahabia-connector]").selectOption("satim");
      await card.locator("input[name=userName]").fill("good-user");
      await card.locator("input[name=password]").fill(m === "cib" ? "bad-pass" : "good-pass");
      await card.locator("input[name=terminalId]").fill("E010900000");
      await owner.click(`[data-testid=${m}-save]`);
      if (m === "cib") {
        await card.getByText("Access denied").waitFor();
        await card.locator("input[name=password]").fill("good-pass");
        await owner.click("[data-testid=cib-save]");
      }
      await owner.waitForSelector(`[data-payment-method=${m}][data-state=active]`);
    }
    // The buyer's card is refused on the payment page
    await buyer.route("**/pay/**", (r) => r.continue({ url: `${r.request().url()}?result=fail` }));
    await order("0550 33 44 55", "edahabia");
    await buyer.waitForURL(/\/thanks\?o=.*paid=0/);
    expect((await buyer.locator("[data-testid=payment-result]").getAttribute("data-payment")) === "failed", "payment failed shown");
    const [[o]] = await db.query("SELECT payment_method, payment_provider, payment_status, status FROM orders WHERE id = ?", [new URL(buyer.url()).searchParams.get("o")]);
    expect(o.payment_method === "edahabia" && o.payment_provider === "satim" && o.payment_status === "failed" && o.status === "pending", "order kept, payment failed");
    await buyer.unroute("**/pay/**");
    await order("0550 44 55 66", "cib");
    await buyer.waitForURL(/\/thanks\?o=.*paid=1/);
    expect((await buyer.locator("[data-testid=payment-result]").getAttribute("data-payment")) === "paid", "CIB paid");
    const sent = payments.findLast((p) => p.connector === "satim");
    expect(sent.body.amount === "400000" && sent.body.currency === "012", "SATIM order in centimes, DZD");
  });

  await step("cash on delivery still works; a removed method leaves the form", async () => {
    await order("0550 77 88 99", "cod");
    await buyer.waitForURL(/\/thanks\?o=/);
    const [[o]] = await db.query("SELECT payment_method, payment_status FROM orders WHERE id = ?", [new URL(buyer.url()).searchParams.get("o")]);
    expect(o.payment_method === "cod" && o.payment_status === "none", "cash on delivery");
    await owner.goto(`${apps}/payments`);
    owner.once("dialog", (d) => d.accept());
    await owner.locator("[data-payment-method=paypal] button", { hasText: "فصل" }).click();
    await owner.waitForSelector("[data-payment-method=paypal][data-state=off]");
    await buyer.goto(`${store}/p/watch`);
    await buyer.waitForSelector("[data-testid=payment-choice]");
    expect(!(await buyer.locator("[data-testid=payment-paypal]").count()) && (await buyer.locator("[data-testid=payment-cib]").count()) === 1, "PayPal gone, CIB still offered");
  });

  await step("Balance: credits, a pack bought online (the platform's SATIM: CIB) and one by WhatsApp approved by the admin", async () => {
    await db.query("UPDATE shops SET credits = 500 WHERE id = ?", [shopId]);
    await db.query("INSERT INTO credit_ledger (id, shop_id, amount, kind, balance_after) VALUES (UUID(), ?, 500, 'trial', 500)", [shopId]);
    await owner.goto(`${BASE}/ar/dashboard/balance`);
    expect((await owner.locator("[data-testid=balance-credits]").textContent()).replace(/\s/g, "") === "500", "500 credits");
    expect((await owner.locator("[data-testid=credit-history] tr[data-ledger=trial]").count()) === 1, "trial line in the history");
    await owner.locator("[data-testid=pay-cib]").check();
    await Promise.all([owner.waitForURL(/\/dashboard\/balance\?purchase=/), owner.click("[data-testid=buy-starter]")]);
    expect((await owner.locator("[data-testid=purchase-result]").getAttribute("data-result")) === "paid", "card purchase paid");
    await until(async () => (await db.query("SELECT credits FROM shops WHERE id = ?", [shopId]))[0][0].credits === 1500, "1,000 credits added once");
    expect(payments.findLast((p) => p.connector === "satim").body.amount === "80000", "platform SATIM order of 800 DA");
    await owner.click("[data-testid=packs-local]");
    await owner.click("[data-testid=buy-growth]");
    await owner.locator("[data-testid=credit-request] input[value=whatsapp]").check();
    await owner.click("[data-testid=credit-request-send]");
    await owner.waitForSelector("[data-testid=credit-pending]");
    const adminId = randomUUID();
    await db.query("INSERT INTO users (id, email, name, password_hash, locale, is_platform_admin, email_verified_at) VALUES (?, ?, 'Admin', 'scrypt$00$00', 'ar', 1, NOW())", [adminId, `admin33-${tag}@test.dz`]);
    const token = randomBytes(32).toString("base64url");
    await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))", [createHash("sha256").update(token).digest("hex"), adminId]);
    const adminCtx = await browser.newContext();
    await adminCtx.addCookies([{ name: "sc_session", value: token, url: BASE }]);
    const admin = await adminCtx.newPage();
    await admin.goto(`${BASE}/ar/admin/plan-requests`);
    const row = admin.locator(`[data-credit-row="shop-${tag}"]`);
    await row.waitFor();
    await row.locator("button", { hasText: "قبول" }).click();
    await until(async () => (await db.query("SELECT credits FROM shops WHERE id = ?", [shopId]))[0][0].credits === 7000, "5,500 credits added after approval");
    await adminCtx.close();
  });

  await customer.close();
  await context.close();
}
