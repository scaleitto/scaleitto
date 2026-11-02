// Phase 27 (Zimam parity, phase 3): the product editor in tabs with the live phone preview and the bottom actions
// (clear, create & add another, create), the short description, description images, the product's own delivery
// company, alert threshold, "show when sold out", similar products — and the products list's columns.
import { randomUUID } from "node:crypto";
import { BASE, createShop, db, expect, pngBuffer, step } from "./helpers.mjs";

export default async function phase27(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  const list = `${BASE}/ar/dashboard/products`;
  const store = `${BASE}/store/shop-${tag}`;
  const carrier = randomUUID();
  await db.query("INSERT INTO carrier_accounts (id, shop_id, carrier, platform, base_url, credentials) VALUES (?, ?, 'yalidine', 'yalidine', 'https://example.test', 'x')", [carrier, shopId]);
  let before = "";
  const product = async (name) => (await db.query("SELECT * FROM products WHERE shop_id = ? AND name = ?", [shopId, name]))[0][0];

  await step("editor: five tabs, physical only for now, the phone preview follows the typing", async () => {
    await owner.goto(`${list}/new`);
    await owner.locator("[data-testid=product-form][data-ready]").waitFor();
    const tabs = await owner.locator("[data-testid=product-tabs] [data-form-tab]").evaluateAll((els) => els.map((e) => e.dataset.formTab));
    expect(tabs.join() === "details,description,variants,delivery,offers", `tabs (got ${tabs.join()})`);
    await owner.fill("#name", "مصباح مكتب");
    await owner.fill("#price", "2500");
    await owner.fill("#compareAtPrice", "3200");
    expect((await owner.locator("[data-preview=name]").innerText()) === "مصباح مكتب", "preview name");
    expect((await owner.locator("[data-preview=price]").innerText()).replace(/\s/g, "").includes("2500"), "preview price");
  });

  await step("a short description over 7 words opens its tab with the error", async () => {
    await owner.click("[data-form-tab=description]");
    await owner.fill("#shortDescription", "واحد اثنان ثلاثة أربعة خمسة ستة سبعة ثمانية");
    await owner.click("[data-form-tab=details]");
    await owner.click("[data-testid=save-product]");
    await owner.locator("[data-panel=description]:not([hidden])").waitFor();
    await owner.getByText("7 كلمات على الأكثر").first().waitFor();
    await owner.fill("#shortDescription", "إضاءة دافئة لمكتبك");
  });

  await step("create & add another: the product is saved and a fresh form opens", async () => {
    await owner.click("[data-form-tab=variants]");
    await owner.locator("[data-testid=track-stock]").check({ force: true });
    await owner.fill("#stock", "8");
    await owner.fill("#lowStock", "10");
    before = new URL(owner.url()).search;
    await Promise.all([owner.waitForURL((u) => /\/products\/new\?created=[0-9a-f-]{36}$/.test(u.pathname + u.search) && u.search !== before), owner.click("[data-testid=create-another]")]);
    await owner.locator("[data-testid=product-form][data-ready]").waitFor();
    await owner.getByText("تم إنشاء المنتج، أضف التالي.").waitFor();
    expect((await owner.inputValue("#name")) === "", "empty form");
    const lamp = await product("مصباح مكتب");
    expect(lamp.short_description === "إضاءة دافئة لمكتبك" && lamp.low_stock === 10 && lamp.stock === 8 && lamp.compare_at_price === 3200, "saved");
  });

  await step("clear empties the form", async () => {
    await owner.fill("#name", "سيُمسح");
    await owner.click("[data-testid=product-clear]");
    expect((await owner.inputValue("#name")) === "", "cleared");
  });

  await step("a sold-out product hidden from the store; another with its delivery company, description photos and chosen similar products", async () => {
    // Sold out and hidden while sold out
    await owner.fill("#name", "حامل هاتف");
    await owner.fill("#price", "900");
    await owner.click("[data-form-tab=variants]");
    await owner.locator("[data-testid=track-stock]").check({ force: true });
    await owner.fill("#stock", "0");
    await owner.locator("[data-testid=show-out-of-stock]").uncheck({ force: true });
    before = new URL(owner.url()).search;
    await Promise.all([owner.waitForURL((u) => /\/products\/new\?created=[0-9a-f-]{36}$/.test(u.pathname + u.search) && u.search !== before), owner.click("[data-testid=create-another]")]);
    await owner.locator("[data-testid=product-form][data-ready]").waitFor();
    expect((await product("حامل هاتف")).show_out_of_stock === 0, "hidden when sold out");
    // The third one
    const lamp = await product("مصباح مكتب");
    await owner.fill("#name", "مروحة صغيرة");
    await owner.fill("#price", "1800");
    await owner.click("[data-form-tab=description]");
    await owner.locator("[data-testid=description-images]").check({ force: true });
    await owner.locator("[data-panel=description] [data-testid=image-input]").setInputFiles([{ name: "d.png", mimeType: "image/png", buffer: pngBuffer([20, 160, 90]) }]);
    await owner.locator("[data-panel=description] [data-testid=images] li").first().waitFor();
    await owner.click("[data-form-tab=delivery]");
    await owner.selectOption("#carrierAccountId", carrier);
    await owner.click("[data-form-tab=offers]");
    // Every other product is ticked by default (Zimam): clear, then choose one
    expect(await owner.locator(`[data-similar-id="${lamp.id}"]`).isChecked(), "all ticked by default");
    await owner.click("[data-testid=similar-none]");
    await owner.locator(`[data-similar-id="${lamp.id}"]`).check();
    await Promise.all([owner.waitForURL("**/products?created=1"), owner.click("[data-testid=save-product]")]);
    const fan = await product("مروحة صغيرة");
    const json = (v) => (typeof v === "string" ? JSON.parse(v) : v);
    expect(fan.carrier_account_id === carrier && json(fan.similar_ids).join() === lamp.id && json(fan.description_images).length === 1, `saved (got ${fan.carrier_account_id} ${fan.similar_ids})`);
  });

  await step("store: the sold-out product is gone, similar products and description photos show, the order goes to the product's company", async () => {
    const p = await browser.newPage();
    await p.goto(store);
    await p.getByText("مصباح مكتب").first().waitFor();
    expect(!(await p.getByText("حامل هاتف").count()), "sold-out product hidden");
    await p.goto(`${store}/p/${encodeURIComponent((await product("مروحة صغيرة")).slug)}`);
    const similar = p.locator("[data-testid=similar-products]");
    await similar.getByText("مصباح مكتب").waitFor();
    expect((await similar.locator("li").count()) === 1, "only the chosen product");
    expect(await p.locator("[data-testid=description-image]").count(), "description photo");
    await p.fill("#name", "زبون المروحة");
    await p.fill("#phone", "0661 77 88 99");
    await p.selectOption("#wilaya", "16");
    await p.waitForSelector("#commune option[value='Kouba']", { state: "attached" });
    await p.selectOption("#commune", "Kouba");
    await p.waitForTimeout(4500);
    await Promise.all([p.waitForURL(/\/thanks\?o=/), p.locator("button[type=submit]").click({ force: true })]);
    const [[o]] = await db.query("SELECT carrier_account_id FROM orders WHERE id = ?", [new URL(p.url()).searchParams.get("o")]);
    expect(o.carrier_account_id === carrier, "the order carries the product's delivery company");
    // Automatic similar products: the store's others that are in stock
    await p.goto(`${store}/p/${encodeURIComponent((await product("مصباح مكتب")).slug)}`);
    await p.locator("[data-testid=similar-products]").getByText("مروحة صغيرة").waitFor();
    expect(!(await p.locator("[data-testid=similar-products]").getByText("حامل هاتف").count()), "no sold-out hidden product");
    await p.close();
  });

  await step("list: current and old price, stock, units sold", async () => {
    await owner.goto(list);
    const fan = owner.locator('[data-product="مروحة صغيرة"]');
    expect((await fan.locator("[data-col=units]").innerText()) === "1", "1 unit sold");
    const lamp = owner.locator('[data-product="مصباح مكتب"]');
    expect((await lamp.locator("[data-col=oldPrice]").innerText()).replace(/\s/g, "").includes("3200") && (await lamp.locator("[data-col=stock]").innerText()) === "8", "old price and stock");
  });

  await context.close();
}
