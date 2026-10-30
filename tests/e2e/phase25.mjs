// Phase 25 (owner round 9): the order page's five status sections as dropdowns and the same sections in the orders list
// (only values that have orders), the calls counted (3 at different times, then a message), distribution only in Call
// centers, abandoned carts as a recovery tool (call, message, offer, take the order), and one order form for the store,
// landing pages and the embed code.
import { randomUUID } from "node:crypto";
import { BASE, createShop, db, expect, setCallStatus, step } from "./helpers.mjs";

export default async function phase25(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  const dash = `${BASE}/ar/dashboard`;
  const lamp = randomUUID();
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'مصباح', 'lamp', 2000, '[]', '[]', '[]')", [lamp, shopId]);
  const orderId = randomUUID();
  await db.query(
    "INSERT INTO orders (id, shop_id, number, customer_name, phone, wilaya_code, commune, delivery_type, subtotal, shipping_price, total, status) VALUES (?, ?, 1001, 'زبون', '0661000001', 16, 'Kouba', 'home', 2000, 0, 2000, 'new')",
    [orderId, shopId],
  );
  await db.query("INSERT INTO order_items (id, shop_id, order_id, product_id, name, quantity, unit_price, total) VALUES (?, ?, ?, ?, 'مصباح', 1, 2000, 2000)", [randomUUID(), shopId, orderId, lamp]);
  const orderPage = `${dash}/orders/${orderId}`;
  const statusCard = owner.locator("[data-testid=order-status]");

  await step("order page: the five sections in the owner's order, as dropdowns", async () => {
    await owner.goto(orderPage);
    const sections = await statusCard.locator("select[data-section]").evaluateAll((els) => els.map((e) => e.dataset.section));
    expect(sections.join() === "call,injection,delivery,fault,processing,final", `sections (got ${sections.join()})`);
    const calls = await statusCard.locator("select[data-section=call] option:not([disabled])").evaluateAll((os) => os.map((o) => o.value));
    expect(calls.join() === "confirmed,cancelled,callback,no_answer,voicemail,fake,wrong_number,duplicate,remark", `Statut de la commande in order (got ${calls.join()})`);
    expect(await statusCard.locator("select[data-section=delivery]").isDisabled(), "Livraison waits for the parcel");
  });

  await step("calls are counted: no answer three times, then the page says to send a message", async () => {
    await setCallStatus(owner, "no_answer");
    await owner.locator("[data-testid=call-attempts][data-calls='1']").waitFor();
    await owner.locator("[data-testid=call-again]").click();
    await owner.locator("[data-testid=call-attempts][data-calls='2']").waitFor();
    expect(!(await owner.locator("[data-testid=send-message-hint]").count()), "no message hint yet");
    await owner.locator("[data-testid=call-again]").click();
    await owner.locator("[data-testid=send-message-hint]").waitFor();
    expect((await owner.locator("[data-testid=call-attempts]").innerText()).includes("لا يرد ×3"), "3 × no answer");
    const [[o]] = await db.query("SELECT call_attempts AS n, last_call_at AS at FROM orders WHERE id = ?", [orderId]);
    expect(o.n === 3 && o.at !== null, "saved on the order");
  });

  await step("orders list: the same sections and names, zeros hidden; the calls on the row", async () => {
    await owner.goto(`${dash}/orders`);
    const chips = await owner.locator("[data-testid=order-chips] [data-chip]").evaluateAll((els) => els.map((e) => e.dataset.chip));
    expect(chips.join() === "all,call-no_answer", `only what has orders (got ${chips.join()})`);
    expect((await owner.locator('[data-testid=order-chips] [data-group=call]').innerText()).includes("حالة الطلبية"), "section title");
    expect((await owner.locator('tr[data-order="1001"] [data-calls]').innerText()).includes("3"), "calls on the row");
    expect(!(await owner.locator("[data-testid=bulk-assign]").count()), "distribution is only in Call centers");
  });

  await step("injection by hand: confirmed, then Injectée → sent; the list groups follow", async () => {
    await owner.goto(orderPage);
    await setCallStatus(owner, "confirmed");
    await statusCard.locator("select[data-section=injection]").selectOption("done");
    await statusCard.locator("select[data-section=injection][data-value=done]").waitFor();
    const [[o]] = await db.query("SELECT status, delivery_state AS ds FROM orders WHERE id = ?", [orderId]);
    expect(o.status === "shipped" && o.ds === "shipped", "sent");
    expect((await statusCard.locator("select[data-section=call]").inputValue()) === "confirmed", "still confirmed");
    await owner.goto(`${dash}/orders`);
    const chips = await owner.locator("[data-testid=order-chips] [data-chip]").evaluateAll((els) => els.map((e) => e.dataset.chip));
    expect(chips.join() === "all,call-confirmed,inj-done,ds-shipped", `groups (got ${chips.join()})`);
  });

  await step("abandoned carts: suggested step, WhatsApp message with the product link, then the order taken on the phone", async () => {
    const leadId = randomUUID();
    await db.query("INSERT INTO leads (id, shop_id, product_id, quantity, name, phone, wilaya_code, status) VALUES (?, ?, ?, 2, 'ليلى', '0770998877', 16, 'abandoned')", [leadId, shopId, lamp]);
    await owner.goto(`${dash}/orders/abandoned`);
    const row = owner.locator('[data-lead="0770998877"]');
    expect((await row.getAttribute("data-step")) === "call", "a fresh cart: call first");
    const wa = await row.locator('[data-step="message"]').getAttribute("href");
    expect(wa.startsWith("https://wa.me/213770998877") && decodeURIComponent(wa).includes("ليلى") && decodeURIComponent(wa).includes("/p/lamp"), "message with the name and the product link");
    expect((await owner.locator("[data-testid=recovery-stats] [data-stat=total]").innerText()).includes("1"), "recovery numbers");
    await row.locator('[data-step="order"]').click();
    const form = row.locator("[data-testid=lead-convert]");
    await form.locator("#commune option[value='Kouba']").waitFor({ state: "attached" });
    await form.locator("#commune").selectOption("Kouba");
    await Promise.all([owner.waitForURL(/\/dashboard\/orders\/[0-9a-f-]{36}$/), form.locator("button[type=submit]").click()]);
    const [[o]] = await db.query("SELECT o.phone, o.risk, i.quantity, l.status FROM orders o JOIN order_items i ON i.order_id = o.id JOIN leads l ON l.order_id = o.id WHERE o.id = ?", [owner.url().split("/").pop()]);
    expect(o.phone === "0770998877" && o.quantity === 2 && o.status === "converted" && o.risk === 0, `order created from the cart (got ${JSON.stringify(o)})`);
  });

  await step("one order form: the product's embed code works on any website, with the same form", async () => {
    await owner.goto(`${dash}/store-design/order-form`);
    await owner.locator("[data-testid=embed-source]").selectOption(lamp);
    const code = await owner.locator("[data-testid=embed-code]").inputValue();
    expect(code.includes(`/embed/shop-${tag}/p/lamp`) && code.includes("<iframe"), "embed code for the product");
    const p = await browser.newPage();
    await p.goto(`${BASE}/embed/shop-${tag}/p/lamp`);
    await p.fill("#name", "زبون الكود");
    await p.fill("#phone", "0661 44 55 66");
    await p.selectOption("#wilaya", "16");
    await p.waitForSelector("#commune option[value='Hydra']", { state: "attached" });
    await p.selectOption("#commune", "Hydra");
    await p.waitForTimeout(4500);
    await Promise.all([p.waitForURL(/\/embed\/[^/]+\/thanks\?o=/), p.locator("button[type=submit]").click({ force: true })]);
    const [[o]] = await db.query("SELECT customer_name FROM orders WHERE id = ?", [new URL(p.url()).searchParams.get("o")]);
    expect(o.customer_name === "زبون الكود", "order from the embedded form");
    await p.close();
  });

  await context.close();
}
