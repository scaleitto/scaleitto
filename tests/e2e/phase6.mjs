// Phase 6: call centers — team members (plan limit, roles, schedules, deactivation), order assignment
// (balanced, on shift, manual), agents limited to their orders, activity time, performance and
// schedule adherence, activity log.
import { randomUUID } from "node:crypto";
import { BASE, createShop, db, expect, step, setOrderStatus } from "./helpers.mjs";

// Algeria time now, as "HH:MM", shifted by some minutes
function algeriaTime(offsetMinutes) {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Algiers", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
}

export default async function phase6(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  owner.on("dialog", (d) => d.accept());
  const cc = `${BASE}/ar/dashboard/call-centers`;
  const orders = `${BASE}/ar/dashboard/orders`;
  const store = `${BASE}/store/shop-${tag}`;
  const id = Date.now().toString(36);
  const emails = { a: `agent-a-${id}@test.dz`, b: `agent-b-${id}@test.dz`, m: `manager-${id}@test.dz` };
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'ساعة', 'watch', 4500, '[]', '[]', '[]')", [randomUUID(), shopId]);
  const userId = async (email) => (await db.query("SELECT id FROM users WHERE email = ?", [email]))[0][0].id;

  async function placeOrder(phone) {
    const p = await browser.newPage();
    await p.goto(`${store}/p/watch`);
    await p.fill("#name", "زبون تجريبي");
    await p.fill("#phone", phone);
    await p.selectOption("#wilaya", "16");
    await p.selectOption("#commune", "Kouba");
    await Promise.all([p.waitForURL(/thanks\?o=/), p.click("button[type=submit]")]);
    const orderId = new URL(p.url()).searchParams.get("o");
    await p.close();
    return orderId;
  }

  async function addMember(name, email, role) {
    await owner.goto(cc);
    await owner.click('button:has-text("إضافة موظف")');
    const form = owner.locator("[data-testid=add-member]");
    await form.locator("#m-name").fill(name);
    await form.locator("#m-email").fill(email);
    await form.locator("#m-role").selectOption(role);
    await form.locator("#m-password").fill("agentpass123");
    await form.locator("button[type=submit]").click();
  }

  async function loginAs(email) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/ar/login`);
    await p.fill("#email", email);
    await p.fill("#password", "agentpass123");
    await Promise.all([p.waitForURL(/\/ar\/dashboard/), p.click("button[type=submit]")]);
    return { ctx, p };
  }

  await step("the plan's team limit blocks new members with a clear message", async () => {
    await addMember("أمين", emails.a, "agent");
    await owner.waitForSelector("text=وصلت إلى الحد الأقصى للموظفين في باقتك");
    await db.query("INSERT INTO shop_contracts (id, shop_id, start_date, limits) VALUES (UUID(), ?, CURDATE() - INTERVAL 1 DAY, ?)", [shopId, JSON.stringify({ maxStaff: 5 })]);
  });

  await step("the owner adds two agents and a manager; an email cannot be used twice", async () => {
    await addMember("أمين", emails.a, "agent");
    await owner.waitForSelector("text=تمت إضافة الموظف");
    await addMember("بلال", emails.b, "agent");
    await owner.waitForSelector(`[data-member="${emails.b}"]`);
    await addMember("مريم", emails.m, "manager");
    await owner.waitForSelector(`[data-member="${emails.m}"]`);
    await addMember("نسخة", emails.a, "agent");
    await owner.waitForSelector("text=هذا البريد مستعمل مسبقاً");
  });

  await step("working hours are saved for an agent", async () => {
    await owner.goto(cc);
    const card = owner.locator(`[data-member="${emails.a}"]`);
    await card.locator('button:has-text("تعديل")').click();
    await card.locator('input[name="hasSchedule"]').check();
    // The day boxes are hidden behind their labels: tick the unticked ones
    for (let d = 0; d < 7; d++)
      await card.locator(`input[name="days"][value="${d}"]`).evaluate((el) => {
        if (!el.checked) el.click();
      });
    await card.locator('input[name="start"]').fill(algeriaTime(-5));
    await card.locator('input[name="end"]').fill(algeriaTime(120));
    await card.locator("form button[type=submit]").click();
    await card.getByText("الأحد، الإثنين").waitFor();
  });

  let orderA;
  let orderB;
  await step("new orders are spread to the least busy agents", async () => {
    orderA = await placeOrder("0661000101");
    orderB = await placeOrder("0661000102");
    const [rows] = await db.query("SELECT assigned_to FROM orders WHERE id IN (?, ?)", [orderA, orderB]);
    const assignees = new Set(rows.map((r) => r.assigned_to));
    expect(assignees.size === 2 && assignees.has(await userId(emails.a)) && assignees.has(await userId(emails.b)), "one order each");
    const [[a]] = await db.query("SELECT id FROM orders WHERE assigned_to = ? AND shop_id = ?", [await userId(emails.a), shopId]);
    if (a.id !== orderA) [orderA, orderB] = [orderB, orderA];
  });

  let agentA;
  await step("an agent signs in, sees only their orders and cannot open the others", async () => {
    agentA = await loginAs(emails.a);
    const p = agentA.p;
    await p.goto(orders);
    expect((await p.locator("[data-order]").count()) === 1, "one order visible");
    await p.goto(`${orders}/${orderB}`);
    await p.waitForSelector("[data-testid=not-found]");
    await p.goto(`${orders}/${orderA}`);
    await setOrderStatus(p, "confirmed");
    await p.waitForSelector("[data-testid=history] >> text=أمين");
  });

  await step("working minutes are counted once per minute, and the agent shows online", async () => {
    const p = agentA.p;
    const first = await p.evaluate(() => fetch("/api/activity", { method: "POST" }).then((r) => r.status));
    await p.evaluate(() => fetch("/api/activity", { method: "POST" }));
    expect(first === 200, "heartbeat accepted");
    const [[row]] = await db.query("SELECT active_minutes, shift_minutes FROM member_activity WHERE shop_id = ? AND user_id = ?", [shopId, await userId(emails.a)]);
    expect(row.active_minutes === 1 && row.shift_minutes === 1, `one minute counted, inside the shift (${row.active_minutes}/${row.shift_minutes})`);
    const anon = await browser.newContext();
    expect((await anon.request.post(`${BASE}/api/activity`)).status() === 401, "anonymous heartbeat refused");
    await anon.close();
    await owner.goto(cc);
    await owner.locator(`[data-member="${emails.a}"] [data-testid=presence]`).getByText("متصل الآن").waitFor();
  });

  await step("performance shows confirmations, rates, working time and schedule adherence", async () => {
    await owner.goto(`${cc}/performance`);
    const card = owner.locator('[data-performance="أمين"]');
    const value = (key) => card.locator(`[data-metric="${key}"] dd`).innerText();
    expect((await value("assigned")) === "1" && (await value("confirmed")) === "1", "1 received, 1 confirmed");
    expect((await value("confirmRate")) === "100%", "confirmation rate");
    expect((await value("activeTime")).includes("1"), "working time");
    expect((await value("attendance")).startsWith("100%"), `attendance (${await value("attendance")})`);
    expect((await value("punctuality")) === "100%", "on time");
    expect((await value("open")) === "0", "nothing waiting");
    const b = owner.locator('[data-performance="بلال"]');
    expect((await b.locator('[data-metric="open"] dd').innerText()) === "1", "Bilal has one waiting");
    await owner.goto(`${cc}/performance?period=7d`);
    await owner.locator('[data-performance="أمين"]').waitFor();
  });

  await step("the activity log lists the team's actions with a link to the order", async () => {
    await owner.goto(`${cc}/activity`);
    const log = owner.locator("[data-testid=activity-log]");
    await log.getByText("تغيير الحالة: قيد الانتظار ← مؤكدة").waitFor();
    await log.locator("a", { hasText: "طلب #" }).first().waitFor();
  });

  await step("by shift: only agents in their working hours get new orders", async () => {
    await owner.goto(`${cc}/settings`);
    await owner.click('button[role=radio]:has-text("تلقائي حسب الدوام")');
    await owner.waitForSelector("text=تم الحفظ");
    // Amine (on shift) is busier than Bilal (no schedule): the balanced mode would pick Bilal
    const amine = await userId(emails.a);
    for (const n of [9001, 9002])
      await db.query("INSERT INTO orders (id, shop_id, number, customer_name, phone, wilaya_code, commune, delivery_type, subtotal, shipping_price, total, assigned_to, assigned_at) VALUES (UUID(), ?, ?, 'x', '0661999999', 16, 'x', 'home', 1, 0, 1, ?, NOW())", [shopId, n, amine]);
    const id1 = await placeOrder("0661000103");
    const [[o]] = await db.query("SELECT assigned_to FROM orders WHERE id = ?", [id1]);
    expect(o.assigned_to === (await userId(emails.a)), "assigned to the agent on shift");
  });

  await step("manual mode leaves new orders unassigned; a manager assigns them", async () => {
    await owner.goto(`${cc}/settings`);
    await owner.click('button[role=radio]:has-text("يدوي")');
    await owner.waitForSelector("text=تم الحفظ");
    const id2 = await placeOrder("0661000104");
    const [[o]] = await db.query("SELECT assigned_to FROM orders WHERE id = ?", [id2]);
    expect(o.assigned_to === null, "unassigned");
    await owner.goto(`${orders}/${id2}`);
    await owner.locator("[data-testid=order-form] #agent").selectOption({ label: "بلال" });
    await owner.click("[data-testid=save-order]");
    await owner.waitForSelector("[data-testid=history] >> text=أُسند الطلب إلى بلال");
    await owner.goto(`${orders}?agent=none`);
    expect(!(await owner.locator(`[data-order]`).filter({ hasText: "0661000104" }).count()), "no longer in the unassigned filter");
  });

  await step("a deactivated agent is signed out, cannot sign in, and their open orders are released", async () => {
    const agentB = await loginAs(emails.b);
    await owner.goto(cc);
    await owner.locator(`[data-member="${emails.b}"] button:has-text("تعطيل")`).click();
    await owner.locator(`[data-member="${emails.b}"]`).getByText("معطّل").waitFor();
    const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM orders WHERE assigned_to = ? AND status IN ('pending','call_back')", [await userId(emails.b)]);
    expect(Number(n) === 0, "open orders released");
    // Signed out at once: the next page sends them to the login page
    await agentB.p.goto(orders);
    await agentB.p.waitForURL("**/ar/login**");
    await agentB.p.fill("#email", emails.b);
    await agentB.p.fill("#password", "agentpass123");
    await agentB.p.click("button[type=submit]");
    await agentB.p.waitForSelector("text=تم تعطيل حسابك");
    await agentB.ctx.close();
  });

  await step("agents see their own performance only; managers cannot touch the owner", async () => {
    const p = agentA.p;
    await p.goto(cc);
    await p.waitForSelector("h1 >> text=أدائي");
    expect((await p.locator("[data-performance]").count()) === 1, "only their own card");
    await p.goto(`${cc}/performance`);
    await p.waitForURL((u) => u.pathname.endsWith("/call-centers"));
    await agentA.ctx.close();
    const manager = await loginAs(emails.m);
    await manager.p.goto(cc);
    const ownerCard = manager.p.locator("[data-member^='owner-']");
    expect(!(await ownerCard.locator('button:has-text("تعطيل")').count()), "no deactivate on the owner");
    expect(await manager.p.locator(`[data-member="${emails.a}"] button:has-text("تعطيل")`).count(), "can manage agents");
    await manager.ctx.close();
  });

  await context.close();
}
