// Phase 34 (Zimam parity): Apps → WhatsApp order confirmation — the store's settings; a new order asks the buyer on
// WhatsApp (5 credits), the button reply becomes a filter under the status tabs; refused messages are refunded, an
// empty balance sends nothing, quiet hours hold messages, chosen products only, one reminder after 4 hours (cron) and
// the customer notifications on status changes.
import { createHash, createHmac, randomUUID } from "node:crypto";
import { BASE, BROWSER_ARGS, createShop, db, expect, step, until } from "./helpers.mjs";
import { whatsapp } from "./mock-pixels.mjs";

const SECRET = process.env.WHATSAPP_APP_SECRET || "wa-app-secret";
const hook = (payload) => {
  const raw = JSON.stringify(payload);
  return fetch(`${BASE}/api/whatsapp`, { method: "POST", headers: { "Content-Type": "application/json", "X-Hub-Signature-256": `sha256=${createHmac("sha256", SECRET).update(raw).digest("hex")}` }, body: raw });
};
const statusHook = (id, status) => hook({ entry: [{ changes: [{ value: { statuses: [{ id, status, errors: status === "failed" ? [{ message: "Not on WhatsApp" }] : undefined }] } }] }] });
const replyHook = (from, payload) => hook({ entry: [{ changes: [{ value: { messages: [{ from, type: "button", button: { payload, text: "x" } }] } }] }] });

export default async function phase34(browser) {
  const { shopId, context, tag } = await createShop(browser);
  await db.query("UPDATE shops SET credits = 500 WHERE id = ?", [shopId]);
  const owner = await context.newPage();
  const page = `${BASE}/ar/dashboard/integrations/apps/whatsapp`;
  const store = `${BASE}/store/shop-${tag}`;
  const watch = randomUUID();
  const other = randomUUID();
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'ساعة', 'watch', 4000, '[]', '[]', '[]'), (?, ?, 'حقيبة', 'bag', 2500, '[]', '[]', '[]')", [watch, shopId, other, shopId]);
  const customer = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: BROWSER_ARGS[0].replace("--user-agent=", "") });
  const buyer = await customer.newPage();
  const order = async (phone) => {
    await buyer.goto(`${store}/p/watch`);
    await buyer.waitForSelector("button[type=submit]");
    await buyer.fill("#name", "أمين بلقاسم");
    await buyer.fill("#phone", phone);
    await buyer.selectOption("#wilaya", "16");
    await buyer.selectOption("#commune", "حيدرة");
    await buyer.waitForTimeout(4200);
    await buyer.click("button[type=submit]");
    await buyer.waitForURL(/\/thanks\?o=/);
    return new URL(buyer.url()).searchParams.get("o");
  };
  const credits = async () => (await db.query("SELECT credits FROM shops WHERE id = ?", [shopId]))[0][0].credits;
  const msg = async (orderId, kind = "confirm") => (await db.query("SELECT * FROM whatsapp_messages WHERE order_id = ? AND kind = ?", [orderId, kind]))[0][0];
  const save = async () => {
    await owner.click("[data-testid=app-save]");
    await owner.getByText("تم الحفظ.").waitFor();
  };
  const settings = async () => {
    const [[row]] = await db.query("SELECT apps FROM shops WHERE id = ?", [shopId]);
    return (typeof row.apps === "string" ? JSON.parse(row.apps) : row.apps).whatsapp;
  };

  await step("the app page: cost, balance, quiet hours, language, products, notifications, own number", async () => {
    await owner.goto(`${BASE}/ar/dashboard/integrations/apps`);
    await owner.click("a[href$='/integrations/apps/whatsapp']");
    await owner.waitForSelector("[data-app-page=whatsapp]");
    expect(!(await owner.locator("[data-testid=wa-not-ready]").count()), "the platform's number is set up");
    expect((await owner.locator("[data-testid=wa-balance]").textContent()).includes("500"), "balance shown");
    expect((await owner.locator("[data-testid^=wa-notify-]").count()) === 6, "six customer notifications");
    await owner.check("[data-testid=app-enabled]");
    await owner.selectOption("[data-testid=wa-quiet-from]", "0");
    await owner.selectOption("[data-testid=wa-quiet-to]", "0");
    await owner.check("[data-testid=wa-lang-fr]");
    await owner.check("[data-testid=wa-notify-confirmed]");
    await save();
    const w = await settings();
    expect(w.enabled && w.quietFrom === 0 && w.quietTo === 0 && w.language === "fr" && w.notify.confirmed && !w.notify.shipped && w.products === null, `saved ${JSON.stringify(w)}`);
  });

  let first;
  await step("a new order asks the buyer: template in French with the two buttons, 5 credits taken, order waiting", async () => {
    first = await order("0550 11 22 33");
    await until(async () => (await msg(first))?.status === "sent", "confirmation sent");
    const m = await msg(first);
    const sent = whatsapp.find((x) => x.id === m.wamid);
    expect(sent && sent.to === "213550112233" && sent.template === "scaleitto_confirm" && sent.body.template.language.code === "fr", "template, number, language");
    const comps = sent.body.template.components;
    expect(comps[0].parameters.length === 5 && comps[0].parameters[2].text.startsWith("#") && comps[1].parameters[0].payload === `confirm:${first}` && comps[2].parameters[0].payload === `cancel:${first}`, "variables and buttons");
    expect((await credits()) === 495 && m.credits === 5, "5 credits taken");
    const [[led]] = await db.query("SELECT kind, amount FROM credit_ledger WHERE shop_id = ? ORDER BY created_at DESC LIMIT 1", [shopId]);
    expect(led.kind === "whatsapp" && led.amount === -5, "ledger line");
    expect((await db.query("SELECT whatsapp FROM orders WHERE id = ?", [first]))[0][0].whatsapp === "waiting", "order waiting for the answer");
  });

  await step("Meta's webhook: verification, signature, read report, the buyer confirms → filter under the tabs", async () => {
    expect((await (await fetch(`${BASE}/api/whatsapp?hub.mode=subscribe&hub.verify_token=${process.env.WHATSAPP_VERIFY_TOKEN || "wa-verify"}&hub.challenge=42`)).text()) === "42", "challenge answered");
    expect((await fetch(`${BASE}/api/whatsapp?hub.mode=subscribe&hub.verify_token=no&hub.challenge=42`)).status === 403, "wrong token refused");
    expect((await fetch(`${BASE}/api/whatsapp`, { method: "POST", body: "{}" })).status === 401, "unsigned call refused");
    const m = await msg(first);
    expect((await statusHook(m.wamid, "read")).ok, "status accepted");
    await until(async () => (await msg(first)).status === "read", "read");
    // Someone else cannot answer for the buyer
    await replyHook("213661000000", `confirm:${first}`);
    await replyHook("213550112233", `confirm:${first}`);
    await until(async () => (await db.query("SELECT whatsapp FROM orders WHERE id = ?", [first]))[0][0].whatsapp === "confirmed", "confirmed by the buyer");
    await owner.goto(`${BASE}/ar/dashboard/orders`);
    await owner.waitForSelector("[data-testid=wa-filter]");
    await owner.click("[data-testid=wa-filter] [data-wa=confirmed]");
    await owner.waitForURL(/wa=confirmed/);
    await owner.waitForSelector("[data-testid=wa-badge][data-wa=confirmed]");
    expect((await owner.locator("[data-testid=orders-table] tbody tr").count()) === 1, "only the confirmed order");
  });

  await step("a refused number is refunded and the order stays as it is", async () => {
    const id = await order("0550 11 00 00");
    await until(async () => (await msg(id))?.status === "failed", "refused");
    expect((await credits()) === 495, "credits back");
    expect((await db.query("SELECT whatsapp FROM orders WHERE id = ?", [id]))[0][0].whatsapp === null, "no answer state");
  });

  await step("a message Meta reports as failed later is refunded once", async () => {
    const id = await order("0661 22 33 44");
    await until(async () => (await msg(id))?.status === "sent", "sent");
    expect((await credits()) === 490, "taken");
    const m = await msg(id);
    await statusHook(m.wamid, "failed");
    await statusHook(m.wamid, "failed");
    await until(async () => (await msg(id)).status === "failed", "failed");
    await until(async () => (await credits()) === 495, "refunded");
    await owner.waitForTimeout(500);
    expect((await credits()) === 495, "refunded only once");
  });

  await step("customer notification: confirming the order sends the 'confirmed' message", async () => {
    await owner.goto(`${BASE}/ar/dashboard/orders`);
    const [[{ number }]] = await db.query("SELECT number FROM orders WHERE id = ?", [first]);
    await owner.selectOption(`tr[data-order="${number}"] select[data-field=status]`, "confirmed");
    await until(async () => (await msg(first, "confirmed"))?.status === "sent", "notice sent");
    const wamid = (await msg(first, "confirmed")).wamid;
    const sent = whatsapp.find((x) => x.id === wamid);
    expect(sent && sent.template === "scaleitto_confirmed" && sent.body.template.components.length === 1, "notice template, no buttons");
    const [[led]] = await db.query("SELECT kind FROM credit_ledger WHERE shop_id = ? ORDER BY created_at DESC LIMIT 1", [shopId]);
    expect(led.kind === "notification" && (await credits()) === 490, "notification paid");
  });

  await step("reminder: a question unread after 4 hours gets one reminder from the cron", async () => {
    const id = await order("0770 12 34 56");
    await until(async () => (await msg(id))?.status === "sent", "sent");
    await db.query("UPDATE whatsapp_messages SET sent_at = NOW() - INTERVAL 5 HOUR WHERE order_id = ? AND kind = 'confirm'", [id]);
    const key = createHash("sha256").update(`scaleitto-cron:${process.env.APP_SECRET || process.env.DATABASE_URL}`).digest("hex").slice(0, 32);
    const cron = await (await fetch(`${BASE}/api/cron/apps?key=${key}`)).json();
    expect(cron.whatsapp.reminders >= 1, `reminder queued (${JSON.stringify(cron.whatsapp)})`);
    await until(async () => (await msg(id, "reminder"))?.status === "sent", "reminder sent");
    await fetch(`${BASE}/api/cron/apps?key=${key}`);
    expect((await db.query("SELECT COUNT(*) AS n FROM whatsapp_messages WHERE order_id = ? AND kind = 'reminder'", [id]))[0][0].n === 1, "only one reminder");
  });

  await step("empty balance: nothing is sent", async () => {
    await db.query("UPDATE shops SET credits = 3 WHERE id = ?", [shopId]);
    const before = whatsapp.length;
    const id = await order("0551 98 76 54");
    await until(async () => (await msg(id))?.status === "skipped", "skipped");
    expect((await msg(id)).error === "balance" && whatsapp.length === before && (await credits()) === 3, "not sent, nothing taken");
    await db.query("UPDATE shops SET credits = 500 WHERE id = ?", [shopId]);
  });

  await step("quiet hours hold the message", async () => {
    const hour = (new Date().getUTCHours() + 1) % 24;
    await owner.goto(page);
    await owner.selectOption("[data-testid=wa-quiet-from]", String(hour));
    await owner.selectOption("[data-testid=wa-quiet-to]", String((hour + 1) % 24));
    await save();
    const id = await order("0552 98 76 54");
    await until(async () => (await msg(id)) && new Date((await msg(id)).due_at) > new Date(Date.now() + 60_000), "postponed");
    expect((await msg(id)).status === "queued", "still waiting");
    await owner.selectOption("[data-testid=wa-quiet-to]", String(hour));
    await save();
  });

  await step("chosen products only, and the switch off asks nobody", async () => {
    await owner.goto(page);
    await owner.check("[data-testid=wa-scope-selected]");
    await owner.click("[data-testid=app-save]");
    await owner.getByText("هذا الحقل مطلوب").first().waitFor();
    await owner.locator(`[data-testid=wa-products] input[value="${other}"]`).check();
    await save();
    expect(JSON.stringify((await settings()).products) === JSON.stringify([other]), "saved list");
    const id = await order("0553 98 76 54");
    await owner.waitForTimeout(1500);
    expect(!(await msg(id)), "watch not chosen: not asked");
    await owner.uncheck("[data-testid=app-enabled]");
    await save();
    await owner.goto(`${BASE}/ar/dashboard/orders`);
    expect(!(await owner.locator("[data-testid=wa-filter]").count()), "filter hidden when off");
  });

  await step("connect my own number joins the queue", async () => {
    await owner.goto(page);
    await owner.click("[data-testid=wa-connect]");
    await owner.waitForSelector("[data-testid=wa-queued]");
    expect((await settings()).connectRequested, "request saved");
  });

  await customer.close();
  await context.close();
}
