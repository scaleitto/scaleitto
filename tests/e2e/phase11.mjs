// Phase 11: plans — usage meters and alert threshold, orders over the monthly limit kept but locked
// (customer details hidden, no actions, unlocked by a higher limit or a new month), upgrade requests
// paid by transfer with a receipt, platform admin approval, paid period end, roles.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { BASE, createSession, createShop, db, expect, pngBuffer, step } from "./helpers.mjs";

export default async function phase11(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  owner.on("dialog", (d) => d.accept());
  const plans = `${BASE}/ar/dashboard/plans`;
  const productId = randomUUID();
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'حذاء', 'shoe', 3000, '[]', '[]', '[]')", [productId, shopId]);
  await db.query("INSERT INTO shipping_rates (shop_id, wilaya_code, home_price, office_price) VALUES (?, 16, 500, 400)", [shopId]);
  // A contract: 2 orders a month, alert at 50%
  const contractId = randomUUID();
  await db.query("INSERT INTO shop_contracts (id, shop_id, start_date, limits, alert_threshold) VALUES (?, ?, CURDATE() - INTERVAL 1 DAY, ?, 50)", [contractId, shopId, JSON.stringify({ maxOrdersPerMonth: 2 })]);

  const order = async (phone) => {
    const p = await browser.newPage();
    await p.goto(`${BASE}/store/shop-${tag}/p/shoe`);
    await p.fill("#name", "زبون سري");
    await p.fill("#phone", phone);
    await p.selectOption("#wilaya", "16");
    await p.selectOption("#commune", "حيدرة");
    await Promise.all([p.waitForURL(/\/thanks\?o=/), p.click("button[type=submit]")]);
    const id = new URL(p.url()).searchParams.get("o");
    await p.close();
    return id;
  };

  await step("plans page: current plan, usage meters, plan cards", async () => {
    await owner.goto(plans);
    await owner.waitForSelector("[data-testid=current-plan] [data-plan=starter]");
    expect((await owner.locator("[data-meter=maxProducts]").innerText()).includes("1 / 10"), "products 1 / 10");
    expect((await owner.locator("[data-meter=maxOrdersPerMonth]").innerText()).includes("0 / 2"), "contract limit shown");
    expect((await owner.locator("[data-plan-card]").count()) === 5, "4 plans and the custom one");
    expect(!(await owner.locator("[data-plan-card=starter] button").count()), "free plan cannot be requested");
  });

  await step("at the alert threshold a warning shows on every page", async () => {
    await order("0551 00 00 01");
    await owner.goto(`${BASE}/ar/dashboard/products`);
    const notice = owner.locator("[data-testid=plan-notice][data-kind=usage]");
    await notice.waitFor();
    expect((await notice.innerText()).includes("50%"), "50% of the orders used");
  });

  let lockedOrder;
  await step("over the limit: the customer orders normally, the order is locked", async () => {
    await order("0551 00 00 02");
    lockedOrder = await order("0551 00 00 03");
    const [[row]] = await db.query("SELECT locked, assigned_to FROM orders WHERE id = ?", [lockedOrder]);
    expect(row.locked === 1 && row.assigned_to === null, "kept, locked, not assigned");
    await owner.goto(`${BASE}/ar/dashboard/orders`);
    await owner.locator("[data-testid=plan-notice][data-kind=locked]").getByText("لديك 1 طلب مقفل").waitFor();
    const row1003 = owner.locator("tr[data-order='1003']");
    expect((await row1003.innerText()).includes("طلب مقفل") && !(await row1003.innerText()).includes("0551000003"), "list hides the customer");
    await owner.goto(`${BASE}/ar/dashboard/orders?q=0551000003`);
    expect(!(await owner.locator("tr[data-order='1003']").count()), "search by phone does not reveal it");
    await owner.goto(`${BASE}/ar/dashboard/orders/${lockedOrder}`);
    await owner.waitForSelector("[data-testid=order-locked]");
    const html = await owner.content();
    expect(!html.includes("0551000003") && !html.includes("زبون سري"), "no customer details in the page");
    expect(!(await owner.locator("[data-testid=order-form]").count()), "no actions on a locked order");
  });

  await step("upgrade request: payment details, receipt required, pending request", async () => {
    await owner.goto(plans);
    await owner.locator("[data-plan-card=rocket] button").click();
    const form = owner.locator("[data-testid=plan-request-form]");
    await form.waitFor();
    await owner.selectOption("#pr-months", "3");
    expect((await owner.locator("[data-testid=plan-amount]").innerText()).replace(/\s/g, "").includes("10500"), "3 × 3500");
    expect(!(await form.getByText("تحويل بنكي (RIB)").count()), "RIB hidden (not set up)");
    expect((await owner.locator("[data-testid=payment-account]").innerText()).includes("0012345678"), "CCP account shown");
    await form.locator("button[type=submit]").click();
    await owner.waitForSelector("text=ارفع صورة الوصل");
    await owner.setInputFiles("[data-testid=plan-request-form] [data-testid=image-input]", [{ name: "recu.png", mimeType: "image/png", buffer: pngBuffer([10, 120, 60]) }]);
    await form.locator("img").first().waitFor();
    await form.locator("button[type=submit]").click();
    await owner.waitForSelector("[data-testid=plan-pending]");
    const [[req]] = await db.query("SELECT * FROM plan_requests WHERE shop_id = ?", [shopId]);
    expect(req.status === "pending" && req.months === 3 && req.amount === 10500 && req.method === "ccp" && req.receipt_url.startsWith(`/uploads/${shopId}/`), "request saved");
    expect(await owner.locator("[data-plan-card=rocket] button").isDisabled(), "one request at a time");
  });

  await step("platform admin approves: plan and paid period updated", async () => {
    const outsider = await browser.newPage();
    await outsider.context().addCookies([{ name: "sc_session", value: (await createSession({ shopId, role: "manager", email: `mgr11-${tag}@test.dz` })).token, url: BASE }]);
    await outsider.goto(`${BASE}/ar/admin/plan-requests`);
    await outsider.waitForLoadState("networkidle");
    expect(!(await outsider.getByText("طلبات الباقات").count()) && !(await outsider.locator("[data-request-row]").count()), "not for merchants");
    await outsider.close();
    const adminId = randomUUID();
    await db.query("INSERT INTO users (id, email, name, password_hash, locale, is_platform_admin) VALUES (?, ?, 'Admin', 'scrypt$00$00', 'ar', 1)", [adminId, `admin-${tag}@test.dz`]);
    const token = randomBytes(32).toString("base64url");
    await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))", [createHash("sha256").update(token).digest("hex"), adminId]);
    const adminContext = await browser.newContext();
    await adminContext.addCookies([{ name: "sc_session", value: token, url: BASE }]);
    const admin = await adminContext.newPage();
    await admin.goto(`${BASE}/ar/admin/plan-requests`);
    const row = admin.locator(`tr[data-request-row="shop-${tag}"]`);
    await row.waitFor();
    expect((await row.locator("a", { hasText: "عرض" }).getAttribute("href")).startsWith(`/uploads/${shopId}/`), "receipt link");
    await row.locator("input").fill("شكراً، تم التفعيل");
    await row.locator("button", { hasText: "قبول وتفعيل" }).click();
    await row.getByText("مقبول").waitFor();
    await adminContext.close();
    // The row can change a moment before the server's write is visible here
    let shop;
    for (let i = 0; i < 25; i++) {
      [[shop]] = await db.query("SELECT p.code, s.plan_expires_at FROM shops s JOIN plans p ON p.id = s.plan_id WHERE s.id = ?", [shopId]);
      if (shop.code === "rocket") break;
      await new Promise((r) => setTimeout(r, 200));
    }
    const days = (new Date(shop.plan_expires_at) - Date.now()) / 86400_000;
    expect(shop.code === "rocket" && days > 85 && days < 95, `rocket for 3 months (got ${shop.code}, ${Math.round(days)} days)`);
    await owner.goto(plans);
    await owner.waitForSelector("[data-testid=current-plan] [data-plan=rocket]");
    await owner.locator("[data-testid=plan-requests] tr[data-request=approved]").getByText("شكراً، تم التفعيل").waitFor();
  });

  await step("a higher limit unlocks the order (and it can be worked on again)", async () => {
    // The custom contract (2 orders) still applies over the plan: it ends here
    await db.query("UPDATE shop_contracts SET end_date = CURDATE() - INTERVAL 1 DAY WHERE id = ?", [contractId]);
    await owner.goto(`${BASE}/ar/dashboard/orders/${lockedOrder}`);
    await owner.waitForSelector("[data-testid=order-form]");
    expect((await owner.content()).includes("0551000003"), "customer visible");
    expect(!(await owner.locator("[data-testid=order-locked]").count()), "no lock");
  });

  await step("locked orders of a past month open by themselves; an ended paid period falls back to the free plan", async () => {
    const old = randomUUID();
    await db.query("INSERT INTO orders (id, shop_id, number, customer_name, phone, wilaya_code, commune, delivery_type, subtotal, shipping_price, total, locked, created_at) VALUES (?, ?, 990, 'قديم', '0661000099', 16, 'x', 'home', 1000, 0, 1000, 1, NOW() - INTERVAL 40 DAY)", [old, shopId]);
    await owner.goto(`${BASE}/ar/dashboard/orders`);
    await owner.waitForSelector("tr[data-order='1001']");
    const [[row]] = await db.query("SELECT locked FROM orders WHERE id = ?", [old]);
    expect(row.locked === 0, "past month's order unlocked");
    await db.query("UPDATE shops SET plan_expires_at = NOW() - INTERVAL 1 DAY WHERE id = ?", [shopId]);
    await owner.goto(plans);
    await owner.waitForSelector("[data-testid=current-plan] [data-plan=starter]");
    await owner.getByText("انتهت باقتك Rocket").waitFor();
  });

  await step("cancel a request; managers get the warning without the plans page; agents nothing", async () => {
    await owner.locator("[data-plan-card=rocket] button").click();
    await owner.locator("[data-testid=plan-request-form] label", { hasText: "واتساب" }).click();
    expect((await owner.locator("[data-testid=plan-request-form] a[href^='https://wa.me/213555001122']").count()) === 1, "WhatsApp link with the platform number");
    await owner.locator("[data-testid=plan-request-form] button[type=submit]").click();
    await owner.waitForSelector("[data-testid=plan-pending]");
    await owner.locator("[data-testid=plan-pending] button").click();
    await owner.waitForSelector("[data-testid=plan-pending]", { state: "detached" });
    const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM plan_requests WHERE shop_id = ? AND status = 'cancelled'", [shopId]);
    expect(n === 1, "cancelled");
    // A small contract again (3 orders, alert at 80%) so the warning shows for the team
    await db.query("INSERT INTO shop_contracts (id, shop_id, start_date, limits, alert_threshold) VALUES (UUID(), ?, CURDATE(), ?, 80)", [shopId, JSON.stringify({ maxOrdersPerMonth: 3 })]);
    for (const [role, sees] of [["manager", true], ["agent", false]]) {
      const ctx = await browser.newContext();
      await ctx.addCookies([{ name: "sc_session", value: (await createSession({ shopId, role, email: `${role}11b-${tag}@test.dz` })).token, url: BASE }]);
      const p = await ctx.newPage();
      await p.goto(`${BASE}/ar/dashboard/orders`);
      await p.waitForSelector("main");
      const notice = p.locator("[data-testid=plan-notice]");
      if (sees) {
        await notice.waitFor();
        expect(!(await notice.locator("a").count()), "manager: no link to plans");
        await p.goto(plans);
        await p.waitForURL((u) => !u.pathname.includes("plans"));
      } else expect(!(await notice.count()), "agent: no warning");
      await ctx.close();
    }
  });

  await context.close();
}
