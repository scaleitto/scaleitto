// Phase 15 (landing pages like Zimam): "Generate with AI" — the product, the language of the texts in the images, the
// brief, the writing framework, the size (2 / 4 / 6 images), the style family, the price text and the cost against
// the month's AI quota; the progress until the builder opens with the drawn images, the order form, a sticky button
// and a thank-you window; the public page and the thank-you window after ordering.
import { randomUUID } from "node:crypto";
import { BASE, BROWSER_ARGS, createShop, db, expect, landingRow, pngBuffer, step, until } from "./helpers.mjs";
import { requests } from "./mock-openai.mjs";

export default async function phase15(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  const section = `${BASE}/ar/dashboard/landing-pages`;
  const contractId = randomUUID();
  await db.query("INSERT INTO shop_contracts (id, shop_id, start_date, limits) VALUES (?, ?, CURDATE() - INTERVAL 1 DAY, ?)", [contractId, shopId, JSON.stringify({ maxLandingPages: 10, maxAiPerMonth: 20 })]);
  await db.query("INSERT INTO shipping_rates (shop_id, wilaya_code, home_price, office_price) VALUES (?, 16, 500, 350)", [shopId]);
  // The product's photo is one of the store's uploads (the AI draws from it)
  const upload = await owner.request.post(`${BASE}/api/uploads`, { data: pngBuffer([30, 120, 200]), headers: { "Content-Type": "image/png" } });
  const photo = (await upload.json()).url;
  const productId = randomUUID();
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, compare_at_price, images, options, offers) VALUES (?, ?, 'مصباح ضد البعوض', 'lamp', 2600, 3500, ?, '[]', '[]')", [productId, shopId, JSON.stringify([photo])]);
  let pageId;

  await step("Generate with AI: the product, the language, the brief, a framework, the size, a style, the price text and the cost", async () => {
    await owner.goto(section);
    await owner.click("[data-testid=create-landing]");
    await Promise.all([owner.waitForURL(/landing-pages\/new$/), owner.click("[data-create=ai]")]);
    const builder = owner.locator("[data-testid=ai-builder]");
    await builder.waitFor();
    expect((await builder.locator("[data-framework]").count()) === 7, "7 writing frameworks");
    expect((await builder.locator("[data-style]").count()) === 13, "13 style families");
    expect((await builder.locator("[data-size]").count()) === 3, "small / medium / large");
    await builder.locator('[data-product="مصباح ضد البعوض"]').click();
    await builder.locator("[data-language=fr]").click();
    await builder.locator("#ai-brief").fill("Lampe silencieuse, livraison 58 wilayas, paiement à la livraison.");
    await builder.locator("[data-framework=pas]").click();
    await builder.locator("[data-size=\"4\"]").click();
    await builder.locator("[data-style=blackGold]").click();
    await builder.locator("#ai-price").fill("2600 DA au lieu de 3500 DA");
    expect((await owner.locator("[data-testid=ai-cost]").innerText()).includes("4 صور · 5"), "4 images = 5 AI uses");
    await owner.click("[data-testid=ai-generate]");
    await owner.waitForSelector("[data-testid=ai-progress]");
    await owner.waitForURL(/landing-pages\/[0-9a-f-]{36}$/, { timeout: 90_000 });
    pageId = owner.url().split("/").pop();
    const row = await landingRow(pageId);
    expect(row.product_id === productId && row.language === "fr" && row.status === "draft", "a French draft page for the product");
    expect(row.sections.map((s) => s.type).join() === "image,image,image,image,form,sticky,thankYou", `the page's components (got ${row.sections.map((s) => s.type).join()})`);
    const images = row.sections.filter((s) => s.type === "image");
    expect(images.every((s) => s.url.startsWith(`/uploads/${shopId}/`) && s.poster?.headline), "every image drawn, with its texts kept");
    expect(row.color === "#d4a72c", "the style's main color");
    const plan = requests.filter((r) => r.text?.format?.name === "image_landing_page").pop();
    expect(plan.input[0].content[0].text.includes("PAS —") && plan.input[0].content[0].text.includes("Black & gold") && plan.input[0].content[0].text.includes("Lampe silencieuse"), "framework, style and brief in the request");
    const drawn = requests.filter((r) => r.tools?.some((t) => t.type === "image_generation") && JSON.stringify(r.input).includes("2600 DA au lieu de 3500 DA"));
    expect(drawn.length === 4, `the price text in every image's instructions (got ${drawn.length})`);
    const [[used]] = await db.query("SELECT COUNT(*) AS n FROM ai_generations WHERE shop_id = ?", [shopId]);
    expect(Number(used.n) === 5, "plan + 4 images counted");
    await owner.waitForSelector("[data-testid=landing-builder]");
    expect((await owner.locator("[data-testid=landing-preview] [data-type=image] img").count()) === 4, "the images in the builder");
  });

  await step("the cost is checked against the month's AI quota", async () => {
    await db.query("UPDATE shop_contracts SET limits = ? WHERE id = ?", [JSON.stringify({ maxLandingPages: 10, maxAiPerMonth: 8 }), contractId]);
    await owner.goto(`${section}/new`);
    await owner.locator("[data-size=\"4\"]").click();
    await owner.getByText("رصيدك المتبقي من الذكاء الاصطناعي هذا الشهر لا يكفي").waitFor();
    expect(await owner.locator("[data-testid=ai-generate]").isDisabled(), "3 left: 4 images refused");
    await owner.locator("[data-size=\"2\"]").click();
    expect(!(await owner.locator("[data-testid=ai-generate]").isDisabled()), "3 left: 2 images allowed");
    await db.query("UPDATE shop_contracts SET limits = ? WHERE id = ?", [JSON.stringify({ maxLandingPages: 10, maxAiPerMonth: 20 }), contractId]);
  });

  await step("public page on a phone: one column of images, the sticky button; after ordering, the thank-you window", async () => {
    await owner.goto(`${section}/${pageId}`);
    await owner.click("[data-testid=publish]");
    await owner.waitForSelector("text=تم النشر");
    const { slug } = await landingRow(pageId);
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: BROWSER_ARGS[0].replace("--user-agent=", "") });
    const p = await phone.newPage();
    await p.goto(`${BASE}/store/shop-${tag}/lp/${slug}`);
    await p.waitForSelector("[data-layout=landing]");
    expect((await p.locator("[data-section=image] img").count()) === 4, "4 images");
    expect(await p.locator("[data-testid=sticky-order]").isVisible(), "sticky order button");
    expect((await p.locator("html").getAttribute("lang")) === "ar" || (await p.locator("[lang=fr]").count()) > 0, "the page in French");
    await p.fill("#name", "Karim");
    await p.fill("#phone", "0661 22 33 55");
    await p.selectOption("#wilaya", "16");
    await p.selectOption("#commune", { index: 1 });
    await Promise.all([p.waitForURL(/\/lp\/[^?]+\?thanks=/), p.click("button[type=submit]")]);
    await p.locator("[data-testid=thank-you-popup]").getByText("Merci, votre commande est reçue !").waitFor();
    const [[order]] = await db.query("SELECT number, landing_version FROM orders WHERE shop_id = ? AND landing_page_id = ?", [shopId, pageId]);
    expect(order.landing_version === "A", "order of version A");
    expect((await p.locator("[data-testid=thank-you-popup]").innerText()).includes(String(order.number)), "the order number in the window");
    await p.locator("[data-testid=thank-you-popup] button").last().click();
    await until(async () => !(await p.locator("[data-testid=thank-you-popup]").count()), "window closed");
    await phone.close();
  });

  await context.close();
}
