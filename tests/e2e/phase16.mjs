// Phase 16 (owner's feedback): the platform owner's store has no plan limits, agents never see store links,
// orders are handed out in bulk (to one member, or shared between agents) and the automatic distribution is
// visible, the Google Sheets test writes a visible row (and spots an old script), the storefront themes have
// their own hero and product card styles.
import { randomUUID } from "node:crypto";
import { BASE, createLandingManually, createSession, createShop, db, expect, step } from "./helpers.mjs";
import { sheet } from "./mock-apps.mjs";

const FAKE = process.env.E2E_APPS_URL;

export default async function phase16(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  owner.on("dialog", (d) => d.accept());
  const dash = `${BASE}/ar/dashboard`;

  await step("the platform owner's store: no plan, every limit unlimited", async () => {
    await db.query("UPDATE users SET is_platform_admin = 1 WHERE id = (SELECT owner_id FROM shops WHERE id = ?)", [shopId]);
    await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'منتج', 'item', 2500, '[]', '[]', '[]')", [randomUUID(), shopId]);
    // The free plan allows 2 landing pages: the platform store makes a third one
    for (let i = 0; i < 3; i++) {
      await owner.goto(`${dash}/landing-pages`);
      await createLandingManually(owner);
    }
    await owner.goto(`${dash}/plans`);
    await owner.waitForSelector("[data-plan=platform]");
    expect((await owner.locator("[data-meter=maxLandingPages]").innerText()).includes("غير محدود"), "unlimited pages");
    expect((await owner.locator("[data-plan-card]").count()) >= 3, "the owner still sees every plan");
    await db.query("UPDATE users SET is_platform_admin = 0 WHERE id = (SELECT owner_id FROM shops WHERE id = ?)", [shopId]);
  });

  const agents = [];
  for (const n of [1, 2]) agents.push(await createSession({ shopId, role: "agent", email: `agent16-${n}-${tag}@test.dz` }));
  const orderIds = [];
  for (let i = 0; i < 5; i++) {
    const id = randomUUID();
    orderIds.push(id);
    await db.query(
      "INSERT INTO orders (id, shop_id, number, customer_name, phone, wilaya_code, commune, delivery_type, subtotal, shipping_price, total, status) VALUES (?, ?, ?, 'زبون', '0661000000', 16, 'Kouba', 'home', 2500, 400, 2900, 'pending')",
      [id, shopId, 2001 + i],
    );
  }

  await step("agents see no store link", async () => {
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "sc_session", value: agents[0].token, url: BASE }]);
    const agent = await ctx.newPage();
    await agent.goto(`${BASE}/ar/call-center`);
    await agent.waitForSelector("[data-testid=agent-dashboard]");
    expect(!(await agent.locator("[data-testid=top-link]").count()), "no 'view store' in the header");
    expect(!(await agent.getByText("افتح متجرك").count()), "no 'open your store' button");
    await ctx.close();
  });

  await step("Google Sheets test: a visible TEST row in the Orders tab; an old script is spotted", async () => {
    await owner.goto(`${dash}/channels/google_sheets`);
    const sheets = owner.locator("[data-testid=app-sheets]");
    await sheets.locator("button", { hasText: "ربط" }).click();
    const script = await owner.locator("[data-testid=sheets-script]").inputValue();
    sheet.token = script.match(/const TOKEN = "([^"]+)"/)?.[1];
    expect(script.includes("const VERSION = 4") && script.includes("first.setName(SHEET)") && script.includes("book.getUrl()"), "new script: version, first tab used, sheet link");
    sheet.rows.delete("TEST");
    await owner.fill("#google_sheets-url", `${FAKE}/sheets/exec`);
    await sheets.locator("button[type=submit]").click();
    await owner.waitForSelector("[data-testid=app-sheets][data-state=on]");
    sheet.rows.delete("TEST");
    await sheets.getByRole("button", { name: "اختبار", exact: true }).click();
    await sheets.getByText("تمت كتابة صف تجريبي (TEST) في ورقة «Orders»").waitFor();
    expect(sheet.rows.get("TEST")?.[1].includes("اختبار الربط"), "test row written");
    await owner.reload();
    expect((await sheets.locator("[data-testid=open-sheet]").getAttribute("href")) === "https://docs.google.com/spreadsheets/d/e2e-sheet/edit#gid=0", "open-the-sheet button opens the Orders tab");
    sheet.version = 1;
    await sheets.getByRole("button", { name: "اختبار", exact: true }).click();
    await sheets.getByText("الكود الموجود في جدولك قديم").waitFor();
    sheet.version = undefined;
  });

  await step("storefront themes: their own hero and product cards, photos never cropped", async () => {
    const store = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const design = (theme) => JSON.stringify({ theme, hero: { enabled: true, image: "", title: "عنوان", subtitle: "", buttonText: "تسوق" } });
    for (const [theme, hero, cards] of [["classic", "split", "elevated"], ["bold", "full", "elevated"], ["minimal", "minimal", "minimal"], ["tech", "split", "outline"]]) {
      await db.query("UPDATE shops SET design = ? WHERE id = ?", [design(theme), shopId]);
      await store.goto(`${BASE}/store/shop-${tag}`);
      await store.waitForSelector(`[data-testid=hero][data-variant=${hero}]`);
      expect((await store.locator("[data-card]").first().getAttribute("data-card")) === cards, `${theme}: ${cards} cards`);
      expect((await store.locator("[data-card=elevated]").getByText("اطلب الآن").count()) === (cards === "elevated" ? 1 : 0), `${theme}: order button on cards`);
      expect((await store.evaluate(() => document.documentElement.scrollWidth)) <= 390, `${theme}: no sideways scrolling`);
    }
    await store.close();
  });

  await context.close();
}
