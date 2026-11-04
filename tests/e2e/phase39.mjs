// Phase 39: Plans like Zimam's "Subscription & Billing" — credit balance, invoices, payment method (online through the platform's
// SATIM test account / local), prepaid term with its discount, a plan paid online and active at once, feature packs bought with
// credits for this month.
import { BASE, createShop, db, expect, step } from "./helpers.mjs";

export default async function phase39(browser) {
  const { shopId, context } = await createShop(browser);
  const owner = await context.newPage();
  const plans = `${BASE}/ar/dashboard/plans`;
  const until = async (fn, what) => {
    for (let i = 0; i < 25; i++) {
      if (await fn()) return;
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(false, what);
  };

  await step("the page: credit balance, invoices, plans priced for the chosen term", async () => {
    await db.query("UPDATE shops SET credits = 2000 WHERE id = ?", [shopId]);
    await owner.goto(plans);
    expect((await owner.locator("[data-testid=credit-pill]").innerText()).includes("2"), "credit balance shown");
    await owner.locator("[data-testid=plan-requests]").waitFor();
    const [[rocket]] = await db.query("SELECT price_monthly AS price FROM plans WHERE code = 'rocket'");
    const price = () => owner.locator("[data-plan-card=rocket] [data-testid=plan-price]").innerText().then((x) => Number(x.replace(/\D/g, "")));
    expect((await price()) === rocket.price, "one month");
    await owner.click("[data-term='12']");
    expect((await price()) === Math.round(rocket.price * 12 * 0.75), "12 months −25%");
    expect((await owner.locator("[data-pay=online]").getAttribute("aria-pressed")) === "true", "online payment offered first");
  });

  await step("a plan paid online (CIB through the platform's SATIM): back on the page, the plan is active at once", async () => {
    await owner.click("[data-term='3']");
    await owner.click("[data-gateway=cib]").catch(() => {});
    await Promise.all([owner.waitForURL(/\/dashboard\/plans\?request=/), owner.locator("[data-plan-card=rocket] [data-action=subscribe]").click()]);
    await owner.getByText("تم الدفع: باقتك مفعّلة الآن.").waitFor();
    let shop;
    await until(async () => {
      [[shop]] = await db.query("SELECT p.code, s.plan_expires_at FROM shops s JOIN plans p ON p.id = s.plan_id WHERE s.id = ?", [shopId]);
      return shop.code === "rocket";
    }, "plan active");
    const days = (new Date(shop.plan_expires_at) - Date.now()) / 86400_000;
    expect(days > 85 && days < 95, `3 months (got ${Math.round(days)} days)`);
    const [[req]] = await db.query("SELECT method, status, months, provider_ref FROM plan_requests WHERE shop_id = ?", [shopId]);
    expect(req.method === "online" && req.status === "approved" && req.months === 3 && req.provider_ref.startsWith("cib:"), `request (got ${JSON.stringify(req)})`);
    await owner.locator("[data-testid=plan-requests] tr[data-request=approved]").waitFor();
  });

  await step("feature packs: 500 more orders this month for 1,500 credits; too few credits = refused", async () => {
    const [[before]] = await db.query("SELECT JSON_EXTRACT(limits, '$.maxOrdersPerMonth') AS n FROM plans WHERE code = 'rocket'");
    await owner.locator("[data-pack=orders500] [data-action=buy-pack]").click();
    await owner.getByText("تمت إضافة الحزمة لهذا الشهر").waitFor();
    const [[shop]] = await db.query("SELECT credits FROM shops WHERE id = ?", [shopId]);
    expect(shop.credits === 500, `credits spent (got ${shop.credits})`);
    await owner.reload();
    expect((await owner.locator("[data-testid=current-plan]").innerText()).replace(/\s/g, "").includes(`/${Number(before.n) + 500}`), "the month's order quota grows");
    expect(await owner.locator("[data-pack=orders500] [data-action=buy-pack]").isDisabled(), "not enough credits left");
  });

  await context.close();
}
