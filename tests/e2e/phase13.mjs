// Phase 13: platform admin — access, overview, stores (search, plan and paid period, contracts, suspension),
// plans editor, system page (settings status, migrations, AI check, error log).
import { randomUUID } from "node:crypto";
import { BASE, createShop, db, expect, step } from "./helpers.mjs";

export default async function phase13(browser) {
  const merchant = await createShop(browser);
  const admin = await createShop(browser);
  await db.query("UPDATE users SET is_platform_admin = 1 WHERE id = (SELECT owner_id FROM shops WHERE id = ?)", [admin.shopId]);
  const a = await admin.context.newPage();
  a.on("dialog", (d) => d.accept());
  const m = await merchant.context.newPage();
  const adminBase = `${BASE}/ar/admin`;
  const ownerEmail = `owner-${merchant.tag}@test.dz`;

  await step("only the platform admin gets the admin area and its link", async () => {
    await m.goto(`${BASE}/ar/dashboard/products`);
    await m.waitForSelector("main");
    expect(!(await m.locator("[data-testid=admin-link]").count()), "no admin link for merchants");
    await m.goto(adminBase);
    await m.waitForLoadState("networkidle");
    expect(!(await m.locator("[data-tile]").count()), "merchants cannot open it");
    await a.goto(`${BASE}/ar/dashboard/products`);
    await a.locator("[data-testid=admin-link]").click();
    await a.waitForSelector("[data-tile=shops]");
    expect(Number(await a.locator("[data-tile=shops] [data-value]").innerText()) >= 2, "stores counted");
  });

  let shopPage;
  await step("stores: search by owner email, open the store's page", async () => {
    await a.goto(`${adminBase}/shops?q=${encodeURIComponent(ownerEmail)}`);
    const row = a.locator(`tr[data-shop="shop-${merchant.tag}"]`);
    await row.waitFor();
    expect((await a.locator("tr[data-shop]").count()) === 1, "one match");
    await row.locator("a").click();
    await a.waitForSelector("[data-testid=shop-info]");
    shopPage = a.url();
    expect((await a.locator("[data-testid=shop-info]").innerText()).includes(ownerEmail), "owner shown");
  });

  await step("plan and paid period set by the admin", async () => {
    await a.selectOption("#sp-plan", { label: "Business" });
    await a.fill("#sp-expires", "2030-06-30");
    await a.locator("[data-testid=shop-plan-form] button[type=submit]").click();
    await a.locator("[data-testid=shop-plan-form]").getByText("تم الحفظ").waitFor();
    const [[shop]] = await db.query("SELECT p.code, DATE_FORMAT(s.plan_expires_at, '%Y-%m-%d') AS until FROM shops s JOIN plans p ON p.id = s.plan_id WHERE s.id = ?", [merchant.shopId]);
    expect(shop.code === "business" && shop.until === "2030-06-30", `business until 2030-06-30 (got ${shop.code} ${shop.until})`);
    await a.reload();
    expect((await a.locator("[data-meter=maxProducts]").innerText()).includes("غير محدود"), "unlimited products shown");
  });

  await step("contracts: dates checked, limits override the plan, ending one", async () => {
    const form = a.locator("[data-testid=contract-form]");
    await a.fill("#ct-start", "2030-01-10");
    await a.fill("#ct-end", "2030-01-01");
    await form.locator("button[type=submit]").click();
    await form.getByText("تحقق من الحقول").waitFor();
    await a.fill("#ct-start", new Date(Date.now() - 86400_000).toISOString().slice(0, 10));
    await a.fill("#ct-end", "");
    await a.fill("#ct-maxOrdersPerMonth", "5");
    await a.fill("#ct-threshold", "60");
    await a.fill("#ct-notes", "عرض خاص للتاجر");
    await form.locator("button[type=submit]").click();
    await a.waitForSelector("[data-contract=active]");
    const [[c]] = await db.query("SELECT limits, alert_threshold FROM shop_contracts WHERE shop_id = ?", [merchant.shopId]);
    const limits = typeof c.limits === "string" ? JSON.parse(c.limits) : c.limits;
    expect(JSON.stringify(limits) === '{"maxOrdersPerMonth":5}' && c.alert_threshold === 60, "only the set limit is overridden");
    expect((await a.locator("[data-meter=maxOrdersPerMonth]").innerText()).includes("0 / 5"), "contract limit applies");
    await a.locator("[data-contract=active] button").click();
    await a.waitForSelector("[data-contract=ended]");
  });

  await step("a suspended store: hidden from customers, its team sees an explanation", async () => {
    await a.goto(shopPage);
    await a.locator("[data-testid=shop-status] button").click();
    await a.locator("[data-testid=shop-status] button", { hasText: "إعادة تفعيل المتجر" }).waitFor();
    await m.goto(`${BASE}/ar/dashboard/orders`);
    await m.waitForSelector("[data-testid=shop-suspended]");
    const store = await m.context().browser().newPage();
    await store.goto(`${BASE}/store/shop-${merchant.tag}`);
    await store.waitForSelector("[data-testid=not-found]");
    await store.close();
    await a.locator("[data-testid=shop-status] button").click();
    await a.locator("[data-testid=shop-status] button", { hasText: "إيقاف المتجر" }).waitFor();
    await m.goto(`${BASE}/ar/suspended`);
    await m.waitForURL(/\/ar\/dashboard/);
  });

  await step("plans editor: price, limits (required) and features", async () => {
    await a.goto(`${adminBase}/plans`);
    const pro = a.locator("[data-plan-editor=pro]");
    await pro.waitFor();
    await a.fill("#pe-price-pro", "4500");
    await a.fill("#pe-pro-maxStaff", "");
    await pro.locator("button[type=submit]").click();
    await pro.getByText("تحقق من الحقول").waitFor();
    await a.fill("#pe-pro-maxStaff", "8");
    await pro.locator("label", { hasText: "Google Sheets" }).locator("input").uncheck();
    await pro.locator("button[type=submit]").click();
    await pro.getByText("تم الحفظ").waitFor();
    const [[plan]] = await db.query("SELECT price_monthly, limits, features FROM plans WHERE code = 'pro'");
    const limits = typeof plan.limits === "string" ? JSON.parse(plan.limits) : plan.limits;
    const features = typeof plan.features === "string" ? JSON.parse(plan.features) : plan.features;
    expect(plan.price_monthly === 4500 && limits.maxStaff === 8 && !features.includes("google_sheets") && features.includes("custom_domain"), "plan saved");
    // Back to the original values (other runs on the same database expect them)
    await db.query("UPDATE plans SET price_monthly = 3900, limits = JSON_SET(limits, '$.maxStaff', 5), features = JSON_ARRAY_APPEND(features, '$', 'google_sheets') WHERE code = 'pro'");
  });

  await step("system: settings status, migrations, AI check, error log", async () => {
    await db.query("INSERT INTO error_logs (id, message, stack, path, route_type) VALUES (?, 'e2e-sample error', 'Error: e2e-sample\\n    at test', 'e2e/sample', 'action')", [randomUUID()]);
    await a.goto(`${adminBase}/system`);
    await a.waitForSelector("[data-testid=env-status]");
    expect((await a.locator("[data-env=DATABASE_URL]").innerText()).includes("✓"), "DATABASE_URL set");
    expect((await a.locator("[data-env=PAYMENT_RIB]").innerText()).includes("—"), "PAYMENT_RIB missing");
    await a.getByText("0010_settings").waitFor();
    await a.locator("[data-testid=system-check] button").click();
    const check = a.locator("[data-testid=system-check]");
    await check.locator("[data-result]").waitFor({ timeout: 40_000 });
    for (const step of ["database", "uploads", "cron", "ai-key", "ai-models", "ai-background", "ai-result"]) {
      expect((await check.locator(`[data-step=${step}]`).getAttribute("data-ok")) === "1", `full check: ${step} (${await check.locator(`[data-step=${step}]`).innerText()})`);
    }
    const log = a.locator("[data-testid=error-log]");
    await log.locator("[data-error='e2e/sample']").waitFor();
    await log.getByRole("button", { name: "مسح السجل" }).click();
    await log.getByText("لا توجد أخطاء مسجلة.").waitFor();
  });

  await merchant.context.close();
  await admin.context.close();
}
