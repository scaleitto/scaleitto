// Phase 31 (Zimam parity): the call center like Zimam — the owner's agent cards and "Create New Agent" (name, optional
// email, username, password), the portal sign-in (store ID + username + password), the agent's dashboard (today,
// 7-day trend, confirmation rate, totals) and orders (their own only, no agent column, no scan), log out.
import { randomUUID } from "node:crypto";
import { BASE, BROWSER_ARGS, createShop, db, expect, step } from "./helpers.mjs";

export default async function phase31(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  const slug = `shop-${tag}`;
  const cc = `${BASE}/ar/dashboard/call-centers`;
  const portal = `${BASE}/ar/call-center`;
  const username = `imane.${tag}`;
  await db.query("INSERT INTO shop_contracts (id, shop_id, start_date, limits) VALUES (UUID(), ?, CURDATE() - INTERVAL 1 DAY, ?)", [shopId, JSON.stringify({ maxStaff: 5 })]);
  const productId = randomUUID();
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'مكواة', 'iron', 3000, '[]', '[]', '[]')", [productId, shopId]);

  await step("Call center: Zimam's empty state, and 'Add agent' opens Create New Agent", async () => {
    await owner.goto(cc);
    await owner.locator("[data-testid=no-agents]").getByText("لا يوجد موظفون بعد").waitFor();
    await owner.click("[data-testid=add-agent]");
    await owner.locator("[data-testid=agent-dialog]").getByText("إنشاء موظف جديد").waitFor();
    expect(!(await owner.locator("[data-testid=agent-dialog] #m-role").count()), "no role field (agents only)");
  });

  await step("an agent without email: username checked, card shows @username and the creation date", async () => {
    const form = owner.locator("[data-testid=add-member]");
    await form.locator("#m-name").fill("إيمان");
    await form.locator("#m-username").fill("Bad Name!");
    await form.locator("#m-password").fill("agentpass123");
    await form.locator("button[type=submit]").click();
    await form.getByText("اسم المستخدم: أحرف إنجليزية صغيرة").waitFor();
    await form.locator("#m-username").fill(username);
    await form.locator("button[type=submit]").click();
    const card = owner.locator(`[data-username="${username}"]`);
    await card.waitFor();
    expect((await card.locator("[data-testid=member-username]").innerText()).trim() === `@${username}`, "@username");
    expect(!(await card.getByText("agents.invalid").count()), "internal email hidden");
    await card.getByText("أُنشئ:").waitFor();
    // With an agent, the sign-in link to give them
    expect((await owner.locator("[data-testid=store-id]").innerText()) === slug, "store ID shown");
    expect((await owner.locator("[data-testid=portal-link] a").getAttribute("href")).endsWith(`/ar/call-center/login?store=${slug}`), "portal link");
    const [[m]] = await db.query("SELECT role, username FROM shop_members WHERE shop_id = ? AND username = ?", [shopId, username]);
    expect(m?.role === "agent", "saved as an agent");
  });

  const [[agentRow]] = await db.query("SELECT user_id AS id FROM shop_members WHERE shop_id = ? AND username = ?", [shopId, username]);
  // Two orders for the agent (one confirmed today by them), one for nobody
  const order = async (number, assigned) => {
    const id = randomUUID();
    await db.query(
      "INSERT INTO orders (id, shop_id, number, status, customer_name, phone, wilaya_code, commune, subtotal, shipping_price, total, assigned_to, assigned_at) VALUES (?, ?, ?, 'pending', 'زبون', '0550000001', 16, 'Kouba', 3000, 0, 3000, ?, ?)",
      [id, shopId, number, assigned, assigned ? new Date() : null],
    );
    await db.query("INSERT INTO order_items (id, order_id, shop_id, product_id, name, unit_price, quantity, total) VALUES (UUID(), ?, ?, ?, 'مكواة', 3000, 1, 3000)", [id, shopId, productId]);
    return id;
  };
  const mine = await order(7001, agentRow.id);
  await order(7002, agentRow.id);
  await order(7003, null);

  const agentCtx = await browser.newContext({ viewport: { width: 1366, height: 900 }, userAgent: BROWSER_ARGS[0].replace("--user-agent=", "") });
  const p = await agentCtx.newPage();

  await step("portal sign-in: wrong password refused, store ID + username signs in to the dashboard", async () => {
    await p.goto(`${portal}/login?store=${slug}`);
    expect((await p.inputValue("#store")) === slug, "store ID filled from the link");
    await p.fill("#username", username);
    await p.fill("#password", "wrong-password");
    await p.click("button[type=submit]");
    await p.getByText("البريد الإلكتروني أو كلمة المرور غير صحيحة").waitFor();
    await p.fill("#password", "agentpass123");
    await Promise.all([p.waitForURL((u) => u.pathname === "/ar/call-center"), p.click("button[type=submit]")]);
    await p.locator("[data-testid=agent-dashboard]").waitFor();
    const nav = await p.locator("aside nav li[data-nav]").evaluateAll((els) => els.map((li) => li.dataset.nav));
    expect(nav.join() === "overview,orders", `Dashboard + Orders (got ${nav.join()})`);
    expect((await p.locator("[data-testid=today-assigned] [data-value]").innerText()) === "2", "2 assigned today");
    expect(!(await p.locator("[data-testid=store-card], [data-testid=top-link]").count()), "no store link");
  });

  await step("orders: only theirs, no agent column, no scan; confirming counts on the dashboard", async () => {
    await p.click("aside [data-nav=orders] a");
    await p.waitForURL((u) => u.pathname === "/ar/call-center/orders");
    await p.locator("h1").getByText("إدارة الطلبات").waitFor();
    expect((await p.locator("[data-order]").count()) === 2, "two orders");
    expect(!(await p.locator("[data-field=agent]").count()) && !(await p.locator("[data-testid=scan-link]").count()), "no agent column, no scan");
    await p.locator('[data-order="7001"] [data-testid=edit-order]').click();
    await p.waitForURL((u) => u.pathname === "/ar/call-center/orders" && u.searchParams.get("edit") === mine);
    await p.locator("[data-testid=edit-order-dialog] [data-testid=order-form]").waitFor();
    // Confirm from the list's inline status
    await p.goto(`${portal}/orders`);
    await p.locator('[data-order="7001"] select[data-field=status]').selectOption("confirmed");
    for (let i = 0; i < 40; i++) {
      const [[o]] = await db.query("SELECT status FROM orders WHERE id = ?", [mine]);
      if (o.status === "confirmed") break;
      await p.waitForTimeout(250);
    }
    await p.goto(portal);
    expect((await p.locator("[data-testid=today-confirmed] [data-value]").innerText()) === "1", "1 confirmed today");
    expect((await p.locator("[data-testid=rate]").innerText()).includes("50%"), "rate 1/2");
    expect((await p.locator("[data-testid=total-assigned] [data-value]").innerText()) === "2", "total assigned");
  });

  await step("the dashboard's pages stay closed to agents; log out returns to the portal sign-in", async () => {
    for (const path of ["", "/scan", "/call-centers", "/profile", "/products"]) {
      await p.goto(`${BASE}/ar/dashboard${path}`);
      await p.waitForURL((u) => u.pathname === "/ar/call-center");
    }
    await Promise.all([p.waitForURL((u) => u.pathname === "/ar/call-center/login"), p.click("aside [data-testid=nav-logout]")]);
    await p.goto(portal);
    await p.waitForURL((u) => u.pathname === "/ar/call-center/login");
  });

  await step("owners are sent to their dashboard from the portal", async () => {
    await owner.goto(portal);
    await owner.waitForURL((u) => u.pathname === "/ar/dashboard");
  });

  await step("agent card like Zimam: edit, copy sign-in details, portal link; deleting signs the agent out and releases their orders", async () => {
    await owner.goto(`${BASE}/ar/dashboard/call-centers`);
    const card = owner.locator(`[data-username="${username}"]`);
    expect((await card.locator("[data-testid=agent-portal]").getAttribute("href")).endsWith(`/ar/call-center/login?store=${slug}`), "portal link on the card");
    expect(await card.locator("[data-testid=agent-edit]").count(), "edit button");
    expect(await card.locator("[data-testid=agent-copy]").count(), "copy button");
    owner.once("dialog", (d) => d.accept());
    await card.locator("[data-testid=agent-remove]").click();
    await card.waitFor({ state: "detached" });
    const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM shop_members WHERE shop_id = ? AND user_id = ?", [shopId, agentRow.id]);
    const [[{ s }]] = await db.query("SELECT COUNT(*) AS s FROM sessions WHERE user_id = ?", [agentRow.id]);
    const [[{ o }]] = await db.query("SELECT COUNT(*) AS o FROM orders WHERE shop_id = ? AND assigned_to = ? AND status IN ('pending','call_back')", [shopId, agentRow.id]);
    expect(Number(n) === 0 && Number(s) === 0 && Number(o) === 0, `membership, sessions and open orders gone (${n}/${s}/${o})`);
    await owner.locator("[data-testid=no-agents]").waitFor();
  });

  await agentCtx.close();
  await context.close();
}
