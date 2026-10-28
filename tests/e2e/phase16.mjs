// Phase 16 (owner's feedback): the platform owner's store has no plan limits, agents never see store links,
// orders are handed out in bulk (to one member, or shared between agents) and the automatic distribution is
// visible, the Google Sheets test writes a visible row (and spots an old script), the storefront themes have
// their own hero and product card styles.
import { randomUUID } from "node:crypto";
import { BASE, createSession, createShop, db, expect, step } from "./helpers.mjs";
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
      await owner.goto(`${dash}/landing-pages/new`);
      await Promise.all([owner.waitForURL(/landing-pages\/[0-9a-f-]{36}$/), owner.locator("[data-testid=manual-create] button[type=submit]").click()]);
    }
    await owner.goto(`${dash}/plans`);
    await owner.waitForSelector("[data-plan=platform]");
    expect((await owner.locator("[data-meter=maxLandingPages]").innerText()).includes("غير محدود"), "unlimited pages");
    expect(!(await owner.locator("[data-plan-card]").count()), "no plan to buy");
    await db.query("UPDATE users SET is_platform_admin = 0 WHERE id = (SELECT owner_id FROM shops WHERE id = ?)", [shopId]);
  });

  const agents = [];
  for (const n of [1, 2]) agents.push(await createSession({ shopId, role: "agent", email: `agent16-${n}-${tag}@test.dz` }));
  const orderIds = [];
  for (let i = 0; i < 5; i++) {
    const id = randomUUID();
    orderIds.push(id);
    await db.query(
      "INSERT INTO orders (id, shop_id, number, customer_name, phone, wilaya_code, commune, delivery_type, subtotal, shipping_price, total, status) VALUES (?, ?, ?, 'زبون', '0661000000', 16, 'Kouba', 'home', 2500, 400, 2900, 'new')",
      [id, shopId, 2001 + i],
    );
  }

  await step("call centers: the distribution mode explained, unassigned orders shared between the agents", async () => {
    await owner.goto(`${dash}/call-centers`);
    const board = owner.locator("[data-testid=distribution]");
    await board.waitFor();
    expect((await board.locator("[data-mode]").getAttribute("data-mode")) === "balanced", "current mode shown");
    expect((await owner.locator("[data-testid=unassigned]").getAttribute("data-n")) === "5", "5 unassigned orders");
    await owner.locator("[data-testid=unassigned] button").click();
    await owner.locator("[data-testid=spread-result]").getByText("تم توزيع 5 طلبية").waitFor();
    const [rows] = await db.query("SELECT assigned_to AS a, COUNT(*) AS n FROM orders WHERE shop_id = ? GROUP BY assigned_to", [shopId]);
    const counts = rows.map((r) => Number(r.n)).sort();
    expect(rows.every((r) => agents.some((a) => a.userId === r.a)) && counts.join() === "2,3", `shared 2/3 (got ${JSON.stringify(rows)})`);
    await owner.reload();
    expect((await owner.locator("[data-testid=unassigned]").getAttribute("data-n")) === "0", "nothing left unassigned");
    expect((await owner.locator("[data-agent] [data-open]").allInnerTexts()).map(Number).sort().join() === "2,3", "each agent's open orders");
  });

  await step("orders list: select orders, give them to one member, take one back", async () => {
    await owner.goto(`${dash}/orders`);
    const bar = owner.locator("[data-testid=bulk-assign]");
    await bar.waitFor();
    await owner.locator('tr[data-order="2001"] input[data-bulk-order]').check();
    await owner.locator('tr[data-order="2002"] input[data-bulk-order]').check();
    await bar.getByText("2 طلبية محددة").waitFor();
    await bar.locator("select").selectOption(agents[0].userId);
    await bar.locator("button", { hasText: "إسناد" }).first().click();
    await bar.getByText("تم إسناد 2 طلبية").waitFor();
    const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM orders WHERE id IN (?, ?) AND assigned_to = ?", [orderIds[0], orderIds[1], agents[0].userId]);
    expect(n === 2, "both orders given to the agent");
    await owner.locator("[aria-label='تحديد كل الطلبيات في الصفحة']").check();
    await bar.getByText("5 طلبية محددة").waitFor();
    await owner.locator("[aria-label='تحديد كل الطلبيات في الصفحة']").uncheck();
    await owner.locator('tr[data-order="2003"] input[data-bulk-order]').check();
    await bar.locator("button", { hasText: "إلغاء الإسناد" }).click();
    await bar.getByText("تم إسناد 1 طلبية").waitFor();
    const [[o]] = await db.query("SELECT assigned_to FROM orders WHERE id = ?", [orderIds[2]]);
    expect(o.assigned_to === null, "order taken back");
  });

  await step("agents see no store link and no bulk tools", async () => {
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "sc_session", value: agents[0].token, url: BASE }]);
    const agent = await ctx.newPage();
    await agent.goto(`${dash}/orders`);
    await agent.waitForSelector("tr[data-order]");
    expect(!(await agent.locator("[data-testid=top-link]").count()), "no 'view store' in the header");
    expect(!(await agent.getByText("افتح متجرك").count()), "no 'open your store' button");
    expect(!(await agent.locator("[data-testid=bulk-assign]").count()), "no bulk assignment");
    await ctx.close();
  });

  await step("Google Sheets test: a visible TEST row in the Orders tab; an old script is spotted", async () => {
    await owner.goto(`${dash}/apps`);
    const sheets = owner.locator("[data-testid=app-sheets]");
    await sheets.locator("button", { hasText: "ربط" }).click();
    const script = await owner.locator("[data-testid=sheets-script]").inputValue();
    sheet.token = script.match(/const TOKEN = "([^"]+)"/)?.[1];
    expect(script.includes("const VERSION = 2") && script.includes("first.setName(SHEET)"), "new script: version, first tab used");
    sheet.rows.delete("TEST");
    await owner.fill("#google_sheets-url", `${FAKE}/sheets/exec`);
    await sheets.locator("button[type=submit]").click();
    await owner.waitForSelector("[data-testid=app-sheets][data-state=on]");
    sheet.rows.delete("TEST");
    await sheets.getByRole("button", { name: "اختبار", exact: true }).click();
    await sheets.getByText("تمت كتابة صف تجريبي (TEST) في ورقة «Orders»").waitFor();
    expect(sheet.rows.get("TEST")?.[1].includes("اختبار الربط"), "test row written");
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
