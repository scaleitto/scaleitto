// Phase 22 (owner round 6): forgotten password by email, communes chosen from the wilaya's list, color options shown as
// swatches, the Order form section (WEBI-style builder: order, show/hide, labels, popup, WhatsApp, delivery labels,
// thank-you) used by the store's product pages, and the store's own theme adjustments.
import { randomUUID } from "node:crypto";
import { BASE, createShop, db, expect, step } from "./helpers.mjs";
import { lastLink } from "./mock-apps.mjs";

const json = (v) => (typeof v === "string" ? JSON.parse(v) : v);

export default async function phase22(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  const email = `owner-${tag}@test.dz`;
  const store = `${BASE}/store/shop-${tag}`;
  await db.query("UPDATE shops SET phone = '0555 11 22 33' WHERE id = ?", [shopId]);
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'مصباح', 'lamp', 2000, '[]', '[]', '[]')", [randomUUID(), shopId]);

  await step("communes: choosing a wilaya lists its communes (Arabic names, Latin value)", async () => {
    const p = await browser.newPage();
    await p.goto(`${store}/p/lamp`);
    expect(await p.locator("#commune").isDisabled(), "no commune before the wilaya");
    await p.selectOption("#wilaya", "31");
    await p.waitForSelector("#commune option[value='Es Senia']", { state: "attached" });
    const labels = await p.locator("#commune option").allInnerTexts();
    expect(labels.includes("السانية") && labels.includes("بئر الجير") && !labels.includes("القبة"), "Oran's communes only, in Arabic");
    await p.selectOption("#wilaya", "16");
    await p.waitForSelector("#commune option[value='Kouba']", { state: "attached" });
    expect((await p.inputValue("#commune")) === "", "another wilaya empties the choice");
    await p.close();
  });

  await step("product colors: a color option with palette swatches, shown as swatches in the store", async () => {
    await owner.goto(`${BASE}/ar/dashboard/products/new`);
    await owner.fill("#name", "حقيبة");
    await owner.fill("#price", "3000");
    await owner.click("[data-testid=add-color-option]");
    const palette = owner.locator("[data-testid=color-palette]");
    await palette.locator('button[aria-label="أسود"]').click();
    await palette.locator('button[aria-label="أحمر"]').click();
    await Promise.all([owner.waitForURL("**/products?created=1"), owner.locator("button[type=submit]").first().click()]);
    const [[p]] = await db.query("SELECT slug, options FROM products WHERE shop_id = ? AND name = 'حقيبة'", [shopId]);
    const [color] = json(p.options);
    expect(color.kind === "color" && color.values.join() === "أسود,أحمر" && color.colors["أحمر"] === "#dc2626", `color option saved (got ${JSON.stringify(color)})`);
    const page = await browser.newPage();
    await page.goto(`${store}/p/${encodeURIComponent(p.slug)}`);
    const swatch = page.locator('button[aria-label="أحمر"]');
    expect((await swatch.evaluate((el) => getComputedStyle(el).backgroundColor)) === "rgb(220, 38, 38)", "red swatch");
    await swatch.click();
    expect((await page.locator("legend", { hasText: "أحمر" }).count()) > 0, "chosen color named beside the title");
    await page.close();
  });

  await step("order form section: order, hide, labels, popup, WhatsApp, delivery names, thank-you", async () => {
    await owner.goto(`${BASE}/ar/dashboard/store-design/order-form`);
    await owner.waitForSelector("[data-testid=form-editor]");
    // Phone above the name, note hidden, the name renamed
    await owner.click('[data-element=phone] button[aria-label^="إلى الأعلى"]');
    await owner.click("[data-element=note] [data-testid=element-visibility]");
    await owner.click("[data-element=name] [data-testid=element-settings]");
    await owner.fill('input[aria-label="عنوان الحقل الاسم الكامل"]', "اسمك ولقبك");
    await owner.click("[data-testid=appearance-popup]");
    await owner.click("[data-testid=form-tab-settings]");
    await owner.check("[data-testid=form-whatsapp]");
    await owner.selectOption('select[aria-label="حركة زر الطلب"]', "pulse");
    await owner.click("[data-testid=form-tab-delivery]");
    await owner.fill('input[aria-label="اسم التوصيل للمكتب"]', "استلام من المكتب");
    await owner.locator("[data-testid=form-editor] label", { hasText: "استلام من المكتب" }).click();
    await owner.click("[data-testid=form-tab-thanks]");
    await owner.fill('textarea[aria-label="رسالة بعد الطلب (اختياري)"]', "شكراً، سنتصل بك قريباً");
    // The preview follows the changes
    const preview = owner.locator("[data-testid=order-form-preview]");
    expect((await preview.locator("label[for=name]").innerText()) === "اسمك ولقبك", "preview shows the new label");
    await owner.click("[data-testid=save-order-form]");
    await owner.waitForSelector("text=تم الحفظ");
    const [[row]] = await db.query("SELECT order_form FROM shops WHERE id = ?", [shopId]);
    const form = json(row.order_form);
    expect(form.order.indexOf("phone") < form.order.indexOf("name") && !form.note && form.appearance === "popup" && form.whatsapp, "form saved");
    expect(form.labels.name.label === "اسمك ولقبك" && form.officeLabel === "استلام من المكتب" && form.preferDelivery === "office", "labels saved");
  });

  await step("the store's product page uses that form (popup, order, WhatsApp) and its thank-you message", async () => {
    const p = await browser.newPage();
    await p.goto(`${store}/p/lamp`);
    expect(await p.locator("[data-testid=order-overlay]").isHidden(), "form closed behind its button");
    await p.click("[data-testid=open-order-form]", { force: true }); // the button pulses (never "stable")
    await p.waitForSelector("[data-testid=order-overlay][data-kind=popup] #name");
    const keys = await p.locator("#order-form-fields [data-element]").evaluateAll((els) => els.map((e) => e.dataset.element));
    expect(keys.indexOf("phone") < keys.indexOf("name") && !keys.includes("note"), `fields in the merchant's order (got ${keys.join()})`);
    expect((await p.locator("label[for=name]").innerText()) === "اسمك ولقبك", "own label");
    expect(await p.locator("[data-testid=whatsapp-order]").count(), "WhatsApp order button");
    expect((await p.locator("input[name=deliveryType][value=office]").isChecked()) && (await p.locator("text=استلام من المكتب").count()), "office first, with its own name");
    await p.click("[data-testid=close-order-form]");
    await p.click("[data-testid=open-order-form]", { force: true }); // the button pulses (never "stable")
    await p.fill("#name", "زبون الاستمارة");
    await p.fill("#phone", "0661 22 33 44");
    await p.selectOption("#wilaya", "16");
    await p.selectOption("#commune", "Hydra");
    await Promise.all([p.waitForURL(/\/thanks\?o=/), p.locator("#order-form-fields button[type=submit]").click({ force: true })]);
    expect((await p.locator("[data-testid=thank-you-message]").innerText()).includes("شكراً، سنتصل بك قريباً"), "store thank-you message");
    const [[order]] = await db.query("SELECT commune, delivery_type FROM orders WHERE id = ?", [new URL(p.url()).searchParams.get("o")]);
    expect(order.commune === "Hydra" && order.delivery_type === "office", "order saved");
    await p.close();
  });

  await step("store design: own font, corners and columns over the theme, floating WhatsApp", async () => {
    await owner.goto(`${BASE}/ar/dashboard/store-design`);
    await owner.selectOption("#styleFont", "changa");
    await owner.selectOption("#styleCorners", "round");
    await owner.selectOption("#styleColumns", "3");
    await owner.fill("#whatsapp", "0555 66 77 88");
    await owner.locator("label", { hasText: "زر واتساب عائم" }).click();
    await owner.locator("button[type=submit]", { hasText: "حفظ" }).last().click();
    await owner.waitForSelector("text=تم الحفظ");
    const [[row]] = await db.query("SELECT design FROM shops WHERE id = ?", [shopId]);
    const design = json(row.design);
    expect(design.style.font === "changa" && design.style.corners === "round" && design.style.columns === 3 && design.floatingWhatsapp, `design saved (got ${JSON.stringify(design.style)})`);
    const p = await browser.newPage();
    await p.goto(store);
    const frame = p.locator("[data-testid=store-frame]").first();
    const style = await frame.getAttribute("style");
    expect(style.includes("--font-changa") && style.includes("--s-radius-btn:999px"), `theme adjusted (got ${style})`);
    expect((await p.locator("[data-testid=floating-whatsapp]").getAttribute("href")) === "https://wa.me/213555667788", "floating WhatsApp");
    await p.close();
  });

  await step("forgotten password: the email link sets a new password and signs in (last: it ends the owner's other sessions)", async () => {
    const p = await browser.newPage();
    await p.goto(`${BASE}/ar/forgot`);
    await p.fill("#email", email);
    await p.click("button[type=submit]");
    await p.waitForSelector("[data-testid=forgot-sent]");
    const link = lastLink(email);
    expect(link?.includes("/ar/reset?token="), `reset link sent (got ${link})`);
    await p.goto(link.replace(/^https?:\/\/[^/]+/, BASE));
    await p.fill("#password", "NewPass-2026");
    await Promise.all([p.waitForURL(/\/ar\/dashboard/), p.click("button[type=submit]")]);
    // The link works once
    await p.goto(link.replace(/^https?:\/\/[^/]+/, BASE));
    await p.fill("#password", "Other-Pass-2026");
    await p.click("button[type=submit]");
    await p.waitForSelector("text=انتهت صلاحية الرابط");
    // The new password logs in
    const fresh = await browser.newContext();
    const login = await fresh.newPage();
    await login.goto(`${BASE}/ar/login`);
    await login.fill("#email", email);
    await login.fill("#password", "NewPass-2026");
    await Promise.all([login.waitForURL(/\/ar\/dashboard/), login.click("button[type=submit]")]);
    await fresh.close();
    await p.close();
  });

  await context.close();
}
