// Phase 19: customer messages through the WhatsApp Business API — the merchant connects the number and the
// approved templates on Apps, then agents send from the order page in one click (template with the order's
// values, or plain text inside the 24-hour window); without the API the WhatsApp link stays.
import { randomUUID } from "node:crypto";
import { BASE, createShop, db, expect, step } from "./helpers.mjs";
import { whatsapp } from "./mock-pixels.mjs";

export default async function phase19(browser) {
  const { shopId, context } = await createShop(browser);
  const owner = await context.newPage();
  owner.on("dialog", (d) => d.accept());
  const dash = `${BASE}/ar/dashboard`;
  const card = owner.locator("[data-testid=app-whatsapp]");

  await step("Apps: connect the WhatsApp Business API, a wrong token is reported, then the right one works", async () => {
    await owner.goto(`${dash}/integrations/apps`);
    await owner.fill("#wa-phone", "123456789012345");
    await owner.fill("#wa-token", "wa-wrong");
    await card.locator("button[type=submit]").click();
    await owner.waitForSelector("[data-testid=app-whatsapp][data-state=on]");
    await card.locator("[data-testid=wa-test]").click();
    await card.getByText("Invalid OAuth access token").waitFor();
    await owner.fill("#wa-token", "wa-good");
    await owner.fill("#wa-confirm-name", "confirm_order");
    await owner.fill("#wa-confirm-params", "name, order, total");
    await card.locator("button[type=submit]").click();
    await owner.waitForLoadState("networkidle");
    await card.locator("[data-testid=wa-test]").click();
    await card.getByText("الربط يعمل: Boutique Test").waitFor();
    const [[row]] = await db.query("SELECT token, templates FROM shop_whatsapp WHERE shop_id = ?", [shopId]);
    expect(!row.token.includes("wa-good"), "token stored encrypted");
    const templates = typeof row.templates === "string" ? JSON.parse(row.templates) : row.templates;
    expect(templates.confirm?.name === "confirm_order" && templates.confirm.params.join() === "name,order,total" && !templates.noAnswer, "one template saved");
  });

  const order = async (number, phone) => {
    const id = randomUUID();
    await db.query("INSERT INTO orders (id, shop_id, number, customer_name, phone, wilaya_code, commune, delivery_type, subtotal, shipping_price, total, status) VALUES (?, ?, ?, 'أمين', ?, 16, 'Kouba', 'home', 2500, 400, 2900, 'pending')", [id, shopId, number, phone]);
    await db.query("INSERT INTO order_items (id, shop_id, order_id, name, quantity, unit_price, total) VALUES (?, ?, ?, 'ساعة', 1, 2500, 2500)", [randomUUID(), shopId, id]);
    return id;
  };

  await step("order page: the template goes out with the order's values; another situation as text", async () => {
    const id = await order(1001, "0661234567");
    await owner.goto(`${dash}/orders/${id}`);
    const messages = owner.locator("[data-testid=message-card]");
    await messages.locator("[data-testid=send-api]").click();
    await messages.getByText("تم الإرسال عبر WhatsApp API").waitFor();
    const sent = whatsapp.at(-1).body;
    expect(sent.to === "213661234567" && sent.type === "template" && sent.template.name === "confirm_order", `template message (got ${JSON.stringify(sent)})`);
    const values = sent.template.components[0].parameters.map((p) => p.text);
    expect(values[0] === "أمين" && values[1] === "1001" && values[2].includes("2") && values[2].includes("900"), `values in order (got ${values.join(" | ")})`);
    expect((await messages.locator("[data-testid=send-whatsapp]").innerText()).includes("فتح واتساب"), "the app link stays as a second way");
    await messages.locator("select").selectOption("noAnswer");
    await messages.locator("[data-testid=message-text]").fill("مرحبا أمين، عيطنالك على الطلبية 1001");
    await messages.locator("[data-testid=send-api]").click();
    await owner.waitForFunction(() => document.querySelectorAll("[data-testid=message-card] [role=status]").length > 0);
    const text = whatsapp.at(-1).body;
    expect(text.type === "text" && text.text.body === "مرحبا أمين، عيطنالك على الطلبية 1001", "plain text for a situation without a template");
    const [events] = await db.query("SELECT note FROM order_events WHERE order_id = ? AND type = 'message'", [id]);
    expect(events.length === 2 && events.some((e) => e.note.includes("confirm_order")), "both kept in the order's history");
  });

  await step("Meta's refusal is shown (text outside the 24-hour window)", async () => {
    const id = await order(1002, "0699999999");
    await owner.goto(`${dash}/orders/${id}`);
    const messages = owner.locator("[data-testid=message-card]");
    await messages.locator("select").selectOption("noAnswer");
    await messages.locator("[data-testid=send-api]").click();
    await messages.getByText("131047").waitFor();
    expect((await messages.locator("[role=alert]").innerText()).includes("لم يُرسَل عبر واتساب"), "clear failure");
  });

  await step("without the API: the WhatsApp link as before", async () => {
    await owner.goto(`${dash}/integrations/apps`);
    await card.getByRole("button", { name: "فصل" }).click();
    await owner.waitForSelector("[data-testid=app-whatsapp][data-state=off]");
    const id = await order(1003, "0661234568");
    await owner.goto(`${dash}/orders/${id}`);
    const messages = owner.locator("[data-testid=message-card]");
    await messages.waitFor();
    expect(!(await messages.locator("[data-testid=send-api]").count()), "no send-now button");
    expect((await messages.locator("[data-testid=send-whatsapp]").getAttribute("href")).startsWith("https://wa.me/213661234568"), "wa.me link");
  });

  await context.close();
}
