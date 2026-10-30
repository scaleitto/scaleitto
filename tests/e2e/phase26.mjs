// Phase 26 (Zimam parity, phase 2): the dashboard home, the orders page — status tabs with counts, the table edited in
// place, filter, search, export, new order, bulk status —, the order page (edit dialog) and Scan (dispatch / recuperate).
import { randomUUID } from "node:crypto";
import { BASE, createShop, db, expect, step } from "./helpers.mjs";

export default async function phase26(browser) {
  const { shopId, context } = await createShop(browser);
  const owner = await context.newPage();
  const dash = `${BASE}/ar/dashboard`;
  const orders = `${dash}/orders`;
  const lamp = randomUUID();
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers, track_stock, stock) VALUES (?, ?, 'مصباح', 'lamp', 2000, '[]', '[]', '[]', 1, 10)", [lamp, shopId]);
  await db.query("INSERT INTO shipping_rates (shop_id, wilaya_code, home_price, office_price) VALUES (?, 16, 400, 300)", [shopId]);
  let number = 1000;
  const order = async (status, phone = "0661000000") => {
    const id = randomUUID();
    number++;
    await db.query(
      "INSERT INTO orders (id, shop_id, number, customer_name, phone, wilaya_code, commune, delivery_type, subtotal, shipping_price, total, status) VALUES (?, ?, ?, 'زبون', ?, 16, 'Kouba', 'home', 2000, 400, 2400, ?)",
      [id, shopId, number, phone, status],
    );
    await db.query("INSERT INTO order_items (id, shop_id, order_id, product_id, name, quantity, unit_price, total, stock_tracked) VALUES (?, ?, ?, ?, 'مصباح', 1, 2000, 2000, 1)", [randomUUID(), shopId, id, lamp]);
    return { id, number };
  };
  const a = await order("pending", "0661000001");
  const b = await order("call_back", "0661000002");
  const c = await order("confirmed", "0661000003");
  const d = await order("in_transit", "0661000004");
  await db.query("INSERT INTO shipments (id, shop_id, order_id, carrier_name, tracking_number, status) VALUES (?, ?, ?, 'Yalidine', 'YAL-777', 'out_for_delivery')", [randomUUID(), shopId, d.id]);
  const row = (n) => owner.locator(`tr[data-order="${n}"]`);
  const statusOf = async (id) => (await db.query("SELECT * FROM orders WHERE id = ?", [id]))[0][0];

  await step("home: greeting, what needs the merchant, the 7-day numbers and the checklist", async () => {
    await owner.goto(dash);
    expect(/(صباح|مساء) الخير/.test(await owner.locator("main h1").innerText()), "greeting");
    expect((await owner.locator("[data-testid=attention] [data-todo=pending]").innerText()).includes("2"), "2 orders waiting");
    expect((await owner.locator("[data-stat=orders] [data-value]").innerText()) === "4", "4 orders in 7 days");
    expect((await owner.locator("[data-testid=checklist] [data-step=products]").getAttribute("data-done")) === "true", "a product exists");
    expect((await owner.locator("[data-testid=latest-orders] li").count()) === 4, "latest orders");
  });

  await step("status tabs with counts; Pending also holds the orders to call back", async () => {
    await owner.goto(orders);
    const tabs = await owner.locator("[data-testid=status-tabs] [data-tab]").evaluateAll((els) => els.map((e) => e.dataset.tab));
    expect(tabs.join() === "pending,confirmed,in_transit,delivered,returned,abandoned,cancelled,flagged", `tabs (got ${tabs.join()})`);
    expect((await owner.locator("[data-tab=pending] [data-count]").innerText()) === "2" && (await owner.locator("[data-tab=confirmed] [data-count]").innerText()) === "1", "counts");
    expect((await owner.locator("tr[data-order]").count()) === 2, "pending + call back");
  });

  await step("the table is edited in place: amount, note, delivery type, status", async () => {
    await row(a.number).locator("[data-field=total]").fill("2600");
    await row(a.number).locator("[data-field=note]").click();
    await row(a.number).locator("[data-field=note]").fill("يفضل المساء");
    await row(a.number).locator("[data-field=deliveryType]").click();
    await row(a.number).locator("[data-field=deliveryType]").selectOption("office");
    for (let i = 0; i < 30; i++) {
      const o = await statusOf(a.id);
      if (o.total === 2600 && o.note === "يفضل المساء" && o.delivery_type === "office") break;
      await owner.waitForTimeout(200);
    }
    const o = await statusOf(a.id);
    expect(o.total === 2600 && o.note === "يفضل المساء" && o.delivery_type === "office", `saved (got ${o.total}, ${o.note}, ${o.delivery_type})`);
    await row(b.number).locator("[data-field=status]").selectOption("confirmed");
    await row(b.number).waitFor({ state: "detached" });
    expect((await statusOf(b.id)).status === "confirmed", "confirmed from the pill");
  });

  await step("filter, search and export", async () => {
    await owner.click("[data-testid=filter-open]");
    await owner.selectOption("#f-wilaya", "31");
    await Promise.all([owner.waitForURL(/wilaya=31/), owner.click("[data-testid=filter-apply]")]);
    await owner.getByText("لا توجد طلبات هنا").waitFor();
    await owner.goto(`${orders}?status=confirmed`);
    await owner.fill("[data-testid=order-search]", "0661000003");
    await Promise.all([owner.waitForURL(/q=0661000003/), owner.press("[data-testid=order-search]", "Enter")]);
    expect((await owner.locator("tr[data-order]").count()) === 1, "found by phone");
    const href = await owner.locator("[data-testid=export]").getAttribute("href");
    const res = await owner.request.get(`${BASE}${href}`);
    const csv = await res.text();
    expect(res.status() === 200 && csv.startsWith("﻿") && csv.includes(String(c.number)) && csv.includes("مصباح ×1"), "CSV of the tab");
  });

  await step("new order: products, customer, desk pickup with its fee", async () => {
    await owner.goto(orders);
    await owner.click("[data-testid=new-order]");
    const dialog = owner.locator("[data-testid=new-order-dialog]");
    await dialog.locator("[data-testid=pick-product]").selectOption(lamp);
    await dialog.locator("[data-testid=add-product]").click();
    await dialog.locator("[data-testid=line-qty]").fill("2");
    await dialog.locator("#customerName").fill("سليم");
    await dialog.locator("#phone").fill("0550 12 34 56");
    await dialog.locator("#wilayaCode").selectOption("16");
    await dialog.locator("#commune option[value='Kouba']").waitFor({ state: "attached" });
    await dialog.locator("#commune").selectOption("Kouba");
    await dialog.locator("[data-delivery=office]").click();
    expect((await dialog.locator("[data-testid=order-fee]").inputValue()) === "300", "desk fee from the rates");
    await dialog.locator("[data-testid=save-order]").click();
    await dialog.waitFor({ state: "hidden" });
    const [[o]] = await db.query("SELECT * FROM orders WHERE shop_id = ? AND phone = '0550123456'", [shopId]);
    expect(o.status === "pending" && o.total === 4300 && o.delivery_type === "office" && o.shipping_price === 300, `created (got ${o.status} ${o.total})`);
    const [[p]] = await db.query("SELECT stock FROM products WHERE id = ?", [lamp]);
    expect(p.stock === 8, "stock taken");
  });

  await step("order page: lines and the automatic assignment; saving recomputes the total", async () => {
    await owner.goto(`${orders}/${a.id}`);
    await owner.locator("[data-testid=auto-assign]").getByText("لم يُسند لأي موظف").waitFor();
    await owner.locator("[data-testid=line-qty]").fill("3");
    await owner.fill("[data-testid=order-total-input]", "");
    await owner.click("[data-testid=save-order]");
    await owner.getByText("تم الحفظ").waitFor();
    const o = await statusOf(a.id);
    expect(o.subtotal === 6000 && o.total === 6300, `3 × 2000 + 300 desk (got ${o.subtotal} / ${o.total})`);
  });

  await step("bulk status: the selection is cancelled in one go", async () => {
    await owner.goto(`${orders}?status=confirmed`);
    await owner.locator("[data-testid=select-all]").click();
    await owner.locator("[data-testid=bulk-status] select").selectOption("cancelled");
    await owner.click("[data-testid=bulk-status-apply]");
    await owner.getByText("لا توجد طلبات هنا").waitFor();
    expect((await statusOf(b.id)).status === "cancelled" && (await statusOf(c.id)).status === "cancelled", "both cancelled");
  });

  await step("scan: dispatch a confirmed order, recuperate a parcel, refuse the rest", async () => {
    number = 5000; // after the orders created from the dashboard
    const e = await order("confirmed", "0661000005");
    await owner.goto(`${dash}/scan`);
    const scan = async (code) => {
      const before = await owner.locator("[data-scan]").count();
      await owner.fill("[data-testid=scan-code]", code);
      await owner.click("[data-testid=scan-submit]");
      await owner.waitForFunction((n) => document.querySelectorAll("[data-scan]").length > n, before);
      return owner.locator("[data-scan]").first().getAttribute("data-scan");
    };
    expect((await scan(`#${e.number}`)) === "ok", "dispatched");
    expect((await statusOf(e.id)).status === "in_transit", "in transit");
    expect((await scan(String(e.number))) === "failed", "already dispatched");
    expect((await scan(String(a.number))) === "failed", "a pending order cannot leave");
    await owner.locator("[data-mode=recuperate]").click();
    expect((await scan("YAL-777")) === "ok", "recuperated by tracking number");
    const [[s]] = await db.query("SELECT o.status, sh.return_received_at AS at FROM orders o JOIN shipments sh ON sh.order_id = o.id WHERE o.id = ?", [d.id]);
    expect(s.status === "returned" && s.at !== null, "returned and received");
    expect((await owner.locator("[data-testid=scan-done]").innerText()).includes("2") && (await owner.locator("[data-testid=scan-failed]").innerText()).includes("2"), "counters");
  });

  await step("old order addresses open the matching tab", async () => {
    await owner.goto(`${orders}/shipping`);
    await owner.waitForURL(/orders\?status=confirmed/);
  });

  await context.close();
}
