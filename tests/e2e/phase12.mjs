// Phase 12: Store settings like Zimam (tabs) — General (details, footer profiles, device alerts, SEO), Domain (link, custom domain:
// paid plans only, DNS ownership + pointing checks, the store served on the merchant's domain (ordering included),
// the certificate check endpoint, roles.
import { randomUUID } from "node:crypto";
import { BASE, BROWSER_ARGS, createSession, createShop, db, expect, playwright, step } from "./helpers.mjs";
import { setDns } from "./mock-apps.mjs";

export default async function phase12(browser) {
  const { shopId, context, tag } = await createShop(browser);
  const owner = await context.newPage();
  owner.on("dialog", (d) => d.accept());
  const section = `${BASE}/ar/dashboard/settings`;
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'Montre', 'montre', 3000, '[]', '[]', '[]')", [randomUUID(), shopId]);
  await db.query("INSERT INTO shipping_rates (shop_id, wilaya_code, home_price, office_price) VALUES (?, 16, 500, 400)", [shopId]);
  const general = owner.locator("[data-testid=settings-general]");
  const newSlug = `boutique-${tag}`;

  await step("General: name, phone, description, location and social profiles (usernames) shown in the store footer", async () => {
    await owner.goto(section);
    await owner.locator("[data-settings-tab=general][aria-current=page]").waitFor();
    await owner.fill("#st-name", "Boutique Lina");
    await owner.fill("#st-phone", "123");
    await owner.fill("#st-instagram", "lina.shop");
    await owner.fill("#st-telegram", "@linashop");
    await owner.fill("#st-description", "Montres et bijoux depuis 2015");
    await owner.fill("#st-location", "Hydra, Alger");
    await general.locator("button[type=submit]").click();
    await general.getByText("رقم هاتف غير صحيح").waitFor();
    expect((await owner.inputValue("#st-description")) === "Montres et bijoux depuis 2015", "typed values kept");
    await owner.fill("#st-phone", "0555 66 77 88");
    await general.locator("button[type=submit]").click();
    await general.getByText("تم الحفظ").waitFor();
    const [[shop]] = await db.query("SELECT name, phone, design FROM shops WHERE id = ?", [shopId]);
    const design = typeof shop.design === "string" ? JSON.parse(shop.design) : shop.design;
    expect(shop.name === "Boutique Lina" && shop.phone === "0555667788" && design.socials.instagram === "https://instagram.com/lina.shop" && design.socials.telegram === "https://t.me/linashop", `saved (got ${JSON.stringify(design.socials)})`);
    const p = await browser.newPage();
    await p.goto(`${BASE}/store/shop-${tag}`);
    const footer = p.locator("[data-testid=store-footer]");
    await footer.getByText("Montres et bijoux depuis 2015").waitFor();
    await footer.locator("[data-testid=store-location]", { hasText: "Hydra, Alger" }).waitFor();
    expect((await footer.locator('a:has-text("Telegram")').getAttribute("href")) === "https://t.me/linashop", "telegram link");
    await p.close();
    // The device notifications card (sound kept in this browser)
    await owner.selectOption("[data-testid=alert-sound]", "cash");
    await owner.selectOption("[data-testid=alert-other]", "marimba");
    await owner.reload();
    await owner.waitForFunction(() => document.querySelector("[data-testid=alert-sound]")?.value === "cash", null, { timeout: 5000 }).catch(() => {});
    expect((await owner.inputValue("[data-testid=alert-sound]")) === "cash", "sound remembered on this device");
  });

  await step("Domain: the link is checked, the store moves to it; Language: saved as soon as it is chosen", async () => {
    await owner.goto(`${section}?tab=domain`);
    const other = await createShop(browser);
    await other.context.close();
    const slug = owner.locator("[data-testid=settings-slug]");
    await owner.fill("#st-slug", `shop-${other.tag}`);
    await slug.locator("button[type=submit]").click();
    await slug.getByText("رابط المتجر مستعمل").waitFor();
    await owner.fill("#st-slug", newSlug);
    await slug.getByText("تغيير الرابط يوقف الروابط القديمة").waitFor();
    await slug.locator("button[type=submit]").click();
    await slug.getByText("تم الحفظ").waitFor();
    await owner.goto(`${section}?tab=language`);
    await owner.click("[data-locale=fr]");
    await owner.waitForSelector("[data-testid=language-saved]");
    const [[shop]] = await db.query("SELECT slug, default_locale FROM shops WHERE id = ?", [shopId]);
    expect(shop.slug === newSlug && shop.default_locale === "fr", "saved");
    const p = await browser.newPage();
    await p.goto(`${BASE}/store/${newSlug}`);
    await p.waitForSelector("text=Boutique Lina");
    await p.getByText("Propulsé par Scaleitto").waitFor();
    await p.goto(`${BASE}/store/shop-${tag}`);
    await p.waitForSelector("[data-testid=not-found]");
    await p.close();
  });

  await step("Checkout: name optional, commune hidden, one delivery type — the store form and the order follow", async () => {
    await owner.goto(`${section}?tab=checkout`);
    const form = owner.locator("[data-testid=settings-checkout]");
    await form.locator("[data-field-rule=name] label", { hasText: "اختياري" }).click();
    await form.locator("[data-field-rule=commune] label", { hasText: "مخفي" }).click();
    await form.locator("[data-field-rule=delivery] label", { hasText: "مخفي" }).click();
    await form.locator("[data-field-rule=wilaya] label", { hasText: "اختياري" }).click();
    await form.locator("button[type=submit]").click();
    await form.getByText("تم الحفظ").waitFor();
    const p = await browser.newPage();
    await p.goto(`${BASE}/store/${newSlug}/p/montre`);
    await p.waitForSelector("#phone");
    expect(!(await p.locator("#commune").count()) && !(await p.locator("input[type=radio][name=deliveryType]").count()), "no commune, no delivery choice");
    await p.fill("#phone", "0770 22 33 44");
    await p.waitForTimeout(4200);
    await Promise.all([p.waitForURL(/\/thanks\?o=/), p.click("button[type=submit]")]);
    const [[o]] = await db.query("SELECT customer_name, commune, delivery_type, wilaya_code, shipping_price FROM orders WHERE id = ?", [new URL(p.url()).searchParams.get("o")]);
    expect(o.customer_name === "" && o.commune === "" && o.delivery_type === "home" && o.wilaya_code === 0 && o.shipping_price === 0, `order without name, wilaya or commune (got ${JSON.stringify(o)})`);
    // The dashboard's new-order alert sees it
    const latest = await (await owner.request.get(`${BASE}/api/orders/latest`)).json();
    expect(latest.number === 1001, `latest order number for the alerts (got ${JSON.stringify(latest)})`);
    await p.close();
    // Back to the usual form for the steps below
    await owner.reload();
    await form.locator("[data-field-rule=name] label", { hasText: "إجباري" }).click();
    await form.locator("[data-field-rule=commune] label", { hasText: "إجباري" }).click();
    await form.locator("[data-field-rule=delivery] label", { hasText: "اختياري" }).click();
    await form.locator("[data-field-rule=wilaya] label", { hasText: "إجباري" }).click();
    await form.locator("button[type=submit]").click();
    await form.getByText("تم الحفظ").waitFor();
    await db.query("DELETE FROM orders WHERE shop_id = ?", [shopId]);
  });

  await step("Product page: an option with many values is a dropdown, unless options are always buttons", async () => {
    const sizes = Array.from({ length: 8 }, (_, i) => String(36 + i));
    await db.query("UPDATE products SET options = ? WHERE shop_id = ? AND slug = 'montre'", [JSON.stringify([{ name: "Taille", values: sizes }]), shopId]);
    const p = await browser.newPage();
    await p.goto(`${BASE}/store/${newSlug}/p/montre`);
    await p.waitForSelector("[data-option-select=Taille]");
    await owner.goto(`${section}?tab=productPage`);
    await owner.locator("[data-testid=option-buttons]").check();
    await owner.waitForTimeout(800);
    await p.reload();
    await p.waitForSelector('[data-store-option="Taille"] button');
    expect(!(await p.locator("[data-option-select=Taille]").count()), "buttons now");
    await p.close();
    await db.query("UPDATE products SET options = '[]' WHERE shop_id = ? AND slug = 'montre'", [shopId]);
  });

  await step("SEO title and description (Store Design → home page settings) in the store's page head", async () => {
    await owner.goto(`${BASE}/ar/dashboard/store-design`);
    await owner.click("[data-testid=page-settings]");
    await owner.fill("#seo-title", "Montres de luxe à Alger");
    await owner.fill("#seo-description", "Livraison 58 wilayas, paiement à la livraison.");
    await owner.click("[data-testid=save-seo]");
    await owner.locator("[data-testid=home-seo]").getByText("تم الحفظ").waitFor();
    const p = await browser.newPage();
    await p.goto(`${BASE}/store/${newSlug}`);
    await p.waitForSelector("text=Boutique Lina");
    expect((await p.title()) === "Montres de luxe à Alger", `home title (got ${await p.title()})`);
    expect((await p.locator('meta[name="description"]').getAttribute("content")) === "Livraison 58 wilayas, paiement à la livraison.", "meta description");
    await p.goto(`${BASE}/store/${newSlug}/p/montre`);
    await p.waitForSelector("button[type=submit]");
    expect((await p.title()) === "Montre | Boutique Lina", `product title (got ${await p.title()})`);
    await p.close();
  });

  await step("policy pages (Store Design → Pages): footer links only for written ones, page in the store's language", async () => {
    await owner.goto(`${BASE}/ar/dashboard/store-design`);
    await owner.click("[data-panel-button=pages]");
    await owner.click("[data-policy=returns]");
    await owner.fill("#policy-returns", "Échange sous 7 jours.\nRemboursement si le produit est défectueux.");
    await owner.click("[data-testid=save-policy]");
    await owner.waitForSelector("#policy-returns", { state: "detached" });
    const p = await browser.newPage();
    await p.goto(`${BASE}/store/${newSlug}`);
    const links = p.locator("[data-testid=policy-links] a");
    await links.first().waitFor();
    expect((await links.count()) === 1 && (await links.first().innerText()) === "Échanges et retours", "one link, in French");
    await links.first().click();
    await p.waitForSelector("[data-testid=policy-page]");
    expect((await p.locator("[data-testid=policy-page]").innerText()).includes("Échange sous 7 jours."), "policy text");
    await p.goto(`${BASE}/store/${newSlug}/policies/shipping`);
    await p.waitForSelector("[data-testid=not-found]");
    await p.close();
  });

  const domain = `lina-${tag}.test`;
  await step("custom domain: paid plans only; DNS ownership then pointing are checked", async () => {
    await owner.goto(`${section}?tab=domain`);
    const card = owner.locator("[data-testid=settings-domain]");
    await card.getByText("الدومين الخاص متاح في الباقات المدفوعة").waitFor();
    await db.query("UPDATE shops SET plan_id = (SELECT id FROM plans WHERE code = 'rocket') WHERE id = ?", [shopId]);
    await owner.reload();
    await owner.fill("#domain", "not a domain");
    await card.locator("button[type=submit]").click();
    await card.getByText("اسم نطاق غير صحيح").waitFor();
    await owner.fill("#domain", `https://www.${domain.toUpperCase()}/`);
    await card.locator("button[type=submit]").click();
    await owner.waitForSelector("[data-testid=settings-domain][data-state=pending]");
    const token = (await owner.locator("[data-record=TXT]").innerText()).trim();
    expect(token.startsWith("scaleitto-verify=") && (await owner.locator("[data-record=CNAME]").innerText()).trim() === "stores.scaleitto.test", "records to add");
    await card.locator("button", { hasText: "تحقق" }).click();
    await card.getByText("لم نجد سجل TXT الصحيح بعد").waitFor();
    setDns(`_scaleitto.${domain}`, "TXT", [token]);
    setDns(`www.${domain}`, "CNAME", ["wrong.example.com"]);
    await card.locator("button", { hasText: "تحقق" }).click();
    await card.getByText("وجدنا: wrong.example.com").waitFor();
    setDns(`www.${domain}`, "CNAME", ["stores.scaleitto.test."]);
    await card.locator("button", { hasText: "تحقق" }).click();
    await owner.waitForSelector("[data-testid=settings-domain][data-state=verified]");
    const [[shop]] = await db.query("SELECT custom_domain, domain_verified_at FROM shops WHERE id = ?", [shopId]);
    expect(shop.custom_domain === domain && shop.domain_verified_at, "verified, stored without www");
    expect((await owner.locator("[data-testid=top-link]").getAttribute("href")) === `https://${domain}`, "dashboard links to the domain");
  });

  await step("the store runs on the merchant's domain, ordering included; another shop cannot take it", async () => {
    const { chromium } = playwright();
    const port = new URL(BASE).port || "80";
    const b = await chromium.launch({ args: [...BROWSER_ARGS, `--host-resolver-rules=MAP ${domain} 127.0.0.1, MAP www.${domain} 127.0.0.1`] });
    const p = await b.newPage();
    await p.goto(`http://www.${domain}:${port}/`);
    await p.waitForSelector("text=Boutique Lina");
    await p.locator(`a[href="/p/montre"]`).first().click();
    await p.waitForURL(`http://www.${domain}:${port}/p/montre`);
    await p.fill("#name", "Lina");
    await p.fill("#phone", "0770 12 34 56");
    await p.selectOption("#wilaya", "16");
    await p.selectOption("#commune", "Hydra");
    await Promise.all([p.waitForURL(new RegExp(`^http://www\\.${domain.replace(/\./g, "\\.")}:${port}/thanks\\?o=`)), p.click("button[type=submit]")]);
    const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM orders WHERE shop_id = ?", [shopId]);
    expect(n === 1, "order placed through the domain");
    await b.close();
    const check = (d) => fetch(`${BASE}/api/domains/check?domain=${d}`).then((r) => r.status);
    expect((await check(domain)) === 200 && (await check(`www.${domain}`)) === 200 && (await check("unknown.test")) === 404, "certificate check endpoint");
    const other = await createShop(browser);
    await db.query("UPDATE shops SET plan_id = (SELECT id FROM plans WHERE code = 'rocket') WHERE id = ?", [other.shopId]);
    const op = await other.context.newPage();
    await op.goto(`${section}?tab=domain`);
    await op.fill("#domain", domain);
    await op.locator("[data-testid=settings-domain] button[type=submit]").click();
    await op.getByText("هذا النطاق مستعمل في متجر آخر").waitFor();
    await other.context.close();
  });

  await step("back on the free plan the domain stops; removing it; agents have no settings", async () => {
    await db.query("UPDATE shops SET plan_id = (SELECT id FROM plans WHERE code = 'starter') WHERE id = ?", [shopId]);
    expect((await fetch(`${BASE}/api/domains/check?domain=${domain}`)).status === 404, "not served on the free plan");
    await db.query("UPDATE shops SET plan_id = (SELECT id FROM plans WHERE code = 'rocket') WHERE id = ?", [shopId]);
    await owner.goto(`${section}?tab=domain`);
    await owner.locator("[data-testid=settings-domain] button", { hasText: "إزالة الدومين" }).click();
    await owner.waitForSelector("[data-testid=settings-domain][data-state=none]");
    expect((await fetch(`${BASE}/api/domains/check?domain=${domain}`)).status === 404, "removed");
    const { token } = await createSession({ shopId, role: "agent", email: `agent12-${tag}@test.dz` });
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "sc_session", value: token, url: BASE }]);
    const agent = await ctx.newPage();
    await agent.goto(section);
    await agent.waitForURL((u) => !u.pathname.includes("settings"));
    await ctx.close();
  });

  await context.close();
}
