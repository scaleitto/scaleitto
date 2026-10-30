// Phase 14: AI for the call center — the product's call guide on the order page, customer messages
// (situation from the order status, WhatsApp/SMS links, kept in the history, editable and rewritable by AI),
// AI product descriptions, the monthly AI quota, agents.
import { randomUUID } from "node:crypto";
import { BASE, createSession, createShop, db, expect, step, setOrderStatus } from "./helpers.mjs";

export default async function phase14(browser) {
  const { shopId, context, tag } = await createShop(browser);
  await context.route(/wa\.me/, (route) => route.abort());
  const owner = await context.newPage();
  const productId = randomUUID();
  await db.query("INSERT INTO products (id, shop_id, name, slug, description, price, images, options, offers) VALUES (?, ?, 'ساعة ذكية', 'smartwatch', 'ساعة مقاومة للماء', 4900, '[]', '[]', '[]')", [productId, shopId]);
  await db.query("INSERT INTO shipping_rates (shop_id, wilaya_code, home_price, office_price) VALUES (?, 16, 500, 400), (?, 31, 800, 600)", [shopId, shopId]);
  // Room for the AI tasks of this test (the free plan has 3 a month)
  const contractId = randomUUID();
  await db.query("INSERT INTO shop_contracts (id, shop_id, start_date, limits) VALUES (?, ?, CURDATE() - INTERVAL 1 DAY, ?)", [contractId, shopId, JSON.stringify({ maxAiPerMonth: 20 })]);

  const customer = await browser.newPage();
  await customer.goto(`${BASE}/store/shop-${tag}/p/smartwatch`);
  await customer.fill("#name", "سمير");
  await customer.fill("#phone", "0661 23 45 67");
  await customer.selectOption("#wilaya", "16");
  await customer.selectOption("#commune", "باب الوادي");
  await Promise.all([customer.waitForURL(/\/thanks\?o=/), customer.click("button[type=submit]")]);
  const orderId = new URL(customer.url()).searchParams.get("o");
  await customer.close();
  const orderPage = `${BASE}/ar/dashboard/orders/${orderId}`;

  await step("message card: the situation follows the status, filled with the order, sent and logged", async () => {
    await owner.goto(orderPage);
    await setOrderStatus(owner, "call_back");
    await owner.reload();
    const card = owner.locator("[data-testid=message-card]");
    await card.waitFor();
    expect((await card.locator("select").inputValue()) === "noAnswer", "no-answer message preselected");
    const text = await owner.locator("[data-testid=message-text]").inputValue();
    expect(text.includes("سمير") && text.includes("1001") && text.includes("ساعة ذكية") && text.includes(`Shop ${tag}`), `message filled (got ${text})`);
    const href = await card.locator("[data-testid=send-whatsapp]").getAttribute("href");
    expect(href.startsWith("https://wa.me/213661234567?text=") && decodeURIComponent(href).includes("سمير"), "WhatsApp link to the customer");
    expect((await card.locator("[data-testid=send-sms]").getAttribute("href")).startsWith("sms:0661234567?body="), "SMS link");
    await card.locator("select").selectOption("unreachable");
    expect((await owner.locator("[data-testid=message-text]").inputValue()).includes("خارج التغطية"), "out-of-coverage text");
    await card.locator("[data-testid=send-whatsapp]").click();
    await owner.locator("[data-testid=history]").getByText("WhatsApp ·").waitFor();
  });

  await step("call guide: created by the AI for the product, saved, shown again without regenerating", async () => {
    const guide = owner.locator("[data-testid=call-guide]");
    await guide.locator("button", { hasText: "إنشاء دليل المكالمة" }).click();
    await guide.getByText("نعيطلك على الطلبية تاعك").waitFor({ timeout: 30_000 });
    await guide.getByText("«السعر غالي»").click();
    await guide.getByText("الجودة تستاهل").waitFor();
    const [[p]] = await db.query("SELECT call_guide FROM products WHERE id = ?", [productId]);
    const saved = typeof p.call_guide === "string" ? JSON.parse(p.call_guide) : p.call_guide;
    expect(saved.language === "dz" && saved.objections.length === 2, "guide saved on the product");
    const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM ai_generations WHERE shop_id = ? AND kind = 'call_guide' AND status = 'done'", [shopId]);
    expect(n === 1, "one AI task");
    await owner.reload();
    await guide.getByText("نعيطلك على الطلبية تاعك").waitFor();
    await guide.locator("button", { hasText: "إعادة الإنشاء" }).waitFor();
  });

  await step("customer messages: language defaults, AI rewrite (placeholders kept), saved texts used on orders", async () => {
    await owner.goto(`${BASE}/ar/dashboard/call-centers/settings`);
    const editor = owner.locator("[data-testid=messages-editor]");
    await editor.waitFor();
    await owner.selectOption("#msg-language", "fr");
    expect((await owner.locator("#msg-confirm").inputValue()).startsWith("Bonjour {name}"), "French defaults");
    await editor.locator("button", { hasText: "إعادة كتابتها بالذكاء الاصطناعي" }).click();
    await editor.getByText("تمت الكتابة").waitFor({ timeout: 30_000 });
    const confirm = await owner.locator("#msg-confirm").inputValue();
    expect(confirm.includes("{name}") && !confirm.includes("{unknown}"), `AI text cleaned (got ${confirm})`);
    await owner.fill("#msg-postponed", "Nrappelou {name} 3la {order} ⏰");
    await editor.locator("button[type=submit]").click();
    await editor.getByText("تم الحفظ").waitFor();
    const [[shop]] = await db.query("SELECT messages FROM shops WHERE id = ?", [shopId]);
    const messages = typeof shop.messages === "string" ? JSON.parse(shop.messages) : shop.messages;
    expect(messages.language === "fr" && messages.templates.postponed === "Nrappelou {name} 3la {order} ⏰", "saved");
    await owner.goto(orderPage);
    await owner.locator("[data-testid=message-card] select").selectOption("postponed");
    expect((await owner.locator("[data-testid=message-text]").inputValue()) === "Nrappelou سمير 3la 1001 ⏰", "order uses the saved text");
  });

  await step("product description written by the AI into the form, saved with the product", async () => {
    await owner.goto(`${BASE}/ar/dashboard/products/${productId}`);
    await owner.fill("#description", "مقاومة للماء، شاشة ملونة");
    await owner.locator("[data-testid=ai-description]").click();
    await owner.waitForFunction(() => document.querySelector("#description")?.value.startsWith("وصف من الذكاء الاصطناعي"), null, { timeout: 30_000 });
    expect((await owner.locator("#description").inputValue()).includes("ساعة ذكية"), "written for this product");
    await owner.locator("button[type=submit]").first().click();
    let saved = "";
    for (let i = 0; i < 30 && !saved.startsWith("وصف من الذكاء الاصطناعي"); i++) {
      [[{ description: saved }]] = await db.query("SELECT description FROM products WHERE id = ?", [productId]);
      await owner.waitForTimeout(150);
    }
    expect(saved.startsWith("وصف من الذكاء الاصطناعي"), "saved");
  });

  await step("the monthly AI quota applies; agents use the guide and messages on their orders", async () => {
    await db.query("UPDATE shop_contracts SET limits = ? WHERE id = ?", [JSON.stringify({ maxAiPerMonth: 1 }), contractId]);
    await owner.goto(orderPage);
    const guide = owner.locator("[data-testid=call-guide]");
    await guide.locator("button", { hasText: "إعادة الإنشاء" }).click();
    await guide.getByText("وصلت إلى الحد الشهري لاستعمال الذكاء الاصطناعي").waitFor();
    const { userId, token } = await createSession({ shopId, role: "agent", email: `agent14-${tag}@test.dz` });
    await db.query("UPDATE orders SET assigned_to = ? WHERE id = ?", [userId, orderId]);
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "sc_session", value: token, url: BASE }]);
    const agent = await ctx.newPage();
    await agent.goto(orderPage);
    await agent.locator("[data-testid=call-guide]").getByText("نعيطلك على الطلبية تاعك").waitFor();
    await agent.locator("[data-testid=message-card]").waitFor();
    await agent.goto(`${BASE}/ar/dashboard/call-centers/settings`);
    await agent.waitForURL((u) => !u.pathname.endsWith("/settings"));
    await ctx.close();
  });

  await context.close();
}
