// Phase 20: plans modelled on ayor's — a pay-as-you-go plan (a balance of orders bought in packs, no expiry: each order
// uses one, an empty balance locks new orders, a top-up approved by the platform admin unlocks them) — and the
// ayor-style homepage (plan cards with the custom plan, comparison table, no sideways scrolling on phones).
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { BASE, createShop, db, expect, step } from "./helpers.mjs";

export default async function phase20(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  const plans = `${BASE}/ar/dashboard/plans`;
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'مصباح', 'lamp', 2000, '[]', '[]', '[]')", [randomUUID(), shopId]);
  await db.query("UPDATE shops SET plan_id = (SELECT id FROM plans WHERE code = 'orbit'), order_credits = 1 WHERE id = ?", [shopId]);

  const order = async (phone) => {
    const p = await browser.newPage();
    await p.goto(`${BASE}/store/shop-${tag}/p/lamp`);
    await p.fill("#name", "زبون");
    await p.fill("#phone", phone);
    await p.selectOption("#wilaya", "16");
    await p.selectOption("#commune", "حيدرة");
    await Promise.all([p.waitForURL(/\/thanks\?o=/), p.click("button[type=submit]")]);
    const id = new URL(p.url()).searchParams.get("o");
    await p.close();
    const [[row]] = await db.query("SELECT locked FROM orders WHERE id = ?", [id]);
    return { id, locked: row.locked === 1 };
  };
  const credits = async () => (await db.query("SELECT order_credits AS n FROM shops WHERE id = ?", [shopId]))[0][0].n;

  await step("pay as you go: an order uses the balance; once it is empty orders arrive locked", async () => {
    const first = await order("0552 00 00 01");
    expect(!first.locked && (await credits()) === 0, "first order paid by the balance");
    const second = await order("0552 00 00 02");
    expect(second.locked && (await credits()) === 0, "second order locked, balance stays at 0");
    await owner.goto(plans);
    const box = owner.locator("[data-testid=order-credits]");
    expect((await box.getAttribute("data-credits")) === "0", "balance shown on the plans page");
    expect(!(await owner.locator("[data-meter=maxOrdersPerMonth]").count()), "no monthly orders meter on a pay-as-you-go plan");
    await owner.locator("[data-testid=plan-notice][data-kind=locked]").waitFor();
  });

  await step("top-up: packs instead of months, approved by the admin, the locked order opens", async () => {
    const card = owner.locator("[data-plan-card=orbit]");
    expect((await card.innerText()).includes("لكل 100 طلبية") && (await card.innerText()).includes("الدفع عند الاستخدام"), "price per pack of 100 orders");
    await card.locator("button", { hasText: "شحن الرصيد" }).click();
    const options = await owner.locator("#pr-months option").allInnerTexts();
    expect(options[1].includes("2 × 100"), `packs offered (got ${options.join(" | ")})`);
    await owner.selectOption("#pr-months", "2");
    expect((await owner.locator("[data-testid=plan-amount]").innerText()).replace(/\s/g, "").includes("3600"), "2 × 1800");
    await owner.locator("[data-testid=plan-request-form] label", { hasText: "واتساب" }).click();
    await owner.locator("[data-testid=plan-request-form] button[type=submit]").click();
    await owner.locator("[data-testid=plan-pending]").getByText("2 × 100 طلبية").waitFor();

    const adminId = randomUUID();
    await db.query("INSERT INTO users (id, email, name, password_hash, locale, is_platform_admin) VALUES (?, ?, 'Admin', 'scrypt$00$00', 'ar', 1)", [adminId, `admin20-${tag}@test.dz`]);
    const token = randomBytes(32).toString("base64url");
    await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))", [createHash("sha256").update(token).digest("hex"), adminId]);
    const adminContext = await browser.newContext();
    await adminContext.addCookies([{ name: "sc_session", value: token, url: BASE }]);
    const admin = await adminContext.newPage();
    await admin.goto(`${BASE}/ar/admin/plan-requests`);
    const row = admin.locator(`tr[data-request-row="shop-${tag}"]`);
    expect((await row.innerText()).includes("2 × 100 طلبية"), "the admin sees packs");
    await row.locator("button", { hasText: "قبول وتفعيل" }).click();
    await row.getByText("مقبول").waitFor();
    await adminContext.close();

    const [[shop]] = await db.query("SELECT p.code, s.plan_expires_at AS until, s.order_credits AS credits FROM shops s JOIN plans p ON p.id = s.plan_id WHERE s.id = ?", [shopId]);
    expect(shop.code === "orbit" && shop.until === null && shop.credits === 199, `200 orders added, one used to open the locked order, no end date (got ${shop.credits}, ${shop.until})`);
    const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM orders WHERE shop_id = ? AND locked = 1", [shopId]);
    expect(n === 0, "no locked order left");
    const next = await order("0552 00 00 03");
    expect(!next.locked && (await credits()) === 198, "the next order uses the new balance");
  });

  await step("homepage: plan cards with the custom plan, the comparison table, phone width", async () => {
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await phone.goto(`${BASE}/ar`);
    const codes = await phone.locator("[data-testid=home-pricing] [data-plan]").evaluateAll((els) => els.map((e) => e.getAttribute("data-plan")).join());
    expect(codes === "starter,orbit,rocket,galaxy,custom", `free, pay as you go, 2 monthly, custom (got ${codes})`);
    expect((await phone.locator("[data-plan=starter]").innerText()).includes("مجانية"), "the free plan says so");
    expect((await phone.locator("[data-plan=orbit]").innerText()).includes("لكل 100 طلبية"), "price per pack");
    expect((await phone.locator("[data-plan=rocket]").innerText()).includes("مقترحة"), "the recommended plan is marked");
    expect((await phone.locator("[data-testid=plan-compare] tbody tr").count()) === 6, "5 limits + custom domain compared");
    expect((await phone.evaluate(() => document.documentElement.scrollWidth)) <= 390, "no sideways scrolling");
    await phone.close();
  });

  await context.close();
}
