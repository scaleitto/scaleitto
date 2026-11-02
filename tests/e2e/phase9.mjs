// Phase 9: pixels like Zimam — the "Pixels & Analytics" grid (5 apps) and one page per app: Meta, TikTok and Snapchat
// take a list of ad accounts, Google Analytics and Tag Manager one ID. Browser events (only the page's pixels),
// server-side purchases (Conversions API / Events API / Snap CAPI / Measurement Protocol) at order, confirmation or
// delivery, sent once per order, the test button, the log, stopping and removing an account, roles and tenant isolation.
import { randomUUID } from "node:crypto";
import { BASE, createSession, createShop, db, expect, step, setOrderStatus, until } from "./helpers.mjs";
import { received } from "./mock-pixels.mjs";

const META = "123456789012345";
const TIKTOK = "CTEST1234567890ABCD";
const GA4 = "G-TEST12345";
const GTM = "GTM-ABC1234";
const SNAP = "a1b2c3d4-0000-4000-8000-abcdef123456";

// The ad platforms' real scripts are never loaded in tests: the pixels' own queues show what was sent.
async function blockTrackers(context) {
  await context.route(/connect\.facebook\.net|analytics\.tiktok\.com|googletagmanager\.com|sc-static\.net/, (route) => route.abort());
}
const fbCalls = (page) => page.evaluate(() => (window.fbq?.queue ?? []).map((args) => Array.from(args)));
const ttCalls = (page, id) => page.evaluate((pixel) => (window.ttq?._i?.[pixel] ?? []).map((args) => Array.from(args)), id);
const snapCalls = (page) => page.evaluate(() => (window.snaptr?.queue ?? []).map((args) => Array.from(args)));
const dataLayer = (page) => page.evaluate(() => (window.dataLayer ?? []).map((x) => (x && typeof x === "object" && "length" in x ? Array.from(x) : x)));

async function waitFor(fn, what, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Expected: ${what}`);
}

export default async function phase9(browser) {
  const { shopId, context, tag } = await createShop(browser);
  await blockTrackers(context);
  const owner = await context.newPage();
  owner.on("dialog", (d) => d.accept());
  const section = `${BASE}/ar/dashboard/integrations/pixels`;
  const store = `${BASE}/store/shop-${tag}`;
  const watch = randomUUID();
  const bag = randomUUID();
  await db.query("INSERT INTO products (id, shop_id, name, slug, price, images, options, offers) VALUES (?, ?, 'ساعة', 'watch', 3000, '[]', '[]', '[]'), (?, ?, 'حقيبة', 'bag', 5000, '[]', '[]', '[]')", [watch, shopId, bag, shopId]);
  await db.query("INSERT INTO shipping_rates (shop_id, wilaya_code, home_price, office_price) VALUES (?, 16, 500, 400)", [shopId]);

  const appPage = (p) => `${section}/${p}`;
  const save = async (tag) => {
    await owner.click("[data-testid=pixel-save]");
    if (tag) await owner.waitForSelector(`[data-pixel="${tag}"]`);
  };
  const advanced = async (i) => owner.locator(`[data-account="${i}"] details summary`).click();

  await step("Pixels & Analytics: five apps, all inactive, each opens its page", async () => {
    await owner.goto(section);
    await owner.waitForSelector("[data-pixel-app=snapchat]");
    const apps = await owner.locator("[data-pixel-app]").evaluateAll((els) => els.map((e) => `${e.dataset.pixelApp}:${e.dataset.state}`));
    expect(apps.join() === "gtm:off,ga4:off,meta:off,snapchat:off,tiktok:off", `grid in Zimam's order, inactive: ${apps}`);
    await Promise.all([owner.waitForURL("**/pixels/meta"), owner.locator("[data-pixel-app=meta] [data-testid=pixel-open]").click()]);
    await owner.waitForSelector("text=رجوع إلى البكسل");
  });

  await step("Meta: add an ad account, wrong ID refused on its card, then saved with an encrypted token", async () => {
    expect(!(await owner.locator("[data-account]").count()), "no account yet");
    await owner.click("[data-testid=pixel-add]");
    await owner.fill("#px-tag-0", "abc");
    await owner.fill("#px-secret-0", "good-token");
    await save();
    await owner.waitForSelector("[data-account='0'] >> text=المعرّف غير صحيح لهذه المنصة");
    await owner.fill("#px-tag-0", META);
    await save(META);
    const [[row]] = await db.query("SELECT secret, purchase_on, product_ids, name FROM pixels WHERE shop_id = ? AND tag_id = ?", [shopId, META]);
    expect(row.secret && !row.secret.includes("good-token") && row.purchase_on === "placed" && row.product_ids === null && row.name === META, "token encrypted, purchase at order, whole store");
  });

  await step("test button checks the Meta token and shows the platform's answer", async () => {
    await owner.locator(`[data-pixel="${META}"] button`, { hasText: "إرسال حدث تجريبي" }).click();
    await owner.locator(`[data-pixel="${META}"]`).getByText("نجح الاختبار: Pixel: Pixel test").waitFor();
  });

  await step("TikTok (one product, purchase at confirmation), Snapchat, GA4 and Tag Manager", async () => {
    await owner.goto(appPage("tiktok"));
    await owner.click("[data-testid=pixel-add]");
    await owner.fill("#px-name-0", "تيك توك الحقيبة");
    await owner.fill("#px-tag-0", TIKTOK.toLowerCase());
    await owner.fill("#px-secret-0", "good-token");
    await owner.fill("#px-test-0", "TEST1");
    await advanced(0);
    await owner.selectOption("#px-purchase-0", "confirmed");
    await owner.selectOption("#px-scope-0", "products");
    await owner.locator("[data-testid=pixel-products] label", { hasText: "حقيبة" }).click();
    await save(TIKTOK);
    await owner.goto(appPage("snapchat"));
    await owner.click("[data-testid=pixel-add]");
    await owner.fill("#px-tag-0", SNAP.toUpperCase());
    await owner.fill("#px-secret-0", "good-token");
    expect(!(await owner.locator("#px-test-0").count()), "Snap has no test code");
    await save(SNAP);
    await owner.locator(`[data-pixel="${SNAP}"] button`, { hasText: "إرسال حدث تجريبي" }).click();
    await owner.locator(`[data-pixel="${SNAP}"]`).getByText("نجح الاختبار: VALID").waitFor();
    expect(received.some((r) => r.platform === "snapchat" && r.path === `/snapchat/v3/${SNAP}/events/validate`), "Snap test uses the validate route");
    received.length = 0;
    await owner.goto(appPage("ga4"));
    await owner.fill("#px-tag-0", GA4);
    await owner.fill("#px-secret-0", "good-secret");
    await save(GA4);
    await owner.goto(appPage("gtm"));
    await owner.fill("#px-tag-0", GTM);
    expect(!(await owner.locator("#px-secret-0").count()), "no server token for Tag Manager");
    await save(GTM);
    const [[tt]] = await db.query("SELECT tag_id, product_ids, test_code, name FROM pixels WHERE shop_id = ? AND platform = 'tiktok'", [shopId]);
    const ids = typeof tt.product_ids === "string" ? JSON.parse(tt.product_ids) : tt.product_ids;
    expect(tt.tag_id === TIKTOK && ids.join() === bag && tt.test_code === "TEST1" && tt.name === "تيك توك الحقيبة", "TikTok saved upper-case, for the bag only");
    await owner.goto(section);
    const on = await owner.locator("[data-pixel-app][data-state=on]").count();
    expect(on === 5, `all five apps active on the grid (${on})`);
  });

  const customerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await blockTrackers(customerContext);
  const customer = await customerContext.newPage();

  await step("product page: page view and product view, only to the pixels of this product", async () => {
    await customer.goto(`${store}/p/watch`);
    await customer.waitForSelector("button[type=submit]");
    const fb = await waitFor(async () => {
      const calls = await fbCalls(customer);
      return calls.some((c) => c[0] === "trackSingle" && c[2] === "ViewContent") && calls;
    }, "Meta ViewContent queued");
    expect(fb.some((c) => c[0] === "init" && c[1] === META), "Meta pixel initialised");
    const view = fb.find((c) => c[2] === "ViewContent");
    expect(view[1] === META && view[3].content_ids[0] === watch && view[3].currency === "DZD" && view[3].value === 3000, "ViewContent with product id, DZD and price");
    expect(!(await customer.evaluate(() => window.ttq?._i)), "TikTok (bag only) not loaded on the watch page");
    const dl = await dataLayer(customer);
    expect(dl.some((x) => x?.event === "gtm.js"), "Tag Manager loaded");
    expect(dl.some((x) => Array.isArray(x) && x[0] === "config" && x[1] === GA4), "GA4 configured");
    expect(dl.some((x) => Array.isArray(x) && x[0] === "event" && x[1] === "view_item" && x[2].send_to === GA4), "GA4 view_item");
    const snap = await snapCalls(customer);
    expect(snap.some((c) => c[0] === "init" && c[1] === SNAP) && snap.some((c) => c[0] === "track" && c[1] === "VIEW_CONTENT" && c[2].price === 3000 && c[2].currency === "DZD"), "Snap pixel: init and VIEW_CONTENT");
  });

  let watchOrder;
  await step("order: checkout started, purchase in the browser and from the server with the same id", async () => {
    await customer.fill("#name", "كريم بن علي");
    expect((await fbCalls(customer)).some((c) => c[2] === "InitiateCheckout"), "InitiateCheckout on first focus");
    await customer.fill("#phone", "0555 11 22 33");
    await customer.selectOption("#wilaya", "16");
    await customer.selectOption("#commune", "حيدرة");
    await Promise.all([customer.waitForURL(/\/thanks\?o=/), customer.click("button[type=submit]")]);
    watchOrder = new URL(customer.url()).searchParams.get("o");
    const purchase = await waitFor(async () => (await fbCalls(customer)).find((c) => c[2] === "Purchase"), "browser Purchase");
    expect(purchase[1] === META && purchase[3].value === 3500 && purchase[4].eventID === watchOrder, "browser Purchase: total with delivery, order id as event id");
    expect((await dataLayer(customer)).some((x) => Array.isArray(x) && x[1] === "purchase" && x[2].transaction_id === watchOrder), "GA4 purchase");
    const meta = await waitFor(() => received.find((r) => r.platform === "meta" && r.body.data[0].event_id === watchOrder), "server Meta event");
    const ev = meta.body.data[0];
    expect(meta.path === `/meta/v25.0/${META}/events` && ev.event_name === "Purchase" && ev.custom_data.value === 3500 && ev.custom_data.currency === "DZD", "Meta Conversions API purchase");
    expect(ev.user_data.ph[0].length === 64 && !JSON.stringify(ev).includes("0555112233"), "phone sent hashed only");
    expect(String(ev.event_source_url).includes("/p/watch"), "page URL sent");
    const ga = await waitFor(() => received.find((r) => r.platform === "ga4" && r.body.events[0].params.transaction_id === watchOrder), "server GA4 event");
    expect(ga.path === "/ga4/mp/collect" && ga.query.measurement_id === GA4, "GA4 Measurement Protocol purchase");
    expect(!received.some((r) => r.platform === "tiktok"), "TikTok untouched (not its product)");
    const snapBrowser = (await snapCalls(customer)).find((c) => c[1] === "PURCHASE");
    expect(snapBrowser && snapBrowser[2].transaction_id === watchOrder && snapBrowser[2].client_dedup_id === watchOrder, "browser Snap PURCHASE with the order id");
    const snap = await waitFor(() => received.find((r) => r.platform === "snapchat" && r.body.data[0].event_id === watchOrder), "server Snap event");
    const se = snap.body.data[0];
    expect(snap.path === `/snapchat/v3/${SNAP}/events` && se.event_name === "PURCHASE" && se.action_source === "WEB" && se.custom_data.value === 3500 && se.user_data.ph[0].length === 64, "Snap Conversions API purchase, phone hashed");
  });

  let bagOrder;
  await step("TikTok product: Lead in the browser, click id kept for the server", async () => {
    await customer.goto(`${store}/p/bag?ttclid=click-42`);
    await customer.waitForSelector("button[type=submit]");
    const tt = await waitFor(async () => {
      const calls = await ttCalls(customer, TIKTOK);
      return calls.some((c) => c[0] === "track" && c[1] === "ViewContent") && calls;
    }, "TikTok ViewContent");
    expect(tt.some((c) => c[0] === "page"), "TikTok page view");
    await customer.fill("#name", "سارة");
    await customer.fill("#phone", "0666 11 22 33");
    await customer.selectOption("#wilaya", "16");
    await customer.selectOption("#commune", "حيدرة");
    await Promise.all([customer.waitForURL(/\/thanks\?o=/), customer.click("button[type=submit]")]);
    bagOrder = new URL(customer.url()).searchParams.get("o");
    const lead = await waitFor(async () => (await ttCalls(customer, TIKTOK)).find((c) => c[1] === "PlaceAnOrder"), "TikTok PlaceAnOrder");
    expect(lead[3].event_id === `lead-${bagOrder}`, "lead event id");
    expect(!(await ttCalls(customer, TIKTOK)).some((c) => c[1] === "CompletePayment"), "no purchase yet for a pixel waiting for confirmation");
    const [[order]] = await db.query("SELECT tracking FROM orders WHERE id = ?", [bagOrder]);
    const tracking = typeof order.tracking === "string" ? JSON.parse(order.tracking) : order.tracking;
    expect(tracking.ttclid === "click-42", "ttclid saved with the order");
    await customer.waitForTimeout(500);
    expect(!received.some((r) => r.platform === "tiktok"), "TikTok server purchase waits for the confirmation");
  });

  await step("confirming the order sends the TikTok purchase once", async () => {
    await owner.goto(`${BASE}/ar/dashboard/orders/${bagOrder}`);
    await setOrderStatus(owner, "confirmed");
    const tt = await waitFor(() => received.find((r) => r.platform === "tiktok"), "server TikTok event");
    const ev = tt.body.data[0];
    expect(tt.headers["access-token"] === "good-token" && tt.body.event_source_id === TIKTOK && tt.body.test_event_code === "TEST1", "TikTok Events API call");
    expect(ev.event === "CompletePayment" && ev.event_id === bagOrder && ev.user.ttclid === "click-42" && ev.properties.value === 5500, "purchase with click id and total");
    await setOrderStatus(owner, "call_back");
    await setOrderStatus(owner, "confirmed");
    await owner.waitForTimeout(700);
    expect(received.filter((r) => r.platform === "tiktok").length === 1, "not sent a second time");
  });

  await step("server log on each app page, a failing test shows the platform's reason", async () => {
    await owner.goto(appPage("meta"));
    const log = owner.locator("[data-testid=pixel-log]");
    await log.waitFor();
    expect((await log.locator("tr[data-event=purchase][data-status=sent]").count()) === 2, "Meta: 2 purchases sent");
    await owner.goto(appPage("snapchat"));
    expect((await owner.locator("[data-testid=pixel-log] tr[data-event=purchase][data-status=sent]").count()) === 2, "Snap: 2 purchases sent");
    await owner.goto(appPage("ga4"));
    expect((await owner.locator("[data-testid=pixel-log] tr[data-event=purchase][data-status=sent]").count()) === 2, "GA4: 2 purchases sent, its own log only");
    await owner.fill("#px-secret-0", "wrong");
    await save();
    await owner.waitForSelector("text=تم الحفظ.");
    await owner.locator(`[data-pixel="${GA4}"] button`, { hasText: "إرسال حدث تجريبي" }).click();
    await owner.locator(`[data-pixel="${GA4}"]`).getByText("رفضت المنصة الحدث: Unable to find api_secret").waitFor();
  });

  await step("a stopped pixel is not loaded; a removed account is deleted; the grid follows", async () => {
    await owner.goto(appPage("meta"));
    await owner.locator(`[data-pixel="${META}"] [role=switch]`).click();
    await owner.waitForSelector(`[data-pixel="${META}"] >> text=متوقف`);
    await save();
    await until(async () => (await db.query("SELECT active FROM pixels WHERE shop_id = ? AND tag_id = ?", [shopId, META]))[0][0]?.active === 0, "Meta stopped in the database");
    await owner.goto(appPage("snapchat"));
    await owner.locator(`[data-pixel="${SNAP}"] [data-testid=pixel-remove]`).click();
    expect(!(await owner.locator("[data-account]").count()), "account gone from the page");
    await save();
    await until(async () => !(await db.query("SELECT id FROM pixels WHERE shop_id = ? AND platform = 'snapchat'", [shopId]))[0].length, "Snap pixel deleted");
    expect(!(await db.query("SELECT e.id FROM pixel_events e LEFT JOIN pixels p ON p.id = e.pixel_id WHERE e.shop_id = ? AND p.id IS NULL", [shopId]))[0].length, "its log went with it");
    await owner.goto(section);
    const states = await owner.locator("[data-pixel-app]").evaluateAll((els) => els.map((e) => `${e.dataset.pixelApp}:${e.dataset.state}`));
    expect(states.join() === "gtm:on,ga4:on,meta:off,snapchat:off,tiktok:on", `grid states: ${states}`);
    await customer.goto(`${store}/p/watch`);
    await customer.waitForSelector("button[type=submit]");
    await customer.waitForTimeout(300);
    expect(!(await customer.evaluate(() => window.fbq)) && !(await customer.evaluate(() => window.snaptr)), "Meta and Snap not loaded");
  });

  await step("call center agents cannot open pixels; another shop sees none of them", async () => {
    const { token } = await createSession({ shopId, role: "agent", email: `agent9-${tag}@test.dz` });
    const agentContext = await browser.newContext();
    await agentContext.addCookies([{ name: "sc_session", value: token, url: BASE }]);
    const agent = await agentContext.newPage();
    await agent.goto(section);
    await agent.waitForURL((u) => !u.pathname.includes("pixels"));
    await agentContext.close();
    const other = await createShop(browser);
    const p = await other.context.newPage();
    await p.goto(section);
    await p.waitForSelector("[data-pixel-app]");
    expect(!(await p.locator("[data-pixel-app][data-state=on]").count()), "another shop: nothing active");
    await p.goto(appPage("tiktok"));
    await p.waitForSelector("[data-testid=pixel-add]");
    expect(!(await p.locator("[data-account]").count()), "another shop: no TikTok account");
    await other.context.close();
  });

  await customerContext.close();
  await context.close();
}
