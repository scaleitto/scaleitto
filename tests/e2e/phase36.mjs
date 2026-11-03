// Phase 36 (Zimam parity): Connected platforms → Google Sheets → Import orders. The merchant pastes the sheet's header row,
// "Detect columns" suggests each field's column, the settings are saved with the script to paste into the sheet; the
// script's signed rows become orders (product price and delivery from the store when the sheet has none, never twice);
// a status change is written back to the sheet through the deployed script.
import { createHmac, randomUUID } from "node:crypto";
import { BASE, createShop, db, expect, step, until } from "./helpers.mjs";
import { sheetWrites } from "./mock-apps.mjs";

export default async function phase36(browser) {
  const { shopId, context } = await createShop(browser);
  const owner = await context.newPage();
  const page = `${BASE}/ar/dashboard/channels/google_sheets`;
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'ساعة ذكية', 'watch', 4500, '[]', '[]', '[]')", [randomUUID(), shopId]);
  await db.query("INSERT INTO shipping_rates (shop_id, wilaya_code, home_price, office_price) VALUES (?, 31, 600, 400)", [shopId]);
  let endpoint;
  let secret;

  await step("Google Sheets has Import and Export tabs; the header row is detected and saved", async () => {
    await owner.goto(page);
    expect((await owner.locator("[data-testid=sheets-tabs] a").allInnerTexts()).join("|") === "استيراد الطلبات|تصدير الطلبات", "tabs");
    await owner.fill("[data-testid=sheet-headers]", "التاريخ، الاسم، رقم الهاتف، الولاية، البلدية، المنتج، الكمية، السعر، الحالة");
    await owner.click("[data-testid=detect-columns]");
    expect((await owner.locator("[data-field=name]").inputValue()) === "1" && (await owner.locator("[data-field=phone]").inputValue()) === "2", "name and phone found");
    expect((await owner.locator("[data-field=status]").inputValue()) === "8" && (await owner.locator("[data-field=address]").inputValue()) === "", "status found, no address");
    await owner.fill("[data-testid=sheet-script-url]", "https://example.com/not-google");
    await owner.click("[data-testid=save-sheet-import]");
    await owner.getByText("رابط سكربت Google غير صحيح").waitFor();
    await owner.fill("[data-testid=sheet-script-url]", `${process.env.E2E_APPS_URL}/sheet-import/exec`);
    await owner.click("[data-testid=save-sheet-import]");
    await owner.waitForSelector("[data-testid=sheet-script]");
    const script = await owner.locator("[data-testid=sheet-script-code]").inputValue();
    endpoint = script.match(/var ENDPOINT = "([^"]+)"/)[1];
    secret = script.match(/var SECRET = "([^"]+)"/)[1];
    expect(script.includes("var STATUS_COLUMN = 9;") && endpoint.includes("/api/channels/"), "script with the receiving address and the status column");
  });

  const send = (body, sig) => {
    const raw = JSON.stringify(body);
    return fetch(endpoint.replace(/^https?:\/\/[^/]+/, BASE), { method: "POST", headers: { "Content-Type": "application/json", "X-Scaleitto-Signature": sig ?? createHmac("sha256", secret).update(raw).digest("base64") }, body: raw });
  };
  let orderId;

  await step("a signed row becomes an order (store price + delivery), once; unsigned rows are refused", async () => {
    const row = { sheet: "sheet-1", row: 2, values: ["2026-11-03", "أمين", "0550 11 22 33", "Oran", "Es Senia", "ساعة ذكية", "2", "", ""] };
    expect((await send(row, "bad")).status === 401, "bad signature refused");
    const r = await send(row);
    const answer = await r.json();
    expect(r.status === 200 && answer.created && answer.number >= 1001 && answer.status.includes("قيد الانتظار"), `created (${JSON.stringify(answer)})`);
    const [[o]] = await db.query("SELECT id, customer_name, phone, wilaya_code, subtotal, shipping_price, total, channel FROM orders WHERE shop_id = ? AND external_ref = 'google_sheets:sheet-1:2'", [shopId]);
    expect(o.customer_name === "أمين" && o.phone === "0550112233" && o.wilaya_code === 31 && o.subtotal === 9000 && o.shipping_price === 600 && o.total === 9600 && o.channel === "google_sheets", `order (${JSON.stringify(o)})`);
    orderId = o.id;
    const again = await (await send(row)).json();
    expect(!again.created && again.number === answer.number, "the same row is not imported twice");
    const [[{ n }]] = await db.query("SELECT orders_count AS n FROM shop_channels WHERE shop_id = ? AND kind = 'google_sheets'", [shopId]);
    expect(n === 1, "channel counts one order");
  });

  await step("a status change is written back to the sheet's row, signed", async () => {
    await owner.goto(`${BASE}/ar/dashboard/orders?edit=${orderId}`);
    await owner.locator("[data-testid=edit-order-dialog] select[name=status]").selectOption("confirmed");
    await owner.click("[data-testid=save-order]");
    await until(async () => sheetWrites.some((w) => w.body.row === 2 && w.body.status.includes("مؤكد")), "status written back");
    const w = sheetWrites.find((x) => x.body.row === 2);
    expect(w.signature === createHmac("sha256", secret).update(JSON.stringify(w.body)).digest("base64"), "signed with the channel secret");
    await owner.goto(`${BASE}/ar/dashboard/channels`);
    expect((await owner.locator("[data-channel=google_sheets]").getAttribute("data-state")) === "on", "Google Sheets card connected");
  });

  await context.close();
}
