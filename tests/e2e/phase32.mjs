// Phase 32 (Zimam parity): Apps — the "Apps & Integrations" grid (Zimam's 19 apps + our webhook; not built ones shown as
// coming) and each built app's page, checked against the storefront: abandoned orders switch, fake-order guard (on / off),
// agent assignment mode, blacklist (numbers and IP addresses), trust badges, quick contact buttons, thank-you page,
// QR codes, parcel scanner switch; roles and tenant isolation.
import { randomUUID } from "node:crypto";
import { BASE, BROWSER_ARGS, createSession, createShop, db, expect, step, until } from "./helpers.mjs";

const json = (v) => (typeof v === "string" ? JSON.parse(v) : v);

export default async function phase32(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  const dash = `${BASE}/ar/dashboard`;
  const apps = `${dash}/integrations/apps`;
  const store = `${BASE}/store/shop-${tag}`;
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'مصباح', 'lamp', 2000, '[]', '[]', '[]')", [randomUUID(), shopId]);
  await db.query("INSERT INTO shipping_rates (shop_id, wilaya_code, home_price, office_price) VALUES (?, 16, 500, 400)", [shopId]);
  const save = async () => {
    await owner.click("[data-testid=app-save]");
    await owner.waitForSelector("text=تم الحفظ.");
  };
  const shopApps = async () => json((await db.query("SELECT apps FROM shops WHERE id = ?", [shopId]))[0][0].apps) ?? {};
  const customer = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: BROWSER_ARGS[0].replace("--user-agent=", "") });
  const buyer = await customer.newPage();
  const order = async (phone) => {
    await buyer.goto(`${store}/p/lamp`);
    await buyer.waitForSelector("button[type=submit]");
    await buyer.fill("#name", "سليم بن عمر");
    await buyer.fill("#phone", phone);
    await buyer.selectOption("#wilaya", "16");
    await buyer.selectOption("#commune", "حيدرة");
    // Robots are refused when a form is sent too fast
    await buyer.waitForTimeout(4200);
    await buyer.click("button[type=submit]");
  };

  await step("Apps & Integrations: Zimam's apps in order, built ones open, the rest coming", async () => {
    await owner.goto(apps);
    const cards = await owner.locator("[data-app-card]").evaluateAll((els) => els.map((e) => `${e.dataset.appCard}:${e.dataset.state}`));
    expect(cards.length === 20 && cards[0] === "whatsapp:soon" && cards[2] === "abandoned:on" && cards[3] === "fakeGuard:on" && cards.at(-1) === "webhook:off", `cards (got ${cards.join()})`);
    expect(cards.filter((c) => c.endsWith(":soon")).length === 3, "3 coming");
    expect(!(await owner.locator("[data-app-card=cart] a").count()), "a coming app has no link");
    expect(cards.includes("quickContact:off") && cards.includes("trustBadges:on") && cards.includes("parcelScanner:on") && cards.includes("blacklist:none") && cards.includes("orderTracking:on"), "states");
    await Promise.all([owner.waitForURL(/apps\/abandoned$/), owner.locator("[data-app-card=abandoned] [data-testid=app-open]").click()]);
    await owner.waitForSelector("text=رجوع إلى التطبيقات");
  });

  await step("abandoned orders: switched off, a buyer leaving the form leaves no draft; on again, the draft is kept", async () => {
    await owner.locator("[data-testid=app-enabled]").uncheck();
    await save();
    expect((await shopApps()).abandoned === false, "saved off");
    await buyer.goto(`${store}/p/lamp`);
    await buyer.waitForSelector("button[type=submit]");
    await buyer.fill("#name", "زبون متردد");
    await buyer.fill("#phone", "0555 77 88 99");
    await buyer.locator("#name").focus();
    await buyer.waitForTimeout(1500);
    const drafts = async () => (await db.query("SELECT COUNT(*) n FROM orders WHERE shop_id = ? AND status = 'abandoned'", [shopId]))[0][0].n;
    expect((await drafts()) === 0, "no draft while off");
    await owner.locator("[data-testid=app-enabled]").check();
    await save();
    await buyer.reload();
    await buyer.waitForSelector("button[type=submit]");
    await buyer.fill("#name", "زبون متردد");
    await buyer.fill("#phone", "0555 77 88 99");
    await buyer.locator("#name").focus();
    await until(async () => (await drafts()) === 1, "draft kept once on");
  });

  await step("thank-you page and trust badges set from their apps", async () => {
    await owner.goto(`${apps}/thankYou`);
    await owner.fill("#th-title", "شكراً جزيلاً!");
    await owner.fill("#th-message", "نتصل بك على {phone} خلال ساعة.");
    await owner.fill("#th-button", "شاهد المنتج مرة أخرى");
    await owner.selectOption("#th-redirect", "product");
    expect((await owner.locator("[data-testid=thanks-preview]").textContent()).includes("شكراً جزيلاً!"), "live preview");
    await save();
    await owner.goto(`${apps}/trustBadges`);
    await owner.locator("[data-testid=badge-guarantee]").check();
    await owner.fill("#b-guarantee-title", "ضمان سنة كاملة");
    await owner.locator("[data-testid=badge-payment]").uncheck();
    expect((await owner.locator("[data-testid=badges-preview]").textContent()).includes("ضمان سنة كاملة"), "preview follows");
    await save();
    await buyer.goto(`${store}/p/lamp`);
    const badges = await buyer.locator("[data-testid=badges] [data-badge]").evaluateAll((els) => els.map((e) => e.dataset.badge));
    expect(badges.join() === "guarantee,delivery", `badges on the product page (got ${badges.join()})`);
    expect((await buyer.locator("[data-badge=guarantee]").textContent()).includes("ضمان سنة كاملة"), "custom title");
  });

  await step("fake-order guard: one order per number refuses the second; switched off, it is accepted; thank-you page as set", async () => {
    await owner.goto(`${apps}/fakeGuard`);
    await owner.selectOption("#g-per-phone", "1");
    await owner.fill("#g-words", "تجربة\nfake");
    // The limit is checked, not the repeat rule (same phone + same product)
    await owner.locator("input[name=blockDuplicates]").uncheck();
    await save();
    const guard = json((await db.query("SELECT protection FROM shops WHERE id = ?", [shopId]))[0][0].protection);
    expect(guard.enabled === true && guard.maxPerPhonePerDay === 1 && guard.blockDuplicates === false && guard.blockedWords.join() === "تجربة,fake", "guard saved");
    await order("0661 22 33 44");
    await buyer.waitForURL(/\/thanks\?o=/);
    expect((await buyer.locator("[data-testid=thanks-title]").textContent()) === "شكراً جزيلاً!", "custom title");
    expect((await buyer.locator("[data-testid=thanks-body]").textContent()).includes("0661223344 خلال ساعة"), "message with the phone");
    const button = buyer.locator("[data-testid=thanks-button]");
    expect((await button.textContent()) === "شاهد المنتج مرة أخرى" && (await button.getAttribute("href")).endsWith("/p/lamp"), "button back to the product");
    await order("0661 22 33 44");
    await buyer.waitForSelector("text=لقد أرسلت عدة طلبات");
    await owner.locator("[data-testid=app-enabled]").uncheck();
    await save();
    expect(json((await db.query("SELECT protection FROM shops WHERE id = ?", [shopId]))[0][0].protection).maxPerPhonePerDay === 1, "settings kept while off");
    await order("0661 22 33 44");
    await buyer.waitForURL(/\/thanks\?o=/);
    await owner.locator("[data-testid=app-enabled]").check();
    await save();
  });

  await step("blacklist: a blocked number and connection cannot order; unblocking works", async () => {
    await owner.goto(`${apps}/blacklist`);
    await owner.fill("[data-testid=block-phone-input]", "0770 11 22 33");
    await owner.click("[data-testid=block-phone]");
    await owner.waitForSelector("[data-blocked-phone='0770112233']");
    await owner.fill("[data-testid=block-ip-input]", "not-an-ip");
    await owner.click("[data-testid=block-ip]");
    await owner.waitForSelector("text=عنوان IP غير صحيح");
    await owner.fill("[data-testid=block-ip-input]", "10.9.8.7");
    await owner.click("[data-testid=block-ip]");
    await owner.waitForSelector("[data-blocked-ip='10.9.8.7']");
    await order("0770 11 22 33");
    await buyer.waitForSelector("text=تعذر تسجيل الطلب");
    await owner.locator("[data-blocked-phone='0770112233'] button").click();
    await owner.waitForSelector("text=لا توجد أرقام محظورة.");
    await owner.locator("[data-blocked-ip='10.9.8.7'] button").click();
    await owner.waitForSelector("text=لا توجد عناوين IP محظورة.");
  });

  await step("quick contact buttons: a wrong number is refused, then the store shows both buttons", async () => {
    await owner.goto(`${apps}/quickContact`);
    await owner.locator("[data-testid=contact-whatsapp-on]").check();
    await owner.fill("#c-whatsapp", "123");
    await owner.click("[data-testid=app-save]");
    await owner.waitForSelector("text=رقم هاتف غير صحيح");
    await owner.fill("#c-whatsapp", "0555 66 77 88");
    await owner.locator("[data-testid=contact-phone-on]").check();
    await owner.fill("#c-phone", "0661 00 11 22");
    await save();
    await buyer.goto(store);
    expect((await buyer.locator("[data-testid=floating-whatsapp]").getAttribute("href")) === "https://wa.me/213555667788", "WhatsApp button");
    expect((await buyer.locator("[data-testid=floating-phone]").getAttribute("href")) === "tel:0661001122", "call button");
  });

  await step("order tracking: private link from the thank-you page, lookup by number + phone or phone only, switched off → not found", async () => {
    await order("0662 33 44 55");
    await buyer.waitForURL(/\/thanks\?o=/);
    const orderId = new URL(buyer.url()).searchParams.get("o");
    const [[row]] = await db.query("SELECT number FROM orders WHERE id = ?", [orderId]);
    await db.query("UPDATE orders SET status = 'confirmed' WHERE id = ?", [orderId]);
    await Promise.all([buyer.waitForURL(/\/track\?o=/), buyer.click("[data-testid=track-link]")]);
    const card = buyer.locator(`[data-tracked-order="${row.number}"]`);
    await card.waitFor();
    expect((await card.getAttribute("data-status")) === "confirmed" && (await card.locator("[data-step][data-done='1']").count()) === 2, "received + confirmed done");
    expect((await card.textContent()).includes("مرحباً سليم") && !(await card.textContent()).includes("بن عمر"), "first name only");
    expect((await buyer.locator("[data-testid=track-contact]").getAttribute("href")) === "https://wa.me/213555667788", "contact = quick contact WhatsApp");
    const token = new URL(buyer.url()).searchParams.get("k");
    await buyer.goto(`${store}/track?o=${orderId}&k=${token.slice(0, -2)}xx`);
    await buyer.locator("[data-testid=not-found]").waitFor();
    expect(!(await buyer.locator("[data-tracked-order]").count()), "a wrong key → not found");
    await buyer.goto(`${store}/track`);
    await buyer.fill("input[name=phone]", "0662334455");
    await buyer.click("[data-testid=track-form] button[type=submit]");
    await buyer.waitForSelector("[data-testid=track-message]");
    expect((await buyer.locator("[data-tracked-order]").count()) === 0, "number + phone required by default");
    await buyer.fill("input[name=number]", String(row.number));
    await buyer.click("[data-testid=track-form] button[type=submit]");
    await buyer.locator(`[data-tracked-order="${row.number}"]`).waitFor();
    await owner.goto(`${apps}/orderTracking`);
    await owner.locator("[data-testid=lookup-phone]").check();
    await owner.selectOption("#tr-contact", "phone");
    await owner.fill("#tr-number", "0661 99 88 77");
    await save();
    await buyer.goto(`${store}/track?phone=0662334455`);
    await buyer.locator(`[data-tracked-order="${row.number}"]`).waitFor();
    expect((await buyer.locator("[data-testid=track-contact]").getAttribute("href")) === "tel:0661998877", "the app's own number");
    await owner.locator("[data-testid=app-enabled]").uncheck();
    await save();
    await buyer.goto(`${store}/track`);
    await buyer.locator("[data-testid=not-found]").waitFor();
    await owner.locator("[data-testid=app-enabled]").check();
    await save();
  });

  await step("promotions: a campaign lowers the price in the store and in the order; ended, the price is back", async () => {
    await owner.goto(`${apps}/promotions`);
    await owner.fill("#pr-name", "تخفيضات نوفمبر");
    await owner.fill("#pr-percent", "25");
    await owner.locator("[data-product='مصباح'] input").check();
    await owner.fill("#pr-end", "2020-01-01T10:00");
    await owner.click("[data-testid=promotion-save]");
    await owner.waitForSelector("text=النهاية يجب أن تكون بعد البداية");
    expect((await owner.locator("[data-product='مصباح']").textContent()).replace(/\s/g, "").includes("1500"), "new price shown beside the product");
    await owner.fill("#pr-end", "2099-01-01T10:00");
    await owner.click("[data-testid=promotion-save]");
    await owner.waitForSelector("[data-campaign='تخفيضات نوفمبر'][data-state=running]");
    await buyer.goto(`${store}/p/lamp`);
    const page = (await buyer.locator("main").textContent()).replace(/\s/g, "");
    expect(page.includes("1500") && page.includes("2000"), "store: new price and old price struck through");
    await order("0663 44 55 66");
    await buyer.waitForURL(/\/thanks\?o=/);
    const [[o]] = await db.query("SELECT subtotal, total FROM orders WHERE id = ?", [new URL(buyer.url()).searchParams.get("o")]);
    expect(o.subtotal === 1500 && o.total === 2000, `order at the promotion price (got ${o.subtotal}/${o.total})`);
    await owner.goto(apps);
    expect((await owner.locator("[data-app-card=promotions]").getAttribute("data-state")) === "on", "grid: running");
    await owner.goto(`${apps}/promotions`);
    await owner.locator("[data-campaign='تخفيضات نوفمبر'] button", { hasText: "إنهاء الآن" }).click();
    await owner.waitForSelector("[data-campaign='تخفيضات نوفمبر'][data-state=ended]");
    await buyer.goto(`${store}/p/lamp`);
    expect(!(await buyer.locator("main").textContent()).replace(/\s/g, "").includes("1500"), "price back after the end");
  });

  await step("collections: created with a sub-collection, put on a product from its form, shown in the store; deleted cleanly", async () => {
    await owner.goto(`${apps}/collections`);
    await owner.fill("#col-handle", "Bad Handle");
    await owner.click("[data-testid=collection-save]");
    await owner.waitForSelector("text=حروف لاتينية صغيرة وأرقام وشرطات فقط");
    await owner.fill("#col-handle", "home");
    await owner.click("[data-testid=collection-save]");
    await owner.waitForSelector("text=اكتب عنواناً بلغة واحدة على الأقل");
    await owner.fill("#col-title-ar", "المنزل");
    await owner.fill("#col-desc-ar", "كل ما يحتاجه بيتك");
    await owner.click("[data-testid=collection-save]");
    await owner.waitForSelector("[data-collection=home]");
    await owner.fill("#col-handle", "lights");
    await owner.fill("#col-title-ar", "الإنارة");
    await owner.selectOption("#col-parent", { label: "المنزل" });
    await owner.click("[data-testid=collection-save]");
    await owner.waitForSelector("[data-collection=lights]");
    await owner.fill("#col-handle", "lights");
    await owner.fill("#col-title-ar", "مكرر");
    await owner.click("[data-testid=collection-save]");
    await owner.waitForSelector("text=هذا الاسم مستعمل في مجموعة أخرى");
    // the product joins the sub-collection from its own form
    const [[lamp]] = await db.query("SELECT id FROM products WHERE shop_id = ? AND slug = 'lamp'", [shopId]);
    await owner.goto(`${dash}/products/${lamp.id}`);
    await owner.waitForSelector("[data-testid=product-form][data-ready]");
    await owner.locator("[data-testid=product-collections] input[data-collection='الإنارة']").check();
    await owner.click("[data-testid=save-product]");
    await until(async () => JSON.stringify((await db.query("SELECT collection_ids FROM products WHERE id = ?", [lamp.id]))[0][0].collection_ids ?? "").length > 10, "product saved in the collection");
    await buyer.goto(store);
    await buyer.locator("[data-testid=store-collections] a", { hasText: "المنزل" }).click();
    await buyer.waitForURL(/\/collections\/home$/);
    expect((await buyer.locator("main").textContent()).includes("كل ما يحتاجه بيتك"), "description shown");
    expect((await buyer.locator("main a[href$='/p/lamp']").count()) > 0, "the parent shows its sub-collection's products");
    await buyer.locator("main nav a", { hasText: "الإنارة" }).click();
    await buyer.waitForURL(/\/collections\/lights$/);
    await owner.goto(`${apps}/collections`);
    owner.once("dialog", (d) => d.accept());
    await owner.locator("[data-collection=lights] [data-testid=collection-delete]").click();
    await owner.waitForSelector("[data-collection=lights]", { state: "detached" });
    const ids = (await db.query("SELECT collection_ids FROM products WHERE id = ?", [lamp.id]))[0][0].collection_ids;
    expect(!JSON.stringify(ids ?? []).includes("-"), "taken off the product");
  });

  await step("agent assignment mode and QR codes", async () => {
    await owner.goto(`${apps}/agentAssign`);
    await owner.locator("[data-testid=mode-manual]").check();
    await save();
    expect((await db.query("SELECT assign_mode FROM shops WHERE id = ?", [shopId]))[0][0].assign_mode === "manual", "manual mode");
    await owner.goto(`${apps}/qrCode`);
    await owner.selectOption("[data-testid=qr-type]", "product");
    await owner.waitForFunction(() => document.querySelector("[data-testid=qr-target]")?.textContent?.endsWith("/p/lamp"));
    await owner.waitForSelector("[data-testid=qr-image]");
    expect((await owner.locator("[data-testid=qr-download]").getAttribute("href")).startsWith("data:image/png"), "PNG to download");
    await owner.selectOption("[data-testid=qr-type]", "url");
    await owner.fill("#qr-url", "nope");
    await owner.waitForSelector("text=اختر وجهة صحيحة");
  });

  await step("rules: an agent rule gives a product's orders to its agent (even in manual mode), a delivery rule picks the company", async () => {
    const { userId: sara } = await createSession({ shopId, role: "agent", email: `sara32-${tag}@test.dz` });
    const accountId = randomUUID();
    await db.query("INSERT INTO carrier_accounts (id, shop_id, carrier, platform, base_url, credentials) VALUES (?, ?, 'yalidine', 'yalidine', 'https://api.yalidine.app', 'x')", [accountId, shopId]);
    await owner.goto(`${apps}/deliveryAssign`);
    await owner.click("[data-testid=rule-new]");
    await owner.click("[data-testid=rule-save]");
    await owner.waitForSelector("[data-testid=rule-form] >> text=هذا الحقل مطلوب");
    await owner.fill("#rule-name", "العاصمة الكبيرة");
    await owner.selectOption("#rule-company", accountId);
    await owner.fill("#rule-min", "1000");
    await owner.locator("[data-testid=rule-wilayas] input[value='16']").check();
    await owner.click("[data-testid=rule-save]");
    await owner.waitForSelector("[data-rule='العاصمة الكبيرة']");
    await owner.goto(`${apps}/agentAssign`);
    await owner.click("[data-testid=rule-new]");
    await owner.fill("#rule-name", "المصابيح لسارة");
    await owner.selectOption("#rule-agent", sara);
    await owner.locator("[data-testid=rule-products] label", { hasText: "مصباح" }).locator("input").check();
    await owner.click("[data-testid=rule-save]");
    await owner.waitForSelector("[data-rule='المصابيح لسارة']");
    await order("0664 55 66 77");
    await buyer.waitForURL(/\/thanks\?o=/);
    const [[o]] = await db.query("SELECT assigned_to, carrier_account_id FROM orders WHERE id = ?", [new URL(buyer.url()).searchParams.get("o")]);
    expect(o.assigned_to === sara, "assigned by the agent rule");
    expect(o.carrier_account_id === accountId, "delivery company from the rule");
    await owner.goto(apps);
    expect((await owner.locator("[data-app-card=deliveryAssign]").getAttribute("data-state")) === "on", "grid: delivery rules on");
    await owner.goto(`${apps}/agentAssign`);
    owner.once("dialog", (d) => d.accept());
    await owner.locator("[data-rule='المصابيح لسارة'] [data-testid=rule-delete]").click();
    await owner.waitForSelector("[data-rule='المصابيح لسارة']", { state: "detached" });
  });

  await step("custom fields: switched on, a product asks its own required question; the answer is saved on the order", async () => {
    const [[lamp]] = await db.query("SELECT id FROM products WHERE shop_id = ? AND slug = 'lamp'", [shopId]);
    await owner.goto(`${dash}/products/${lamp.id}`);
    await owner.waitForSelector("[data-testid=product-form][data-ready]");
    expect(!(await owner.locator("[data-testid=custom-fields]").count()), "no editor while the app is off");
    await owner.goto(`${apps}/customFields`);
    await owner.locator("[data-testid=app-enabled]").check();
    await save();
    await owner.goto(`${dash}/products/${lamp.id}`);
    await owner.waitForSelector("[data-testid=product-form][data-ready]");
    await owner.locator("[data-form-tab=delivery]").click();
    await owner.click("[data-testid=question-add]");
    await owner.fill("[data-testid=question-label-0]", "المقاس");
    await owner.selectOption("[data-testid=question-type-0]", "select");
    await owner.fill("[data-testid=question-options-0]", "صغير، كبير");
    await owner.locator("[data-question='0'] input[type=checkbox]").check();
    await owner.click("[data-testid=save-product]");
    await until(async () => JSON.stringify((await db.query("SELECT custom_fields FROM products WHERE id = ?", [lamp.id]))[0][0].custom_fields ?? "").includes("المقاس"), "question saved");
    await buyer.goto(`${store}/p/lamp`);
    const select = buyer.locator("select[name^='custom_p-']");
    await select.waitFor();
    await buyer.fill("#name", "سليم بن عمر");
    await buyer.fill("#phone", "0665 66 77 88");
    await buyer.selectOption("#wilaya", "16");
    await buyer.selectOption("#commune", "حيدرة");
    await buyer.waitForTimeout(4200);
    await buyer.click("button[type=submit]");
    await buyer.waitForSelector("text=هذه المعلومة مطلوبة");
    await select.selectOption("كبير");
    await buyer.click("button[type=submit]");
    await buyer.waitForURL(/\/thanks\?o=/);
    const [[o]] = await db.query("SELECT extra FROM orders WHERE id = ?", [new URL(buyer.url()).searchParams.get("o")]);
    expect(JSON.stringify(o.extra).includes("المقاس") && JSON.stringify(o.extra).includes("كبير"), "answer on the order");
  });

  await step("wholesale: a minimum order and a price tier from the product's Wholesale tab apply in the store and the order", async () => {
    await owner.goto(`${apps}/wholesale`);
    await owner.locator("[data-testid=app-enabled]").check();
    await save();
    const [[lamp]] = await db.query("SELECT id FROM products WHERE shop_id = ? AND slug = 'lamp'", [shopId]);
    await owner.goto(`${dash}/products/${lamp.id}`);
    await owner.waitForSelector("[data-testid=product-form][data-ready]");
    await owner.locator("[data-form-tab=wholesale]").click();
    await owner.fill("#ws-min", "2");
    await owner.click("[data-testid=tier-add]");
    await owner.fill("[data-testid=tier-from-0]", "5");
    await owner.fill("[data-testid=tier-price-0]", "1500");
    await owner.click("[data-testid=save-product]");
    await until(async () => JSON.stringify((await db.query("SELECT wholesale FROM products WHERE id = ?", [lamp.id]))[0][0].wholesale ?? "").includes("1500"), "tiers saved");
    await buyer.goto(`${store}/p/lamp`);
    await buyer.waitForSelector("[data-testid=wholesale-tiers]");
    expect((await buyer.locator("[data-testid=quantity]").inputValue()) === "2", "starts at the minimum");
    await buyer.fill("[data-testid=quantity]", "6");
    await buyer.locator("select[name^='custom_p-']").selectOption("صغير");
    await buyer.fill("#name", "سليم بن عمر");
    await buyer.fill("#phone", "0666 77 88 99");
    await buyer.selectOption("#wilaya", "16");
    await buyer.selectOption("#commune", "حيدرة");
    await buyer.waitForTimeout(4200);
    await buyer.click("button[type=submit]");
    await buyer.waitForURL(/\/thanks\?o=/);
    const [[o]] = await db.query("SELECT subtotal FROM orders WHERE id = ?", [new URL(buyer.url()).searchParams.get("o")]);
    expect(o.subtotal === 9000, `6 × 1500 (got ${o.subtotal})`);
  });

  await step("parcel scanner switched off: Scan leaves the menu and Orders, its page sends back to Orders", async () => {
    await owner.goto(`${apps}/parcelScanner`);
    await owner.locator("[data-testid=app-enabled]").uncheck();
    await save();
    await owner.goto(`${dash}/orders`);
    expect(!(await owner.locator("aside nav li[data-nav=scan]").count()) && !(await owner.locator("[data-testid=scan-link]").count()), "no Scan");
    await owner.goto(`${dash}/scan`);
    await owner.waitForURL(/\/dashboard\/orders/);
    await owner.goto(apps);
    expect((await owner.locator("[data-app-card=parcelScanner]").getAttribute("data-state")) === "off" && (await owner.locator("[data-app-card=agentAssign]").getAttribute("data-state")) === "off", "grid follows (manual mode, no rules)");
  });

  await step("agents cannot open apps; another shop sees none of this shop's settings", async () => {
    const { token } = await createSession({ shopId, role: "agent", email: `agent32-${tag}@test.dz` });
    const agentContext = await browser.newContext();
    await agentContext.addCookies([{ name: "sc_session", value: token, url: BASE }]);
    const agent = await agentContext.newPage();
    await agent.goto(`${apps}/blacklist`);
    await agent.waitForURL((u) => !u.pathname.includes("apps"));
    await agentContext.close();
    const other = await createShop(browser);
    const p = await other.context.newPage();
    await p.goto(`${apps}/quickContact`);
    expect(!(await p.locator("#c-whatsapp").count()), "contact off");
    await p.goto(`${apps}/nothing`);
    expect((await p.locator("text=رجوع إلى التطبيقات").count()) === 0, "unknown app → not found");
    await other.context.close();
  });

  await customer.close();
  await context.close();
}
