// Phase 35 (Zimam parity round): Products — the phone-shaped live preview, Zimam's variant editor (displays, values and
// combinations switched off, optional and hidden variants, old price per combination), maximum per order, the product's
// delivery option and "online payment only", as the editor saves them and as the store honours them.
import { randomUUID } from "node:crypto";
import { BASE, BROWSER_ARGS, createShop, db, expect, step } from "./helpers.mjs";

const json = (v) => (typeof v === "string" ? JSON.parse(v) : v);

export default async function phase35(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  const store = `${BASE}/store/shop-${tag}`;
  const dash = `${BASE}/ar/dashboard`;
  // Two delivery options: home 400, desk 200 (flat prices)
  await db.query("UPDATE shops SET delivery = ? WHERE id = ?", [JSON.stringify({ enabled: true, options: [{ id: "home", name: "", type: "home", pricing: "flat", price: 400, active: true }, { id: "office", name: "", type: "office", pricing: "flat", price: 200, active: true }] }), shopId]);
  const product = randomUUID();
  const options = [
    { name: "اللون", values: ["أحمر", "أزرق"], display: "color", colors: { أحمر: "#dc2626", أزرق: "#2563eb" }, off: ["أزرق"] },
    { name: "المقاس", values: ["S", "M"], display: "text" },
    { name: "تغليف هدية", values: ["نعم"], display: "text", optional: true },
  ];
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers, max_per_order, delivery_option) VALUES (?, ?, 'قميص', 'shirt', 2000, '[]', ?, '[]', 2, 'office')", [product, shopId, JSON.stringify(options)]);
  const variant = (values, title, position, active, price = null) =>
    db.query("INSERT INTO product_variants (id, product_id, shop_id, option_values, title, price, stock, active, position) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)", [randomUUID(), product, shopId, JSON.stringify(values), title, price, active, position]);
  await variant({ اللون: "أحمر", المقاس: "S" }, "أحمر / S", 0, 1);
  await variant({ اللون: "أحمر", المقاس: "M" }, "أحمر / M", 1, 0);
  await variant({ اللون: "أزرق", المقاس: "S" }, "أزرق / S", 2, 1);
  await variant({ اللون: "أزرق", المقاس: "M" }, "أزرق / M", 3, 1);

  await step("editor: a phone-shaped live preview, Zimam's variant editor with the saved state", async () => {
    await owner.setViewportSize({ width: 1366, height: 768 });
    await owner.goto(`${dash}/products/${product}`);
    await owner.locator("[data-testid=product-form][data-ready]").waitFor();
    const phone = await owner.locator("[data-testid=preview-phone]").boundingBox();
    expect(phone && phone.width >= 270 && phone.width <= 340 && phone.height > phone.width * 1.8, `a phone, taller than wide (got ${JSON.stringify(phone)})`);
    const screen = owner.locator("[data-testid=preview-screen]");
    expect(await screen.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), "nothing spills sideways in the preview");
    await owner.click("[data-form-tab=variants]");
    expect((await owner.locator("[data-option]").count()) === 3, "three variants (Zimam's most)");
    expect(await owner.locator("[data-testid=add-variant]").isDisabled(), "no fourth variant");
    expect((await owner.locator("[data-testid=combo-count]").innerText()).includes("4 / 150"), "only the shown, required variants make combinations");
    expect((await owner.locator("[data-option='0'] [data-display=color]").getAttribute("aria-checked")) === "true", "color circles");
    expect((await owner.locator("[data-option='2'] [data-testid=option-optional]").getAttribute("aria-pressed")) === "true", "optional");
    expect((await owner.locator("[data-variant='أحمر / M'] [data-testid=variant-status]").getAttribute("aria-pressed")) === "false", "the switched-off combination");
    expect((await owner.locator("#maxPerOrder").inputValue()) === "2", "maximum per order");
    // An old price on a combination, saved with the rest
    await owner.fill('[aria-label="السعر القديم أحمر / S"]', "2600");
    await owner.locator("[data-testid=save-product]").click();
    await owner.waitForTimeout(1500);
    const [[v]] = await db.query("SELECT compare_at_price, active FROM product_variants WHERE product_id = ? AND title = 'أحمر / S'", [product]);
    const [[off]] = await db.query("SELECT active FROM product_variants WHERE product_id = ? AND title = 'أحمر / M'", [product]);
    expect(v.compare_at_price === 2600 && v.active === 1 && off.active === 0, "saved per combination");
    const [[p]] = await db.query("SELECT options FROM products WHERE id = ?", [product]);
    expect(JSON.stringify(json(p.options)[0].off) === JSON.stringify(["أزرق"]), "switched-off value kept");
  });

  await step("checkout & delivery tab: the product's delivery option and online payment only", async () => {
    await owner.click("[data-form-tab=delivery]");
    expect((await owner.locator("[data-testid=delivery-option]").inputValue()) === "office", "delivery option");
    await owner.locator("[data-testid=online-only]").check({ force: true });
    await owner.waitForSelector("[data-testid=online-only-warning]");
    await owner.locator("[data-testid=online-only]").uncheck({ force: true });
  });

  await step("store: switched-off values and combinations left out, optional choice on the order, desk only, at most 2", async () => {
    const buyer = await (await browser.newContext({ userAgent: BROWSER_ARGS[0].replace("--user-agent=", ""), viewport: { width: 390, height: 844 } })).newPage();
    await buyer.goto(`${store}/p/shirt`);
    await buyer.waitForSelector("button[type=submit]");
    expect(!(await buyer.locator('button[aria-label="أزرق"]').count()), "switched-off color not shown");
    expect(await buyer.locator('[data-store-option="المقاس"] button', { hasText: "M" }).isDisabled(), "a switched-off combination cannot be chosen");
    await buyer.locator('[data-store-option="تغليف هدية"] button', { hasText: "نعم" }).click();
    await buyer.locator('button[aria-label="+"]').click();
    expect(await buyer.locator('button[aria-label="+"]').isDisabled(), "two at most");
    await buyer.fill("#name", "زبون القميص");
    await buyer.fill("#phone", "0661 55 44 33");
    await buyer.selectOption("#wilaya", "16");
    await buyer.waitForSelector("#commune option[value='Kouba']", { state: "attached" });
    await buyer.selectOption("#commune", "Kouba");
    expect(await buyer.locator("input[name=deliveryType][value=home]").isDisabled(), "home delivery not offered for this product");
    await buyer.locator("input[name=deliveryType][value=office]").check();
    await buyer.waitForTimeout(4300);
    await Promise.all([buyer.waitForURL(/\/thanks\?o=/), buyer.locator("button[type=submit]").click()]);
    const id = new URL(buyer.url()).searchParams.get("o");
    const [[o]] = await db.query("SELECT shipping_price AS ship, extra FROM orders WHERE id = ?", [id]);
    const [[item]] = await db.query("SELECT quantity, variant_title AS title FROM order_items WHERE order_id = ?", [id]);
    expect(o.ship === 200 && item.quantity === 2 && item.title === "أحمر / S", `desk price, 2 pieces, the combination (got ${JSON.stringify({ o, item })})`);
    expect(json(o.extra).some((e) => e.label === "تغليف هدية" && e.value === "نعم"), "the optional choice is on the order");
    await buyer.context().close();
  });

  await step("a hidden variant leaves the store; online payment only without a card gateway cannot be ordered", async () => {
    await db.query("UPDATE products SET card_only = 1, options = ? WHERE id = ?", [JSON.stringify(options.map((o) => (o.name === "تغليف هدية" ? { ...o, hidden: true } : o))), product]);
    const buyer = await browser.newPage();
    await buyer.goto(`${store}/p/shirt`);
    await buyer.waitForSelector("button[type=submit]");
    expect(!(await buyer.locator('[data-store-option="تغليف هدية"]').count()), "hidden variant not shown");
    expect(await buyer.locator("button[type=submit]").isDisabled(), "order button disabled");
    await buyer.close();
  });

  await context.close();
}
