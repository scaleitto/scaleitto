// Phase 1: products — Zimam list (open in store, edit, delete), create with images/variants/offers, edit,
// delete, plan limit, uploads security and tenant isolation.
import { BASE, createSession, createShop, db, expect, pngBuffer, step } from "./helpers.mjs";

export default async function phase1(browser) {
  const { shopId, context } = await createShop(browser);
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  const list = `${BASE}/ar/dashboard/products`;
  let productId;

  await step("empty list invites to add the first product", async () => {
    await page.goto(list);
    await page.waitForSelector("text=لا توجد منتجات بعد");
  });

  await step("saving an empty form shows field errors, not a crash", async () => {
    await page.goto(`${list}/new`);
    await page.locator("[data-testid=save-product]").click();
    await page.waitForSelector("text=تحقق من الحقول المحددة بالأحمر");
    expect(await page.locator("text=أدخل سعراً صحيحاً بالدينار").count(), "price error shown");
  });

  await step("create a product with images, variants, stock and an offer", async () => {
    await page.fill("#name", "ساعة كلاسيكية");
    expect((await page.locator("[data-preview=name]").innerText()) === "ساعة كلاسيكية", "the phone preview follows the name");
    await page.click("[data-form-tab=description]");
    await page.fill("#description", "ساعة أنيقة مقاومة للماء");
    await page.fill("#shortDescription", "مقاومة للماء وأنيقة");
    await page.click("[data-form-tab=details]");
    await page.fill("#price", "4 500");
    await page.fill("#compareAtPrice", "6000");
    await page.fill("#costPrice", "2500");
    await page.waitForSelector("text=هامش الربح");
    await page.setInputFiles("[data-panel=details] [data-testid=image-input]", [
      { name: "red.png", mimeType: "image/png", buffer: pngBuffer([220, 40, 60]) },
      { name: "blue.png", mimeType: "image/png", buffer: pngBuffer([40, 90, 220]) },
    ]);
    await page.waitForSelector("[data-panel=details] [data-testid=images] li >> nth=1");
    await page.click("[data-form-tab=variants]");
    await page.locator("[data-testid=track-stock]").check({ force: true });
    await page.locator("[data-testid=has-variants]").check({ force: true });
    await page.fill('[aria-label="اسم الخيار"]', "المقاس");
    await page.fill('[aria-label="القيم"]', "S");
    await page.keyboard.press("Enter");
    await page.keyboard.type("M");
    await page.keyboard.press("Enter");
    await page.click("text=إضافة خيار");
    await page.locator('[aria-label="اسم الخيار"]').nth(1).fill("اللون");
    // Typed but not confirmed with Enter: still saved
    await page.locator('[aria-label="القيم"]').nth(1).fill("أسود");
    await page.fill('[aria-label="الكمية المتوفرة S / أسود"]', "5");
    await page.fill('[aria-label="السعر M / أسود"]', "4800");
    await page.click("[data-form-tab=offers]");
    await page.click("text=إضافة عرض");
    await page.locator('[aria-label="السعر الإجمالي"]').fill("8500");
    await Promise.all([page.waitForURL("**/products?created=1"), page.locator("[data-testid=save-product]").click()]);
    await page.waitForSelector("text=تمت إضافة المنتج");
    const row = page.locator('[data-product="ساعة كلاسيكية"]');
    expect((await row.locator("[data-col=stock]").innerText()).trim() === "5", "list shows the total stock");

    const [[p]] = await db.query("SELECT * FROM products WHERE shop_id = ?", [shopId]);
    productId = p.id;
    const json = (v) => (typeof v === "string" ? JSON.parse(v) : v);
    expect(p.price === 4500 && p.compare_at_price === 6000 && p.cost_price === 2500, "prices saved as integers");
    expect(json(p.images).length === 2 && json(p.images)[0].startsWith("/uploads/"), "images saved as upload paths");
    expect(json(p.offers)[0].quantity === 2 && json(p.offers)[0].price === 8500, "offer saved");
    expect(p.short_description === "مقاومة للماء وأنيقة", "short description saved");
    const [variants] = await db.query("SELECT title, price, stock FROM product_variants WHERE product_id = ? ORDER BY position", [p.id]);
    expect(variants.map((v) => `${v.title}:${v.price}:${v.stock}`).join(",") === "S / أسود:null:5,M / أسود:4800:0", `variants saved (${JSON.stringify(variants)})`);
  });

  await step("uploaded images are served, other files are refused", async () => {
    const [[p]] = await db.query("SELECT images FROM products WHERE id = ?", [productId]);
    const src = (typeof p.images === "string" ? JSON.parse(p.images) : p.images)[0];
    const img = await page.request.get(`${BASE}${src}`);
    expect(img.status() === 200 && img.headers()["content-type"] === "image/png", "image served as PNG");
    const bad = await page.request.post(`${BASE}/api/uploads`, { data: Buffer.from("<html>not an image</html>"), headers: { "Content-Type": "image/png" } });
    expect(bad.status() === 400 && (await bad.json()).error === "type", "non-image refused");
    const traversal = await page.request.get(`${BASE}/uploads/${shopId}/..%2F..%2Fetc%2Fpasswd`);
    expect(traversal.status() === 404, "path traversal refused");
    const anon = await browser.newContext();
    const res = await anon.request.post(`${BASE}/api/uploads`, { data: pngBuffer(), headers: { "Content-Type": "image/png" } });
    expect(res.status() === 403, "anonymous upload refused");
    await anon.close();
  });

  await step("edit keeps values, removing an option rebuilds variants", async () => {
    await page.goto(`${list}/${productId}`);
    expect((await page.inputValue("#price")) === "4500", "price loaded");
    await page.click("[data-form-tab=variants]");
    expect((await page.locator("[data-variant]").count()) === 2, "2 variants loaded");
    const [[before]] = await db.query("SELECT id FROM product_variants WHERE product_id = ? AND title = 'S / أسود'", [productId]);
    await page.locator('[aria-label="حذف الخيار"]').nth(1).click();
    expect((await page.locator("[data-variant]").count()) === 2, "still 2 variants (S, M)");
    await page.click("[data-form-tab=details]");
    await page.fill("#name", "ساعة كلاسيكية فاخرة");
    await page.locator("[data-testid=save-product]").click();
    await page.waitForSelector("text=تم الحفظ");
    const [variants] = await db.query("SELECT id, title, stock FROM product_variants WHERE product_id = ? ORDER BY position", [productId]);
    expect(variants.map((v) => v.title).join(",") === "S,M", `variants rebuilt (${variants.map((v) => v.title)})`);
    expect(variants[0].id !== before.id, "a changed combination is a new variant");
    await page.reload();
    expect((await page.inputValue("#name")) === "ساعة كلاسيكية فاخرة", "name persisted after reload");
  });

  await step("the list is Zimam's: no tabs or search; open in store, edit and delete per row", async () => {
    await page.goto(list);
    expect(!(await page.locator('input[name="q"]').count()), "no search box");
    const row = page.locator("[data-product]").first();
    const store = await row.locator('a[aria-label="عرض في المتجر"]').getAttribute("href");
    expect(/\/store\/[^/]+\/p\/[^/]+$/.test(store ?? ""), `store link (${store})`);
    expect((await row.locator('a[aria-label="تعديل"]').count()) === 1, "edit link");
    expect((await row.locator('button[aria-label="حذف"]').count()) === 1, "delete button");
  });

  await step("plan limit blocks adding past the ceiling with a clear message", async () => {
    await page.goto(`${list}/new`);
    await page.fill("#name", "منتج ثان");
    await page.fill("#price", "900");
    await Promise.all([page.waitForURL(/created=1/), page.locator("[data-testid=save-product]").click()]);
    await db.query("INSERT INTO shop_contracts (id, shop_id, start_date, limits) VALUES (UUID(), ?, CURDATE() - INTERVAL 1 DAY, ?)", [shopId, JSON.stringify({ maxProducts: 2 })]);
    await page.goto(`${list}/new`);
    await page.fill("#name", "منتج ثالث");
    await page.fill("#price", "1000");
    await page.locator("[data-testid=save-product]").click();
    await page.waitForSelector("text=وصلت إلى الحد الأقصى للمنتجات");
    await db.query("DELETE FROM shop_contracts WHERE shop_id = ?", [shopId]);
  });

  await step("delete removes the product and its variants", async () => {
    await page.goto(list);
    const copy = page.locator("[data-product]", { hasText: "منتج ثان" });
    await copy.locator('button[aria-label="حذف"]').click();
    await page.waitForFunction(() => document.querySelectorAll("[data-product]").length === 1);
    const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM product_variants WHERE shop_id = ?", [shopId]);
    expect(Number(n) === 2, "only the original's variants remain");
  });

  await step("another shop cannot open or change this shop's product", async () => {
    const other = await createShop(browser);
    const p = await other.context.newPage();
    await p.goto(`${list}/${productId}`);
    await p.waitForSelector("[data-testid=not-found]");
    expect(!(await p.locator("text=ساعة كلاسيكية").count()), "no data from the other shop is shown");
    await p.goto(list);
    await p.waitForSelector("text=لا توجد منتجات بعد");
    await other.context.close();
  });

  await step("call center agents cannot open products or upload", async () => {
    const agent = await createSession({ shopId, role: "agent", email: `agent-p1-${Date.now()}@test.dz` });
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "sc_session", value: agent.token, url: BASE }]);
    const p = await ctx.newPage();
    await p.goto(`${list}/${productId}`);
    await p.waitForURL((u) => u.pathname === "/ar/call-center");
    const res = await ctx.request.post(`${BASE}/api/uploads`, { data: pngBuffer(), headers: { "Content-Type": "image/png" } });
    expect(res.status() === 403, "agent upload refused");
    await ctx.close();
  });

  await step("French product form works (LTR, translated)", async () => {
    await page.goto(`${BASE}/fr/dashboard/products/${productId}`);
    expect((await page.locator("html").getAttribute("dir")) === "ltr", "LTR");
    await page.click("[data-form-tab=offers]");
    await page.waitForSelector("text=Offres de quantité");
  });

  await context.close();
}
