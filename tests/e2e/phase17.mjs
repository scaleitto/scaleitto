// Phase 17 (landing pages like Zimam): the image tools (draw an AI image again with corrected texts, restore it,
// edit an image with an AI prompt), the versions (a copy as B, run / pause, "Improve with AI" adds another one,
// paused), visitors split between the running versions (each keeps theirs, paused ones never shown, the order keeps
// the version), the SEO description and the pixels chosen for the page.
import { randomUUID } from "node:crypto";
import { BASE, BROWSER_ARGS, createShop, db, expect, landingRow, pngBuffer, step, until } from "./helpers.mjs";

export default async function phase17(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  owner.on("dialog", (d) => d.accept());
  const section = `${BASE}/ar/dashboard/landing-pages`;
  await db.query("INSERT INTO shop_contracts (id, shop_id, start_date, limits) VALUES (?, ?, CURDATE() - INTERVAL 1 DAY, ?)", [randomUUID(), shopId, JSON.stringify({ maxLandingPages: 10, maxAiPerMonth: 30 })]);
  await db.query("INSERT INTO shipping_rates (shop_id, wilaya_code, home_price, office_price) VALUES (?, 16, 500, 350)", [shopId]);
  const upload = async (rgb) => (await (await owner.request.post(`${BASE}/api/uploads`, { data: pngBuffer(rgb), headers: { "Content-Type": "image/png" } })).json()).url;
  const photo = await upload([200, 40, 60]);
  const poster1 = await upload([10, 10, 10]);
  const poster2 = await upload([90, 90, 90]);
  const productId = randomUUID();
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'مصباح', 'lamp', 2600, ?, '[]', '[]')", [productId, shopId, JSON.stringify([photo])]);
  // A page made by the AI: two drawn images with their texts, the form and a sticky button
  const pageId = randomUUID();
  const image = (id, url, headline) => ({ id, type: "image", url, fit: "natural", margin: 0, borderWidth: 0, radius: 0, borderColor: "", poster: { headline, bullets: ["نقطة"], scene: "desk", previous: [] } });
  const sections = [image("i1", poster1, "عنوان أول"), image("i2", poster2, "عنوان ثاني"), { id: "f", type: "form" }, { id: "s", type: "sticky", label: "" }];
  await db.query("INSERT INTO landing_pages (id, shop_id, product_id, slug, title, status, language, sections, variants) VALUES (?, ?, ?, 'lamp-page', 'صفحة المصباح', 'draft', 'ar', ?, '[]')", [pageId, shopId, productId, JSON.stringify(sections)]);
  const metaA = randomUUID();
  const metaB = randomUUID();
  await db.query("INSERT INTO pixels (id, shop_id, platform, name, tag_id) VALUES (?, ?, 'meta', 'بكسل الحملة', '111222333444'), (?, ?, 'meta', 'بكسل آخر', '999888777666')", [metaA, shopId, metaB, shopId]);
  const panel = owner.locator("[data-testid=section-panel]");
  const first = () => owner.locator('[data-testid=landing-preview] [data-sid="i1"]');

  await step("an AI image: its texts corrected and drawn again, then the previous image restored", async () => {
    await owner.goto(`${section}/${pageId}`);
    await first().click();
    const fields = panel.locator("[data-testid=poster-fields]");
    await fields.locator("input").first().fill("عنوان مصحح");
    await fields.locator("[data-testid=draw-again]").click();
    await until(async () => (await landingRow(pageId)).sections[0].url !== poster1, "new image saved", 60_000);
    const row = await landingRow(pageId);
    expect(row.sections[0].poster.headline === "عنوان مصحح" && row.sections[0].poster.previous[0] === poster1, "texts and the previous image kept");
    await panel.locator("[data-testid=restore-image]").click();
    await until(async () => (await landingRow(pageId)).sections[0].url === poster1, "previous image back");
  });

  await step("an image edited with an AI prompt keeps the page's place", async () => {
    await owner.locator('[data-testid=landing-preview] [data-sid="i2"]').click();
    await panel.locator("[data-testid=ai-edit] textarea").fill("اجعل الخلفية زرقاء");
    await panel.locator("[data-testid=ai-edit] button").click();
    await until(async () => (await landingRow(pageId)).sections[1].url !== poster2, "edited image saved", 60_000);
    const edit = (await db.query("SELECT brief FROM ai_generations WHERE shop_id = ? AND kind = 'image' ORDER BY created_at DESC LIMIT 1", [shopId]))[0][0];
    const brief = typeof edit.brief === "string" ? JSON.parse(edit.brief) : edit.brief;
    expect(brief.references[0] === poster2, "the current image is the first reference");
  });

  await step("versions: B as a copy (paused), changed and running; Improve with AI adds C, paused", async () => {
    await owner.click("[data-testid=add-version]");
    await owner.waitForSelector('[data-version=B][aria-pressed=true][data-paused=true]');
    await owner.click("[data-add=text]");
    await panel.locator("[data-field=body]").fill("هذه النسخة ب");
    await owner.click("[data-version-menu=B]");
    await owner.locator("[data-action=toggle-pause]").click();
    await owner.waitForSelector("[data-version=B][data-paused=false]");
    await owner.click("[data-testid=ai-version]");
    await owner.waitForSelector("[data-version=C][data-paused=true]", { timeout: 90_000 });
    await until(async () => {
      const r = await landingRow(pageId);
      return r.variants.length === 2 && r.variants[0].paused === false && r.variants[1].key === "C" && r.variants[1].paused === true && r.variants[0].sections.some((s) => s.type === "text");
    }, "versions saved");
    const c = (await landingRow(pageId)).variants[1];
    expect(c.sections.filter((s) => s.type === "image").every((s) => s.url.startsWith(`/uploads/${shopId}/`)), "C's images drawn");
    expect(await owner.locator("[data-testid=add-version]").isDisabled(), "three versions at most");
    // Version A is unchanged
    expect((await landingRow(pageId)).sections.length === 4, "A unchanged");
  });

  await step("SEO description and only the chosen Meta pixel on the page", async () => {
    await owner.locator("[data-version=A]").click();
    await owner.fill("[data-testid=seo] [data-field=meta]", "مصباح هادئ يحمي عائلتك من البعوض");
    await owner.locator("[data-testid=page-pixels] button").first().click();
    await owner.selectOption("[data-pixel-platform=meta]", metaA);
    await until(async () => {
      const r = await landingRow(pageId);
      return r.meta_description === "مصباح هادئ يحمي عائلتك من البعوض" && r.pixels?.meta?.[0] === metaA;
    }, "SEO and pixels saved");
    await owner.click("[data-testid=publish]");
    await owner.waitForSelector("text=تم النشر");
    const p = await browser.newPage();
    await p.goto(`${BASE}/store/shop-${tag}/lp/lamp-page`);
    await p.waitForSelector("[data-layout=landing]");
    expect((await p.locator('meta[name="description"]').getAttribute("content")) === "مصباح هادئ يحمي عائلتك من البعوض", "meta description");
    const html = await p.content();
    expect(html.includes("111222333444") && !html.includes("999888777666"), "only the chosen pixel");
    await p.close();
  });

  await step("visitors are split between A and B, keep theirs, never see the paused C; the order keeps the version", async () => {
    const seen = new Set();
    let ordered = false;
    for (let i = 0; i < 14 && seen.size < 2; i++) {
      const ctx = await browser.newContext({ userAgent: BROWSER_ARGS[0].replace("--user-agent=", "") });
      const p = await ctx.newPage();
      await p.goto(`${BASE}/store/shop-${tag}/lp/lamp-page`);
      await p.waitForSelector("[data-layout=landing]");
      const isB = (await p.getByText("هذه النسخة ب").count()) > 0;
      const version = isB ? "B" : "A";
      seen.add(version);
      await until(async () => (await ctx.cookies()).some((c) => c.name === `lpv_${pageId}` && c.value === version), "version remembered");
      // Coming back shows the same version
      await p.reload();
      await p.waitForSelector("[data-layout=landing]");
      expect(((await p.getByText("هذه النسخة ب").count()) > 0) === isB, "same version on return");
      if (isB && !ordered) {
        ordered = true;
        await p.fill("#name", "سمير");
        await p.fill("#phone", "0770 44 55 66");
        await p.selectOption("#wilaya", "16");
        await p.selectOption("#commune", { index: 1 });
        await p.click("button[type=submit]");
        await p.waitForURL(/thanks/, { timeout: 10_000 }).catch(async () => {
          await p.screenshot({ path: "/tmp/claude-0/p17-order.png", fullPage: true });
          throw new Error(`no thanks page: ${(await p.locator("[role=alert], .text-danger").allInnerTexts()).join(" | ")}`);
        });
        const [[o]] = await db.query("SELECT landing_version FROM orders WHERE shop_id = ? AND landing_page_id = ? ORDER BY created_at DESC LIMIT 1", [shopId, pageId]);
        expect(o.landing_version === "B", "order of version B");
      }
      await ctx.close();
    }
    expect(seen.has("A") && seen.has("B"), `both running versions shown (saw ${[...seen].join()})`);
    const [[c]] = await db.query("SELECT COUNT(*) AS n FROM landing_stats WHERE page_id = ? AND version = 'C'", [pageId]);
    expect(Number(c.n) === 0, "paused C never shown");
  });

  await context.close();
}
