// Phase 24 (owner round 8): the orders lists as one row of chips per sub-section, the owner's statuses (Statut de la
// commande, Injection, Livraison, Remarque, Traitement, Livraison finale) flowing list → send → tracking → returns, the
// courier's stage names, Order analysis merged into Analytics, more protection options, richer product offers, the store
// design preview that scrolls, the 11 landing page angles (automatic / chosen) and the admin plans matching the
// subscription page.
import { randomUUID } from "node:crypto";
import { BASE, createShop, db, expect, step, wizardGenerate } from "./helpers.mjs";
import { requests } from "./mock-openai.mjs";

const json = (v) => (typeof v === "string" ? JSON.parse(v) : v);

export default async function phase24(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  const dash = `${BASE}/ar/dashboard`;
  const store = `${BASE}/store/shop-${tag}`;
  const lamp = randomUUID();
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'مصباح', 'lamp', 2000, '[]', '[]', '[]')", [lamp, shopId]);

  let number = 7000;
  const order = async ({ status, phone = "0661000000" }) => {
    const id = randomUUID();
    number++;
    await db.query(
      "INSERT INTO orders (id, shop_id, number, customer_name, phone, wilaya_code, commune, delivery_type, subtotal, shipping_price, total, status, delivery_state) VALUES (?, ?, ?, 'زبون', ?, 16, 'Kouba', 'home', 2000, 400, 2400, ?, ?)",
      [id, shopId, number, phone, status, ["shipped", "delivered", "returned"].includes(status) ? status : null],
    );
    await db.query("INSERT INTO order_items (id, shop_id, order_id, product_id, name, quantity, unit_price, total) VALUES (?, ?, ?, ?, 'مصباح', 1, 2000, 2000)", [randomUUID(), shopId, id, lamp]);
    return { id, number };
  };
  const parcel = (orderId, stage) => db.query("INSERT INTO shipments (id, shop_id, order_id, carrier_name, tracking_number, status) VALUES (?, ?, ?, 'Yalidine', ?, ?)", [randomUUID(), shopId, orderId, `YAL-${number}`, stage]);
  const statusOf = async (id) => (await db.query("SELECT status, delivery_state AS state, delivery_fault AS fault, processing FROM orders WHERE id = ?", [id]))[0][0];

  await step("orders list: one row of chips with the owner's statuses (no second list)", async () => {
    await order({ status: "callback" });
    await order({ status: "voicemail" });
    await order({ status: "duplicate" });
    await owner.goto(`${dash}/orders`);
    expect((await owner.locator("[data-testid=order-chips]").count()) === 1 && !(await owner.locator("[data-testid=order-views]").count()), "a single list of chips");
    const chips = await owner.locator("[data-testid=order-chips] [data-chip]").evaluateAll((els) => els.map((e) => e.dataset.chip));
    expect(
      chips.join() === "all,new,confirmed,callback,no_answer,voicemail,remark,cancelled,fake,wrong_number,duplicate,shipped,delivered,returned,risk",
      `chips in the owner's order (got ${chips.join()})`,
    );
    await owner.locator("[data-testid=order-chips] [data-chip=voicemail]").click();
    await owner.waitForURL(/status=voicemail/);
    expect((await owner.locator("tr[data-order]").count()) === 1, "filtered by status");
    expect((await owner.locator("[data-testid=order-chips] [data-chip=callback]").innerText()).includes("إعادة الاتصال"), "Rappel = إعادة الاتصال");
  });

  await step("status picker: the call's outcome only; fake orders block the phone when Protection says so", async () => {
    await db.query("UPDATE shops SET protection = JSON_OBJECT('autoBlockFake', 1) WHERE id = ?", [shopId]);
    const o = await order({ status: "new", phone: "0770123456" });
    await owner.goto(`${dash}/orders/${o.id}`);
    const buttons = await owner.locator("[data-testid=status-picker] button").evaluateAll((els) => els.map((e) => e.dataset.status));
    expect(buttons.join() === "new,confirmed,callback,no_answer,voicemail,remark,cancelled,fake,wrong_number,duplicate", `call statuses (got ${buttons.join()})`);
    await owner.click('[data-testid=status-picker] button[data-status="fake"]');
    await owner.waitForSelector('[data-testid=status-picker] button[aria-pressed=true][data-status="fake"]');
    const [[blocked]] = await db.query("SELECT COUNT(*) AS n FROM blocked_phones WHERE shop_id = ? AND phone = '0770123456'", [shopId]);
    expect(blocked.n === 1, "phone blocked after the fake order");
  });

  await step("send to couriers: Not injected yet / Injected", async () => {
    const c = await order({ status: "confirmed" });
    const s = await order({ status: "shipped" });
    await parcel(s.id, "ready");
    await owner.goto(`${dash}/orders/shipping`);
    const chips = owner.locator("[data-testid=order-chips]");
    expect((await chips.locator("[data-chip]").evaluateAll((els) => els.map((e) => e.dataset.chip))).join() === "pending,done", "injection chips");
    await owner.locator(`tr[data-order="${c.number}"]`).waitFor();
    expect(!(await owner.locator(`tr[data-order="${s.number}"]`).count()), "the sent one is not in « not injected »");
    await chips.locator("[data-chip=done]").click();
    await owner.waitForURL(/inj=done/);
    await owner.locator(`tr[data-order="${s.number}"]`).waitFor();
    expect(!(await owner.locator(`tr[data-order="${c.number}"]`).count()), "injected only");
  });

  await step("delivery follow-up: postponed, the fault, then returned → in Returns, sent again → Traitement « Injectée »", async () => {
    const o = await order({ status: "shipped" });
    await parcel(o.id, "suspended");
    await owner.goto(`${dash}/orders/${o.id}`);
    const card = owner.locator("[data-testid=follow-up-card]");
    expect((await card.locator("[data-testid=injection]").innerText()) === "تم الإدخال", "injected");
    expect(await owner.locator('[data-testid=status-picker] button[data-status="cancelled"]').isDisabled(), "call statuses wait while a parcel exists");
    await card.locator("select[data-followup=state]").selectOption("postponed");
    await expectSoon(async () => (await statusOf(o.id)).state === "postponed", "Livraison = Reportée");
    await card.locator("select[data-followup=fault]").selectOption("customer");
    await expectSoon(async () => (await statusOf(o.id)).fault === "customer", "Remarque = Erreur du client");
    // The tracking list shows the follow-up next to the courier's stage
    await owner.goto(`${dash}/orders/tracking?ds=postponed`);
    await owner.locator(`tr[data-order="${o.number}"] [data-ds=postponed]`).waitFor();
    // Delivery = returned closes the order like the courier would
    await owner.goto(`${dash}/orders/${o.id}`);
    await owner.locator("[data-testid=follow-up-card] select[data-followup=state]").selectOption("returned");
    await expectSoon(async () => (await statusOf(o.id)).status === "returned", "order returned");
    await owner.reload();
    expect((await owner.locator("[data-testid=final-delivery]").innerText()) === "مرتجع", "Livraison finale = Retour");
    await owner.goto(`${dash}/orders/returns`);
    await owner.locator(`tr[data-order="${o.number}"]`).waitFor();
    owner.once("dialog", (d) => d.accept());
    await owner.locator(`tr[data-order="${o.number}"] input[data-bulk-order]`).check();
    await owner.locator("[data-testid=return-resend]").click();
    await owner.locator("[data-testid=batch-report] [data-result=ok]").waitFor();
    const after = await statusOf(o.id);
    expect(after.status === "confirmed" && after.processing === "reinjected" && after.state === null, `back to send, Traitement = Injectée (got ${JSON.stringify(after)})`);
    const [[event]] = await db.query("SELECT COUNT(*) AS n FROM order_events WHERE order_id = ? AND type = 'followup'", [o.id]);
    expect(event.n >= 2, "follow-up changes in the history");
  });

  await step("parcel tracking: the 13 courier stages with their own names", async () => {
    await owner.goto(`${dash}/orders/tracking`);
    const chips = owner.locator("[data-testid=order-chips] [data-chip]");
    expect((await chips.count()) === 14, "all + 13 stages");
    const text = await owner.locator("[data-testid=order-chips]").innerText();
    for (const name of ["Prêt à expédier", "En ramassage", "Vers Station", "En Station", "Vers Wilaya", "En preparation", "En livraison", "Suspendus", "Livrés", "Retours", "Colis Supprimés", "Colis Annulés", "Colis à supprimer"])
      expect(text.includes(name), `stage ${name}`);
  });

  await step("analytics: the order analysis is here, with the delivery follow-up", async () => {
    const p = await order({ status: "shipped" });
    await db.query("UPDATE orders SET delivery_state = 'postponed' WHERE id = ?", [p.id]);
    await owner.goto(`${dash}/orders/insights`);
    await owner.waitForURL(/\/dashboard\/analytics$/);
    await owner.locator("[data-testid=insight-kpis] [data-kpi=refusal]").waitFor();
    expect((await owner.locator("[data-testid=follow-up] [data-state=postponed]").innerText()).includes("1"), "postponed parcels");
    await owner.goto(`${dash}/orders`);
    expect(!(await owner.locator("[data-testid=section-tabs]").innerText()).includes("تحليل الطلبات"), "no Order analysis tab");
  });

  await step("protection: blocked words, wilayas not served, most pieces per order", async () => {
    await owner.goto(`${dash}/orders/protection`);
    await owner.fill("#pr-blockedWords", "test\nfake");
    await owner.locator('[data-testid=blocked-wilayas] input[value="31"]').check();
    await owner.fill("#pr-maxQuantity", "3");
    await owner.fill("#pr-maxPerPhonePerWeek", "20");
    await owner.locator("[data-testid=protection-form] button[type=submit]").click();
    await owner.waitForSelector("text=تم الحفظ");
    const [[row]] = await db.query("SELECT protection FROM shops WHERE id = ?", [shopId]);
    const pr = json(row.protection);
    expect(pr.blockedWords.join() === "test,fake" && pr.blockedWilayas.join() === "31" && pr.maxQuantity === 3 && pr.maxPerPhonePerWeek === 20, `saved (got ${JSON.stringify(pr)})`);
    // The store refuses an order from a wilaya the store does not serve
    const p = await browser.newPage();
    await p.goto(`${store}/p/lamp`);
    await p.fill("#name", "زبون وهران");
    await p.fill("#phone", "0661 55 44 33");
    await p.selectOption("#wilaya", "31");
    await p.waitForSelector("#commune option[value='Es Senia']", { state: "attached" });
    await p.selectOption("#commune", "Es Senia");
    await p.waitForTimeout(4500); // a human fills the form in more than a few seconds
    await p.locator("button[type=submit]").click({ force: true });
    await p.waitForSelector("text=التوصيل غير متوفر لهذه الولاية حالياً");
    await p.close();
    await db.query("UPDATE shops SET protection = NULL WHERE id = ?", [shopId]);
  });

  await step("offers: a ready-made offer with free delivery, a badge and preselected; the store and the order honour it", async () => {
    await owner.goto(`${dash}/products/${lamp}`);
    await owner.locator('[data-testid=offer-templates] button[data-template="2-10"]').click();
    const offer = owner.locator("[data-testid=offers] [data-offer='2']");
    await offer.locator("[data-testid=offer-free-shipping]").check();
    await offer.locator("[data-testid=offer-preselected]").check();
    await offer.locator("select").selectOption("bestSeller");
    await offer.locator('input[aria-label="هدية مع العرض (اختياري)"]').fill("حافظة مجانية");
    await owner.locator("button[type=submit]").first().click();
    await expectSoon(async () => json((await db.query("SELECT offers FROM products WHERE id = ?", [lamp]))[0][0].offers).length === 1, "offer saved");
    const [[p]] = await db.query("SELECT offers FROM products WHERE id = ?", [lamp]);
    const [saved] = json(p.offers);
    expect(saved.quantity === 2 && saved.price === 3600 && saved.freeShipping && saved.preselected && saved.badge === "bestSeller" && saved.gift === "حافظة مجانية", `offer saved (got ${JSON.stringify(saved)})`);
    await db.query("INSERT INTO shipping_rates (shop_id, wilaya_code, home_price, office_price) VALUES (?, 16, 500, 300)", [shopId]);
    const page = await browser.newPage();
    await page.goto(`${store}/p/lamp`);
    const card = page.locator("[data-offer-card='2']");
    expect(await card.locator("input[type=radio]").isChecked(), "preselected");
    expect((await card.locator("[data-testid=offer-badge]").innerText()) === "الأكثر طلباً" && (await card.locator("[data-testid=offer-free-shipping]").count()) && (await card.locator("[data-testid=offer-gift]").innerText()).includes("حافظة مجانية"), "badge, free delivery and gift on the card");
    await page.fill("#name", "زبون العرض");
    await page.fill("#phone", "0661 22 33 45");
    await page.selectOption("#wilaya", "16");
    await page.waitForSelector("#commune option[value='Kouba']", { state: "attached" });
    await page.selectOption("#commune", "Kouba");
    await page.waitForTimeout(4500);
    await Promise.all([page.waitForURL(/\/thanks\?o=/), page.locator("button[type=submit]").click({ force: true })]);
    const [[o]] = await db.query("SELECT o.shipping_price AS ship, o.subtotal, i.offer_label AS label FROM orders o JOIN order_items i ON i.order_id = o.id WHERE o.id = ?", [new URL(page.url()).searchParams.get("o")]);
    expect(o.ship === 0 && o.subtotal === 3600 && o.label.includes("حافظة مجانية"), `free delivery and the gift on the order (got ${JSON.stringify(o)})`);
    await page.close();
  });

  await step("store design: the live preview scrolls", async () => {
    await owner.goto(`${dash}/store-design`);
    const preview = owner.locator("[data-testid=design-preview]");
    await preview.hover();
    await owner.mouse.wheel(0, 600);
    await owner.waitForTimeout(400);
    expect((await preview.evaluate((el) => el.scrollTop)) > 0, "the wheel scrolls the preview");
  });

  await step("landing pages: the 11 angles, chosen by hand", async () => {
    await owner.goto(`${dash}/landing-pages/new`);
    expect((await owner.locator("[data-testid=angle-mode] button[aria-pressed=true]").innerText()).includes("تلقائي"), "automatic by default");
    await owner.locator("[data-testid=angle-mode] button").nth(1).click();
    expect((await owner.locator("[data-testid=angle-picker] [data-angle-key]").count()) === 11, "the 11 angles");
    expect(await owner.locator("[data-testid=ai-next]").isDisabled(), "at least one angle");
    await owner.locator('[data-angle-key="offer"]').check();
    await owner.locator('[data-angle-key="problem"]').check();
    await owner.selectOption("#ai-count", "2");
    await wizardGenerate(owner);
    await owner.waitForURL(/landing-pages\/[0-9a-f-]{36}$/, { timeout: 90_000 });
    const plan = requests.filter((r) => r.text?.format?.name === "image_landing_page").pop();
    expect(plan?.instructions.includes("The merchant chose these angles: problem, offer."), "the chosen angles, in the library's order, in the prompt");
    const [[page]] = await db.query("SELECT strategy FROM landing_pages WHERE id = ?", [owner.url().split("/").pop()]);
    const strategy = json(page.strategy);
    expect(strategy.mode === "manual" && strategy.angles.map((a) => a.key).join() === "problem,offer", `only the chosen angles (got ${JSON.stringify(strategy.angles)})`);
  });

  await step("platform admin: the plans are the subscription page's plans", async () => {
    await db.query("UPDATE users SET is_platform_admin = 1 WHERE id = (SELECT owner_id FROM shops WHERE id = ?)", [shopId]);
    await owner.goto(`${BASE}/ar/admin/plans`);
    const [[active]] = await db.query("SELECT COUNT(*) AS n FROM plans WHERE is_active = 1");
    const shown = await owner.locator("[data-testid=admin-plans] > *").count();
    expect(shown === active.n, `${shown} plans shown, ${active.n} offered`);
    await db.query("UPDATE users SET is_platform_admin = 0 WHERE id = (SELECT owner_id FROM shops WHERE id = ?)", [shopId]);
  });

  await context.close();
}

async function expectSoon(check, message, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  expect(false, message);
}
