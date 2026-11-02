// Phase 33 (Zimam parity): Apps → Online payments — the merchant connects Chargily / SlickPay ("Save and test", keys
// encrypted); buyers choose cash on delivery or card; a card order goes to the gateway's page and comes back paid
// (Chargily: signed webhook; SlickPay: status asked on return); the orders list shows it.
import { randomUUID } from "node:crypto";
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

  await step("no gateway: the order form has no card option", async () => {
    await buyer.goto(`${store}/p/watch`);
    await buyer.waitForSelector("button[type=submit]");
    expect(!(await buyer.locator("[data-testid=payment-choice]").count()), "cash on delivery only");
  });

  await step("Chargily: a refused key is not saved; a good one is tested, saved encrypted and shown as connected", async () => {
    await owner.goto(`${apps}/payments`);
    const card = owner.locator("[data-payment-provider=chargily]");
    await card.locator("input[name=secretKey]").fill("test_sk_wrongwrongwrong");
    await owner.click("[data-testid=chargily-save]");
    await card.getByText("رفضت البوابة المفتاح").waitFor();
    expect(!(await db.query("SELECT id FROM shop_payments WHERE shop_id = ?", [shopId]))[0].length, "nothing saved");
    await card.locator("input[name=secretKey]").fill("test_sk_good1234567890");
    await card.locator("select[name=fees]").selectOption("buyer");
    await owner.click("[data-testid=chargily-save]");
    await owner.waitForSelector("[data-payment-provider=chargily][data-state=on]");
    const [[row]] = await db.query("SELECT credentials, mode, fees_on_buyer FROM shop_payments WHERE shop_id = ? AND provider = 'chargily'", [shopId]);
    expect(!row.credentials.includes("test_sk_good") && row.mode === "test" && row.fees_on_buyer === 1, "encrypted, test mode, fees on the buyer");
  });

  await step("card order through Chargily: gateway page, signed webhook, back to a paid thank-you page", async () => {
    await order("0550 11 22 33", "card");
    await buyer.waitForURL(/\/thanks\?o=.*paid=1/);
    const orderId = new URL(buyer.url()).searchParams.get("o");
    expect((await buyer.locator("[data-testid=payment-result]").getAttribute("data-payment")) === "paid", "thank-you page says paid");
    const sent = payments.find((p) => p.provider === "chargily" && p.body.metadata?.order_id === orderId);
    expect(sent && sent.body.amount === 4000 && sent.body.currency === "dzd" && sent.body.pass_fees_to_customer === true && sent.body.webhook_endpoint.endsWith(`/api/payments/chargily/${shopId}`), "checkout opened with the order total");
    await until(async () => (await db.query("SELECT payment_status FROM orders WHERE id = ?", [orderId]))[0][0].payment_status === "paid", "paid in the database");
    const [[o]] = await db.query("SELECT payment_method, payment_provider, paid_at FROM orders WHERE id = ?", [orderId]);
    expect(o.payment_method === "card" && o.payment_provider === "chargily" && o.paid_at, "card, Chargily, paid time");
    await owner.goto(`${BASE}/ar/dashboard/orders?status=pending`);
    await owner.waitForSelector("[data-testid=paid-badge]");
  });

  await step("a forged webhook is refused", async () => {
    const res = await fetch(`${BASE}/api/payments/chargily/${shopId}`, { method: "POST", headers: { "Content-Type": "application/json", signature: "deadbeef" }, body: JSON.stringify({ type: "checkout.paid", data: { metadata: { order_id: randomUUID() } } }) });
    expect(res.status === 403, `403 (got ${res.status})`);
  });

  await step("SlickPay instead: the payment is checked with the gateway when the buyer comes back", async () => {
    await owner.goto(`${apps}/payments`);
    owner.once("dialog", (d) => d.accept());
    await owner.locator("[data-payment-provider=chargily] button", { hasText: "فصل" }).click();
    await owner.waitForSelector("[data-payment-provider=chargily][data-state=off]");
    const card = owner.locator("[data-payment-provider=slickpay]");
    await card.locator("input[name=publicKey]").fill("good-public-key-123");
    await card.locator("input[name=contactId]").fill(randomUUID());
    await owner.click("[data-testid=slickpay-save]");
    await owner.waitForSelector("[data-payment-provider=slickpay][data-state=on]");
    await order("0550 44 55 66", "card");
    await buyer.waitForURL(/\/thanks\?o=.*paid=1/);
    expect((await buyer.locator("[data-testid=payment-result]").getAttribute("data-payment")) === "paid", "paid after asking SlickPay");
    expect(payments.some((p) => p.provider === "slickpay" && p.body.amount === 4000 && p.body.phone === "0550445566"), "invoice with the buyer's details");
  });

  await step("cash on delivery still works with a gateway connected", async () => {
    await order("0550 77 88 99", "cod");
    await buyer.waitForURL(/\/thanks\?o=/);
    const [[o]] = await db.query("SELECT payment_method, payment_status FROM orders WHERE id = ?", [new URL(buyer.url()).searchParams.get("o")]);
    expect(o.payment_method === "cod" && o.payment_status === "none", "cash on delivery");
  });

  await customer.close();
  await context.close();
}
