// Phase 21 (owner's feedback round 5): the Orders section in sub-sections (to confirm → ready to ship → at the courier →
// finished, suspicious, abandoned, protection), bulk sending to a courier with selection, parcel options (the Packers /
// Ecotrack fields), a report and a retry, the Packers import sheet, the courier's stages (Prêt à expédier, En livraison,
// Livrés, Retours…) updated in bulk and by the cron, labels, and the fake-order / robot protection.
import { randomUUID } from "node:crypto";
import { BASE, createShop, db, expect, step } from "./helpers.mjs";
import { received, setParcelStatus } from "./mock-carriers.mjs";

export default async function phase21(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  owner.on("dialog", (d) => d.accept());
  const dash = `${BASE}/ar/dashboard`;
  const productId = randomUUID();
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'ساعة ذكية', 'watch', 2500, '[]', '[]', '[]')", [productId, shopId]);
  await db.query("INSERT INTO shipping_rates (shop_id, wilaya_code, home_price, office_price) VALUES (?, 16, 400, 300)", [shopId]);

  let number = 3000;
  const order = async ({ status = "confirmed", commune = "Kouba", phone = "0661000000", name = "أمين بن علي", risk = 0, delivery = "home" } = {}) => {
    const id = randomUUID();
    // Orders placed from the store (abandoned checkouts included) take numbers too
    number = Math.max(number, (await db.query("SELECT COALESCE(MAX(number), 0) AS m FROM orders WHERE shop_id = ?", [shopId]))[0][0].m) + 1;
    await db.query(
      "INSERT INTO orders (id, shop_id, number, customer_name, phone, wilaya_code, commune, address, delivery_type, subtotal, shipping_price, total, status, risk) VALUES (?, ?, ?, ?, ?, 16, ?, 'Cité 5 juillet', ?, 2500, 400, 2900, ?, ?)",
      [id, shopId, number, name, phone, commune, delivery, status, risk],
    );
    await db.query("INSERT INTO order_items (id, shop_id, order_id, product_id, name, quantity, unit_price, total) VALUES (?, ?, ?, ?, 'ساعة ذكية', 1, 2500, 2500)", [randomUUID(), shopId, id, productId]);
    return { id, number };
  };

  await step("Packers connected, with its default parcel options (fragile, weight)", async () => {
    await owner.goto(`${dash}/delivery`);
    await owner.click('[data-carrier="packers"] a:has-text("ربط")');
    await owner.fill("#packers-token", "good-token");
    await owner.locator('[data-connect="packers"] button[type=submit]').click();
    const card = owner.locator('[data-account="packers"]');
    await card.waitFor();
    await card.locator("[data-testid=account-defaults] button").first().click();
    await card.locator("[data-testid=opt-fragile]").check();
    await owner.fill("#def-packers-weight", "2");
    await card.locator("button", { hasText: "حفظ الخيارات" }).click();
    await card.getByText("تم الحفظ").waitFor();
    const [[acc]] = await db.query("SELECT options FROM carrier_accounts WHERE shop_id = ?", [shopId]);
    const options = typeof acc.options === "string" ? JSON.parse(acc.options) : acc.options;
    expect(options.fragile === true && options.weight === 2 && options.kind === "delivery", `defaults saved (got ${JSON.stringify(options)})`);
  });

  const ready = [];
  await step("ready to ship: the Confirmed tab lists confirmed orders only, with selection tools", async () => {
    for (let i = 0; i < 3; i++) ready.push(await order({ phone: `066100000${i}`, delivery: i === 2 ? "office" : "home" }));
    ready.push(await order({ commune: "Nowhere", phone: "0661000009" }));
    await order({ status: "pending", phone: "0661000010" });
    await owner.goto(`${dash}/orders?status=confirmed`);
    await owner.locator("[data-testid=ship-panel]").waitFor();
    expect((await owner.locator("tr[data-order]").count()) === 4, "4 confirmed orders, the pending one is not here");
    await owner.locator("[data-testid=select-all]").click();
    await owner.locator("[data-testid=bulk-status]").getByText("4 محددة").waitFor();
    await owner.locator("[data-testid=select-all]").click();
    await owner.locator("[data-testid=bulk-status]").waitFor({ state: "detached" });
    await owner.locator("[data-testid=select-all]").click();
    // The account's defaults are in the bulk options
    await owner.locator("[data-testid=ship-options-toggle]").click();
    expect(await owner.locator("[data-testid=ship-panel] [data-testid=opt-fragile]").isChecked(), "fragile from the defaults");
    expect((await owner.inputValue("#bulk-weight")) === "2", "weight from the defaults");
    await owner.fill("#bulk-note", "اتصل قبل التوصيل");
  });

  await step("bulk send: one by one with a report; the refused one can be retried; options reach Ecotrack", async () => {
    const before = received.length;
    await owner.locator("[data-testid=ship-send]").click();
    const report = owner.locator("[data-testid=batch-report]");
    await report.waitFor({ timeout: 30_000 });
    expect((await report.locator("[data-result=ok]").count()) === 3 && (await report.locator("[data-result=failed]").count()) === 1, "3 sent, 1 refused");
    expect((await report.locator("[data-result=failed]").innerText()).includes("La commune n'existe pas"), "the courier's own words");
    const sent = received.slice(before).filter((r) => r.platform === "ecotrack");
    const office = sent.find((r) => r.reference === String(ready[2].number));
    expect(sent.length === 4 && sent.every((r) => r.type === 1 && r.remarque.includes("اتصل قبل التوصيل") && r.remarque.includes("FRAGILE")), "type delivery, note and FRAGILE on every parcel");
    expect(office.stop_desk === 1 && sent.find((r) => r.reference === String(ready[0].number)).stop_desk === 0, "stop desk follows each customer's choice");
    const [shipped] = await db.query("SELECT o.number, o.status, s.status AS stage FROM orders o JOIN shipments s ON s.order_id = o.id WHERE o.shop_id = ? ORDER BY o.number", [shopId]);
    expect(shipped.length === 3 && shipped.every((r) => r.status === "in_transit" && r.stage === "ready"), `3 parcels "ready to ship" (got ${JSON.stringify(shipped)})`);
    await owner.waitForFunction(() => document.querySelectorAll("tr[data-order]").length === 1);
    // Fix the commune and retry only what failed
    await db.query("UPDATE orders SET commune = 'Bab Ezzouar' WHERE id = ?", [ready[3].id]);
    await report.locator("[data-testid=batch-retry]").click();
    // The new report lists only the retried order
    await owner.waitForFunction(() => document.querySelectorAll("[data-testid=batch-report] [data-result=ok]").length === 1 && document.querySelectorAll("[data-testid=batch-report] [data-result]").length === 1);
  });

  await step("the Packers import sheet: the model's columns, OUI flags", async () => {
    const extra = await order({ phone: "0661000011", delivery: "office" });
    await owner.goto(`${dash}/orders?status=confirmed`);
    await owner.locator(`tr[data-order="${extra.number}"] input[data-bulk-order]`).check();
    const [download] = await Promise.all([owner.waitForEvent("download"), owner.locator("[data-testid=packers-export]").click()]);
    const csv = await (await download.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks).toString("utf8"));
    expect(csv.startsWith("﻿reference commande,nom et prenom du destinataire*,telephone*"), "the Packers headers");
    const row = csv.trim().split("\r\n").pop().split(",");
    expect(row[0] === String(extra.number) && row[2] === "0661000011" && row[4] === "16" && row[10] === "2900", `order data (got ${row.join(" | ")})`);
    expect(row[12] === "OUI" && row[16] === "OUI" && row[9] === "2", "FRAGILE and STOP DESK = OUI, weight from the defaults");
    expect(download.suggestedFilename().startsWith("packers-"), "file name");
  });

  await step("at the courier: stages from Packers, bulk update, labels, the cron", async () => {
    await owner.goto(`${dash}/orders?status=in_transit`);
    await owner.locator("[data-testid=track-panel]").waitFor();
    const [parcels] = await db.query("SELECT s.id, s.tracking_number AS t, o.id AS orderId, o.number FROM shipments s JOIN orders o ON o.id = s.order_id WHERE s.shop_id = ? ORDER BY o.number", [shopId]);
    expect((await owner.locator("tr[data-order]").count()) === 4, "the 4 parcels are in transit");
    setParcelStatus(parcels[0].t, "Livrés");
    setParcelStatus(parcels[1].t, "En livraison");
    setParcelStatus(parcels[2].t, "Suspendus");
    await owner.locator("[data-testid=select-all]").click();
    await owner.locator("[data-testid=track-refresh]").click();
    await owner.locator("[data-testid=batch-report]").waitFor({ timeout: 30_000 });
    const [rows] = await db.query("SELECT s.status AS stage, o.status FROM shipments s JOIN orders o ON o.id = s.order_id WHERE s.shop_id = ? ORDER BY o.number", [shopId]);
    expect(rows.map((r) => r.stage).join() === "delivered,out_for_delivery,suspended,ready", `stages (got ${rows.map((r) => r.stage).join()})`);
    expect(rows[0].status === "delivered", "a delivered parcel closes the order");
    await owner.goto(`${dash}/orders?status=delivered`);
    await owner.waitForSelector(`tr[data-order="${parcels[0].number}"]`);
    // The label is the courier's PDF, fetched with the shop's key
    const res = await owner.request.get(`${BASE}/api/shipments/${parcels[1].id}/label`);
    expect(res.status() === 200 && res.headers()["content-type"].includes("pdf"), "label PDF");
    // The cron: parcels not checked for a while are asked again
    setParcelStatus(parcels[3].t, "Retours");
    await db.query("UPDATE shipments SET checked_at = NOW() - INTERVAL 1 DAY WHERE id = ?", [parcels[3].id]);
    const { createHash } = await import("node:crypto");
    const key = createHash("sha256").update(`scaleitto-cron:${process.env.APP_SECRET || process.env.DATABASE_URL}`).digest("hex").slice(0, 32);
    const cron = await (await fetch(`${BASE}/api/cron/apps?key=${key}`)).json();
    expect(cron.tracking.checked >= 1, `cron checked parcels (got ${JSON.stringify(cron.tracking)})`);
    const [[back]] = await db.query("SELECT s.status AS stage, o.status FROM shipments s JOIN orders o ON o.id = s.order_id WHERE s.id = ?", [parcels[3].id]);
    expect(back.stage === "returned" && back.status === "returned", "returned by the cron");
  });

  await step("robots are refused; a risky order is marked in the table", async () => {
    // A robot browser
    const bot = await browser.newContext({ userAgent: "python-requests/2.31" });
    const b = await bot.newPage();
    await b.goto(`${BASE}/store/shop-${tag}/p/watch`);
    await b.fill("#name", "Robot Robot");
    await b.fill("#phone", "0555 44 33 22");
    await b.selectOption("#wilaya", "16");
    await b.selectOption("#commune", "Kouba");
    await b.click("button[type=submit]");
    await b.getByText("تعذّر إرسال الطلب من هذا المتصفح").waitFor();
    await bot.close();
    const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM orders WHERE shop_id = ? AND phone = '0555443322' AND status <> 'abandoned'", [shopId]);
    expect(n === 0, "no order from the robot");
    // A phone with a returned parcel before, a name that is not a name
    await order({ status: "returned", phone: "0555667788" });
    const c = await browser.newPage();
    await c.goto(`${BASE}/store/shop-${tag}/p/watch`);
    await c.fill("#name", "aaaa1111");
    await c.fill("#phone", "0555 66 77 88");
    await c.selectOption("#wilaya", "16");
    await c.selectOption("#commune", "Kouba");
    await Promise.all([c.waitForURL(/\/thanks\?o=/), c.click("button[type=submit]")]);
    const id = new URL(c.url()).searchParams.get("o");
    await c.close();
    const [[risky]] = await db.query("SELECT risk, risk_reasons FROM orders WHERE id = ?", [id]);
    const reasons = typeof risky.risk_reasons === "string" ? JSON.parse(risky.risk_reasons) : risky.risk_reasons;
    expect(risky.risk >= 50 && reasons.includes("returned") && reasons.includes("name"), `risk ${risky.risk} (${reasons})`);
    await owner.goto(`${dash}/orders?status=pending`);
    await owner.locator("tr[data-order] [data-testid=risk-badge]").waitFor();
    expect((await owner.locator("tr[data-order] [data-testid=risk-badge]").count()) === 1, "only the risky order is marked");
  });

  await context.close();
}
