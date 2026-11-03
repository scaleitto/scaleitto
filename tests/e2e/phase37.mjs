// Phase 37 (Zimam parity): Apps → Fake OrderGuard → custom protection period and the checkout captcha (Cloudflare Turnstile,
// the platform's keys; the tests' fake siteverify accepts "good-…" tokens and answers "down" as unreachable).
import { randomUUID } from "node:crypto";
import { BASE, BROWSER_ARGS, createShop, db, expect, step } from "./helpers.mjs";

export default async function phase37(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  const store = `${BASE}/store/shop-${tag}`;
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'مصباح', 'lamp', 2000, '[]', '[]', '[]')", [randomUUID(), shopId]);
  const buyerCtx = await browser.newContext({ userAgent: BROWSER_ARGS[0].replace("--user-agent=", "") });
  const buyer = await buyerCtx.newPage();
  // Cloudflare's widget never loads in the tests (with internet access it would add its own answer): the test puts one in
  await buyerCtx.route("https://challenges.cloudflare.com/**", (r) => r.abort());
  // The answer is put in the form as the widget would
  const order = async (phone, token) => {
    await buyer.goto(`${store}/p/lamp`);
    await buyer.waitForSelector("button[type=submit]");
    await buyer.fill("#name", "أمين بلقاسم");
    await buyer.fill("#phone", phone);
    await buyer.selectOption("#wilaya", "16");
    await buyer.selectOption("#commune", "حيدرة");
    if (token) await buyer.evaluate((v) => document.querySelector("#phone").form.insertAdjacentHTML("beforeend", `<input type="hidden" name="cf-turnstile-response" value="${v}">`), token);
    await buyer.waitForTimeout(4200);
    await buyer.click("button[type=submit]");
  };
  const setGuard = async (captcha, fallback) => {
    await owner.goto(`${BASE}/ar/dashboard/integrations/apps/fakeGuard`);
    await owner.check(`[data-testid=captcha-${captcha}]`);
    await owner.check(`[data-testid=captcha-fallback-${fallback}]`);
    await owner.click("[data-testid=app-form] button[type=submit]");
    await owner.getByText("تم الحفظ").first().waitFor();
  };

  await step("protection period: a custom number of hours is saved", async () => {
    await owner.goto(`${BASE}/ar/dashboard/integrations/apps/fakeGuard`);
    expect(!(await owner.locator("[data-testid=guard-captcha]").getByText("غير مفعّل على المنصة").count()), "the platform has Turnstile keys");
    await owner.selectOption("[data-testid=guard-window]", "custom");
    await owner.fill("[data-testid=guard-custom-hours]", "36");
    await owner.click("[data-testid=app-form] button[type=submit]");
    await owner.getByText("تم الحفظ").first().waitFor();
    const [[s]] = await db.query("SELECT protection FROM shops WHERE id = ?", [shopId]);
    const p = typeof s.protection === "string" ? JSON.parse(s.protection) : s.protection;
    expect(p.duplicateHours === 36, `36 hours (got ${p.duplicateHours})`);
  });

  await step("captcha on every order: without the check refused, with it accepted", async () => {
    await setGuard("always", "accept");
    await order("0550 11 22 33", null);
    await buyer.getByText("أكّد أنك لست برنامجاً آلياً").waitFor();
    expect(await buyer.locator("[data-testid=turnstile]").count(), "the widget is in the form");
    await order("0550 11 22 33", "good-token-1");
    await buyer.waitForURL(/\/thanks\?o=/);
  });

  await step("Cloudflare unreachable: accepted or refused as the store chose", async () => {
    await order("0550 44 55 66", "down");
    await buyer.waitForURL(/\/thanks\?o=/);
    await setGuard("always", "refuse");
    await order("0550 77 88 99", "down");
    await buyer.getByText("تعذّر التحقق الآن").waitFor();
  });

  await step("only for suspicious buyers: an ordinary order needs no check", async () => {
    await setGuard("risky", "accept");
    await order("0661 23 45 67", null);
    await buyer.waitForURL(/\/thanks\?o=/);
  });

  await buyerCtx.close();
  await context.close();
}
