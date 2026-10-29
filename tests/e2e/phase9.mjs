// Phase 9: pixels — Meta, TikTok, Google Analytics 4 and Tag Manager in the browser (only the page's pixels),
// server-side purchases (Conversions API / Events API / Measurement Protocol) at order, confirmation or delivery,
// sent once per order, the test button, the log, roles and tenant isolation.
import { randomUUID } from "node:crypto";
import { BASE, createSession, createShop, db, expect, step } from "./helpers.mjs";
import { received } from "./mock-pixels.mjs";

const META = "123456789012345";
const TIKTOK = "CTEST1234567890ABCD";
const GA4 = "G-TEST12345";
const GTM = "GTM-ABC1234";

// The ad platforms' real scripts are never loaded in tests: the pixels' own queues show what was sent.
async function blockTrackers(context) {
  await context.route(/connect\.facebook\.net|analytics\.tiktok\.com|googletagmanager\.com/, (route) => route.abort());
}
const fbCalls = (page) => page.evaluate(() => (window.fbq?.queue ?? []).map((args) => Array.from(args)));
const ttCalls = (page, id) => page.evaluate((pixel) => (window.ttq?._i?.[pixel] ?? []).map((args) => Array.from(args)), id);
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

  const addPixel = async (fill) => {
    await owner.locator("button", { hasText: "إضافة بكسل" }).click();
    const form = owner.locator("[data-testid=pixel-form]");
    await form.waitFor();
    await fill(form);
    await form.locator("button[type=submit]").click();
  };

  await step("Meta pixel: wrong ID refused, then saved with an encrypted token", async () => {
    await owner.goto(section);
    await owner.waitForSelector("text=لا يوجد بكسل بعد");
    await addPixel(async (f) => {
      await f.locator("#px-name").fill("بكسل المتجر");
      await f.locator("#px-tag").fill("abc");
      await f.locator("#px-secret").fill("good-token");
    });
    await owner.waitForSelector("text=المعرّف غير صحيح لهذه المنصة");
    await owner.fill("#px-tag", META);
    await owner.locator("[data-testid=pixel-form] button[type=submit]").click();
    await owner.waitForSelector(`[data-pixel="${META}"]`);
    const [[row]] = await db.query("SELECT secret, purchase_on, product_ids FROM pixels WHERE shop_id = ? AND tag_id = ?", [shopId, META]);
    expect(row.secret && !row.secret.includes("good-token") && row.purchase_on === "placed" && row.product_ids === null, "token encrypted, purchase at order, whole store");
  });

  await step("test button checks the Meta token and shows the platform's answer", async () => {
    await owner.locator(`[data-pixel="${META}"] button`, { hasText: "إرسال حدث تجريبي" }).click();
    await owner.locator(`[data-pixel="${META}"]`).getByText("نجح الاختبار: Pixel: Pixel test").waitFor();
  });

  await step("TikTok (one product, purchase at confirmation), GA4 and Tag Manager", async () => {
    await addPixel(async (f) => {
      await f.locator("#px-platform").selectOption("tiktok");
      await f.locator("#px-name").fill("تيك توك الحقيبة");
      await f.locator("#px-tag").fill(TIKTOK.toLowerCase());
      await f.locator("#px-secret").fill("good-token");
      await f.locator("#px-test").fill("TEST1");
      await f.locator("#px-purchase").selectOption("confirmed");
      await f.locator("#px-scope").selectOption("products");
      await f.locator("[data-testid=pixel-products] label", { hasText: "حقيبة" }).click();
    });
    await owner.waitForSelector(`[data-pixel="${TIKTOK}"]`);
    await addPixel(async (f) => {
      await f.locator("#px-platform").selectOption("ga4");
      await f.locator("#px-name").fill("Google Analytics");
      await f.locator("#px-tag").fill(GA4);
      await f.locator("#px-secret").fill("good-secret");
    });
    await owner.waitForSelector(`[data-pixel="${GA4}"]`);
    await addPixel(async (f) => {
      await f.locator("#px-platform").selectOption("gtm");
      await f.locator("#px-name").fill("Tag Manager");
      await f.locator("#px-tag").fill(GTM);
      expect(!(await f.locator("#px-secret").count()), "no server token for Tag Manager");
    });
    await owner.waitForSelector(`[data-pixel="${GTM}"]`);
    const [[tt]] = await db.query("SELECT tag_id, product_ids, test_code FROM pixels WHERE shop_id = ? AND platform = 'tiktok'", [shopId]);
    const ids = typeof tt.product_ids === "string" ? JSON.parse(tt.product_ids) : tt.product_ids;
    expect(tt.tag_id === TIKTOK && ids.join() === bag && tt.test_code === "TEST1", "TikTok saved upper-case, for the bag only");
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
    await owner.click('[data-testid=status-picker] button:has-text("مؤكد")');
    const tt = await waitFor(() => received.find((r) => r.platform === "tiktok"), "server TikTok event");
    const ev = tt.body.data[0];
    expect(tt.headers["access-token"] === "good-token" && tt.body.event_source_id === TIKTOK && tt.body.test_event_code === "TEST1", "TikTok Events API call");
    expect(ev.event === "CompletePayment" && ev.event_id === bagOrder && ev.user.ttclid === "click-42" && ev.properties.value === 5500, "purchase with click id and total");
    await owner.click('[data-testid=status-picker] button:has-text("جديد")');
    await owner.waitForSelector('[data-testid=status-picker] button[aria-pressed=true]:has-text("جديد")');
    await owner.click('[data-testid=status-picker] button:has-text("مؤكد")');
    await owner.waitForSelector('[data-testid=status-picker] button[aria-pressed=true]:has-text("مؤكد")');
    await owner.waitForTimeout(700);
    expect(received.filter((r) => r.platform === "tiktok").length === 1, "not sent a second time");
  });

  await step("server log on the dashboard, a failing test shows the platform's reason", async () => {
    await owner.goto(section);
    const log = owner.locator("[data-testid=pixel-log]");
    await log.waitFor();
    expect((await log.locator("tr[data-event=purchase][data-status=sent]").count()) === 5, "5 purchases sent (Meta ×2, GA4 ×2, TikTok)");
    await owner.locator(`[data-pixel="${GA4}"] button`, { hasText: "تعديل" }).click();
    await owner.fill("#px-secret", "wrong");
    await owner.locator("[data-testid=pixel-form] button[type=submit]").click();
    await owner.waitForSelector(`[data-pixel="${GA4}"]`);
    await owner.locator(`[data-pixel="${GA4}"] button`, { hasText: "إرسال حدث تجريبي" }).click();
    await owner.locator(`[data-pixel="${GA4}"]`).getByText("رفضت المنصة الحدث: Unable to find api_secret").waitFor();
  });

  await step("a stopped pixel is not loaded", async () => {
    await owner.locator(`[data-pixel="${META}"] input[type=checkbox]`).uncheck();
    await owner.waitForFunction((id) => document.querySelector(`[data-pixel="${id}"]`)?.textContent?.includes("متوقف"), META);
    await customer.goto(`${store}/p/watch`);
    await customer.waitForSelector("button[type=submit]");
    await customer.waitForTimeout(300);
    expect(!(await customer.evaluate(() => window.fbq)), "Meta not loaded");
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
    await p.waitForSelector("text=لا يوجد بكسل بعد");
    await other.context.close();
  });

  await customerContext.close();
  await context.close();
}
