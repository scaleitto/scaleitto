// Phase 0: auth, dashboard shell, sections, profile, roles, languages, mobile menu.
import { createSession, expect, step, db, BASE } from "./helpers.mjs";
import { lastLink } from "./mock-apps.mjs";

export default async function phase0(browser) {
  const id = Date.now().toString(36);
  const owner = { name: "Amine Test", email: `owner-${id}@test.dz`, password: "password123", shop: "متجر الاختبار", slug: `shop-${id}` };
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await step("home redirects to a language and renders", async () => {
    await page.goto(`${BASE}/`);
    expect(/\/(ar|fr|en)$/.test(page.url()), `redirected to ${page.url()}`);
    await page.goto(`${BASE}/ar`);
    expect((await page.locator("html").getAttribute("dir")) === "rtl", "arabic is RTL");
  });

  await step("register shows field errors, never a server error", async () => {
    await page.goto(`${BASE}/ar/register`);
    await page.fill("#shopSlug", "a");
    await page.fill("#password", "123");
    await page.click("button[type=submit]");
    await page.waitForSelector("text=كلمة المرور يجب أن تكون 8 أحرف على الأقل");
    expect(await page.locator("text=أحرفاً إنجليزية صغيرة وأرقاماً").count(), "slug error shown");
    expect(!(await page.locator("text=حدث خطأ غير متوقع").count()), "no unexpected error");
  });

  await step("register: phone required, the store link on the platform's address, the store language", async () => {
    await page.fill("#name", owner.name);
    await page.fill("#email", owner.email);
    await page.fill("#password", owner.password);
    await page.fill("#shopName", owner.shop);
    await page.fill("#shopSlug", owner.slug);
    const preview = await page.locator("[data-testid=store-link-preview]").innerText();
    expect(preview.endsWith(`/store/${owner.slug}`) && !preview.includes("localhost"), `the link shows the platform's address (got ${preview})`);
    await page.click("button[type=submit]");
    await page.waitForSelector("text=رقم هاتف غير صحيح");
    await page.fill("#phone", "0555 12 34 56");
    await page.selectOption("#storeLanguage", "fr");
  });

  await step("register creates the shop; the owner confirms the email, then opens the overview", async () => {
    await Promise.all([page.waitForURL("**/ar/verify"), page.click("button[type=submit]")]);
    // Until the email is confirmed the dashboard waits
    await page.goto(`${BASE}/ar/dashboard`);
    await page.waitForURL("**/ar/verify");
    const link = lastLink(owner.email);
    expect(link?.includes("/ar/verify?token="), `confirmation email sent (got ${link})`);
    await page.goto(`${BASE}/ar/verify?token=${new URL(link).searchParams.get("token")}`);
    await page.locator("[data-testid=email-verified]").waitFor();
    await page.goto(`${BASE}/ar/dashboard`);
    expect((await page.locator("main h1").filter({ visible: true }).innerText()).includes(owner.name), "welcome shows the name");
    const [[row]] = await db.query("SELECT u.phone, u.email_verified_at, s.default_locale FROM users u JOIN shops s ON s.owner_id = u.id WHERE u.email = ?", [owner.email]);
    expect(row.phone === "0555123456" && row.email_verified_at && row.default_locale === "fr", `phone, confirmation and store language saved (got ${JSON.stringify(row)})`);
  });

  await step("registering the same store link again is refused with a clear message", async () => {
    const other = await browser.newPage();
    await other.goto(`${BASE}/ar/register`);
    await other.fill("#name", "Other");
    await other.fill("#email", `other-${id}@test.dz`);
    await other.fill("#password", "password123");
    await other.fill("#phone", "0555 12 34 57");
    await other.fill("#shopName", "Other shop");
    await other.fill("#shopSlug", owner.slug);
    await other.click("button[type=submit]");
    await other.waitForSelector("text=رابط المتجر مستعمل");
    await other.close();
  });

  await step("owner sees the 17 sidebar entries and every page opens", async () => {
    const entries = page.locator("aside nav li[data-nav]");
    expect((await entries.count()) === 17, `17 sidebar entries (got ${await entries.count()})`);
    // An entry's page, or a group's first sub-section
    const hrefs = await entries.evaluateAll((els) => els.map((li) => li.querySelector("a").getAttribute("href")));
    for (const href of hrefs) {
      const res = await page.goto(`${BASE}${href}`);
      expect(res.status() === 200, `${href} → ${res.status()}`);
      expect(await page.locator("main h1").count(), `${href} has a title`);
      // The entry of the page (a group's first sub-section shares its link)
      const current = await page.locator('aside nav a[aria-current="page"]').first().getAttribute("href");
      expect(current === href, `${href} is highlighted (got ${current})`);
      expect(!(await page.locator("text=Application error").count()), `${href} has no crash`);
    }
  });

  await step("switching to English turns the dashboard LTR", async () => {
    await page.goto(`${BASE}/ar/dashboard/store-design`);
    await Promise.all([page.waitForURL("**/en/dashboard/store-design"), page.locator("[data-testid=lang-switch] summary").click().then(() => page.click("[data-testid=lang-switch] >> text=English"))]);
    expect((await page.locator("html").getAttribute("dir")) === "ltr", "english is LTR");
    expect(await page.locator("aside nav >> text=Store settings").count(), "english labels");
  });

  await step("profile: update name, wrong password refused, change password", async () => {
    await page.goto(`${BASE}/ar/dashboard/profile`);
    await page.fill("#name", "Amine Renamed");
    await page.fill("#phone", "0555 12 34 56");
    await page.click("form:has(#name) button[type=submit]");
    await page.waitForSelector("text=تم الحفظ");
    await page.fill("#currentPassword", "wrong-password");
    await page.fill("#newPassword", "newpassword456");
    await page.click("form:has(#newPassword) button[type=submit]");
    await page.waitForSelector("text=كلمة المرور الحالية غير صحيحة");
    await page.fill("#currentPassword", owner.password);
    await page.click("form:has(#newPassword) button[type=submit]");
    await page.waitForSelector("text=تم تغيير كلمة المرور");
  });

  await step("logout, old password refused, new password works", async () => {
    await Promise.all([page.waitForURL("**/ar/login"), page.locator("aside [data-testid=user-chip]:visible").first().click().then(() => page.locator("[data-testid=logout]:visible").first().click())]);
    await page.fill("#email", owner.email);
    await page.fill("#password", owner.password);
    await page.click("button[type=submit]");
    await page.waitForSelector("text=البريد الإلكتروني أو كلمة المرور غير صحيحة");
    await page.fill("#password", "newpassword456");
    await Promise.all([page.waitForURL("**/ar/dashboard"), page.click("button[type=submit]")]);
  });

  await step("call center agent only sees orders, scan, call centers and profile", async () => {
    const shopId = (await db.query("SELECT id FROM shops WHERE slug = ?", [owner.slug]))[0][0].id;
    const agent = await createSession({ shopId, role: "agent", email: `agent-${id}@test.dz` });
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "sc_session", value: agent.token, url: BASE }]);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/ar/dashboard`);
    await p.waitForURL("**/ar/dashboard/orders");
    const labels = await p.locator("aside nav li[data-nav]").evaluateAll((els) => els.map((li) => li.dataset.nav));
    expect(labels.join() === "orders,scan,callCenters,profile", `4 links (got ${labels.join(", ")})`);
    for (const blocked of ["products", "plans", "settings"]) {
      await p.goto(`${BASE}/ar/dashboard/${blocked}`);
      await p.waitForURL("**/ar/dashboard/orders");
    }
    await ctx.close();
  });

  await step("mobile: the menu opens and closes after navigating", async () => {
    const m = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await m.addCookies(await page.context().cookies());
    const p = await m.newPage();
    await p.goto(`${BASE}/ar/dashboard`);
    expect(!(await p.locator("aside").first().isVisible()), "desktop sidebar hidden on mobile");
    await p.click('header button[aria-label="القائمة"]');
    await Promise.all([p.waitForURL("**/dashboard/orders"), p.locator(".fixed aside li[data-nav=orders] a").first().click()]);
    await p.waitForTimeout(300);
    expect(!(await p.locator(".fixed aside").count()), "menu closed after navigating");
    await m.close();
  });

  await page.close();
}
